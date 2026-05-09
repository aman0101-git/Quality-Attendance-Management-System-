import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../auth/current-user.decorator";
import { Role } from "../auth/role.enum";
import { ScorecardsService } from "./scorecards.service";
import {
  CreateScorecardDto,
  UpdateScorecardHeaderDto,
  UpdateScorecardStatusDto,
  UpdateScorecardStructureDto,
} from "./scorecards.dto";

/**
 * ADMIN-only scorecard management.
 *
 *   GET    /scorecards                 — list (with counts)
 *   POST   /scorecards                 — create (header + optional structure)
 *   GET    /scorecards/:id             — full detail
 *   PATCH  /scorecards/:id             — update header (name/description/group)
 *   PATCH  /scorecards/:id/structure   — replace sections+questions, ++version
 *   PATCH  /scorecards/:id/status      — toggle ACTIVE/INACTIVE
 *
 * The supervisor-facing read path (`GET /audits/scorecards`) is delegated
 * to the same service — see `AuditsController.listScorecards`.
 */
@Controller("scorecards")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScorecardsController {
  constructor(private readonly scorecards: ScorecardsService) {}

  @Get()
  @Roles("ADMIN")
  async list(
    @Query("group") groupName?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.scorecards.list({
      groupName: groupName?.trim() || undefined,
      includeInactive: includeInactive === "true",
    });
  }

  /**
   * Read the global default QA template. Surfaced separately from
   * `GET /scorecards/:id` so the frontend can fetch the canonical
   * template without first knowing its id.
   */
  @Get("default")
  @Roles("ADMIN", "SUPERVISOR")
  async getDefault() {
    const scorecard = await this.scorecards.getDefault();
    if (!scorecard) {
      // 200 with null is friendlier than 404 for "not yet seeded".
      return null;
    }
    return scorecard;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles("ADMIN")
  async create(
    @CurrentUser() actor: CurrentUserPayload,
    @Body() dto: CreateScorecardDto,
  ) {
    return this.scorecards.create(
      { id: actor.id, role: actor.role as Role },
      dto,
    );
  }

  @Get(":id")
  @Roles("ADMIN")
  async detail(@Param("id", ParseIntPipe) id: number) {
    return this.scorecards.getById(id);
  }

  @Patch(":id")
  @Roles("ADMIN")
  async updateHeader(
    @CurrentUser() actor: CurrentUserPayload,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateScorecardHeaderDto,
  ) {
    return this.scorecards.updateHeader(
      { id: actor.id, role: actor.role as Role },
      id,
      dto,
    );
  }

  @Patch(":id/structure")
  @Roles("ADMIN")
  async updateStructure(
    @CurrentUser() actor: CurrentUserPayload,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateScorecardStructureDto,
  ) {
    return this.scorecards.replaceStructure(
      { id: actor.id, role: actor.role as Role },
      id,
      dto,
    );
  }

  @Patch(":id/status")
  @Roles("ADMIN")
  async setStatus(
    @CurrentUser() actor: CurrentUserPayload,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateScorecardStatusDto,
  ) {
    return this.scorecards.setStatus(
      { id: actor.id, role: actor.role as Role },
      id,
      dto,
    );
  }

  /**
   * Promote `:id` to the global default QA template. Demotes the prior
   * default and force-activates the new one in the same transaction.
   */
  @Patch(":id/default")
  @Roles("ADMIN")
  async setAsDefault(
    @CurrentUser() actor: CurrentUserPayload,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.scorecards.setAsDefault(
      { id: actor.id, role: actor.role as Role },
      id,
    );
  }
}
