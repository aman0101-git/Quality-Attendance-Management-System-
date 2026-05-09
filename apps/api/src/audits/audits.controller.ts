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
import { AuditsService } from "./audits.service";
import { AuditStatus } from "./audit-status.enum";
import { CreateAuditDto } from "./dto/create-audit.dto";
import { UpdateAuditDto } from "./dto/update-audit.dto";
import {
  ReopenAuditDto,
  SubmitAuditDto,
} from "./dto/submit-audit.dto";
import { ScorecardsService } from "../scorecards/scorecards.service";

function parseStatusFilter(raw: unknown): AuditStatus | undefined {
  if (
    raw === AuditStatus.DRAFT ||
    raw === AuditStatus.IN_PROGRESS ||
    raw === AuditStatus.SUBMITTED ||
    raw === AuditStatus.COMPLETED
  ) {
    return raw;
  }
  return undefined;
}

/**
 * Routes:
 *   POST   /audits                     — create draft (SUPERVISOR)
 *   GET    /audits                     — list (SUPERVISOR scoped)
 *   GET    /audits/:id                 — detail (owner SUPERVISOR / matching AGENT)
 *   PATCH  /audits/:id                 — autosave (SUPERVISOR)
 *   PATCH  /audits/:id/submit          — submit (SUPERVISOR)
 *   PATCH  /audits/:id/reopen          — re-open submitted (SUPERVISOR)
 *
 *   GET    /audits/scorecards          — supervisor read-only scorecard list
 *
 * NOTE: Scorecard CRUD lives in its own ADMIN-only module — see
 *       `ScorecardsController` (`/scorecards`).
 */
@Controller("audits")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditsController {
  constructor(
    private readonly audits: AuditsService,
    private readonly scorecards: ScorecardsService,
  ) {}

  // -------------------- Scorecards (must come before :id routes) --------

  /**
   * Supervisor-facing read path. Always returns active templates and is
   * typically scoped to a single group at call time. Delegates to the
   * dedicated `ScorecardsService` so the listing logic stays in one place.
   */
  @Get("scorecards")
  @Roles("SUPERVISOR", "ADMIN")
  async listScorecards(@Query("group") groupName?: string) {
    return this.scorecards.listForGroup(groupName?.trim() || undefined);
  }

  // -------------------- Audit lifecycle ---------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles("SUPERVISOR")
  async create(
    @CurrentUser() actor: CurrentUserPayload,
    @Body() dto: CreateAuditDto,
  ) {
    return this.audits.create(
      { id: actor.id, role: actor.role as Role },
      dto,
    );
  }

  @Get()
  @Roles("SUPERVISOR", "ADMIN", "AGENT")
  async list(
    @CurrentUser() actor: CurrentUserPayload,
    @Query("status") status?: string,
    @Query("agentId") agentId?: string,
    @Query("projectId") projectId?: string,
    @Query("group") groupName?: string,
  ) {
    return this.audits.list(
      { id: actor.id, role: actor.role as Role },
      {
        status: parseStatusFilter(status),
        agentId: agentId?.trim() || undefined,
        projectId: projectId ? Number(projectId) || undefined : undefined,
        groupName: groupName?.trim() || undefined,
      },
    );
  }

  @Get(":id")
  @Roles("SUPERVISOR", "ADMIN", "AGENT")
  async getOne(
    @CurrentUser() actor: CurrentUserPayload,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.audits.getById(id, {
      id: actor.id,
      role: actor.role as Role,
    });
  }

  @Patch(":id")
  @Roles("SUPERVISOR")
  async update(
    @CurrentUser() actor: CurrentUserPayload,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAuditDto,
  ) {
    return this.audits.update(
      id,
      { id: actor.id, role: actor.role as Role },
      dto,
    );
  }

  @Patch(":id/submit")
  @Roles("SUPERVISOR")
  async submit(
    @CurrentUser() actor: CurrentUserPayload,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SubmitAuditDto,
  ) {
    return this.audits.submit(
      id,
      { id: actor.id, role: actor.role as Role },
      dto,
    );
  }

  @Patch(":id/reopen")
  @Roles("SUPERVISOR")
  async reopen(
    @CurrentUser() actor: CurrentUserPayload,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReopenAuditDto,
  ) {
    return this.audits.reopen(
      id,
      { id: actor.id, role: actor.role as Role },
      dto,
    );
  }
}
