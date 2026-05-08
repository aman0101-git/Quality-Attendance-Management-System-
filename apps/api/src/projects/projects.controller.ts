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
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectStatusDto } from "./dto/update-project.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../auth/current-user.decorator";
import { ProjectStatus } from "./types";

/**
 * Coerce a raw `?status=` query value into a `ProjectStatus` or `undefined`.
 * Anything unrecognized is treated as "no filter" instead of crashing.
 */
function parseStatusFilter(raw: unknown): ProjectStatus | undefined {
  if (raw === ProjectStatus.ACTIVE || raw === ProjectStatus.INACTIVE) {
    return raw;
  }
  return undefined;
}

/**
 * Routes:
 *   POST   /projects              — create (SUPERVISOR)
 *   GET    /projects              — flat list (SUPERVISOR, ADMIN)
 *   GET    /projects/grouped      — grouped by groupName (SUPERVISOR, ADMIN)
 *   PATCH  /projects/:id/status   — change status (SUPERVISOR)
 *
 * All routes require a valid JWT.
 */
@Controller("projects")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles("SUPERVISOR")
  async create(
    @CurrentUser() actor: CurrentUserPayload,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(actor.id, dto);
  }

  @Get()
  @Roles("SUPERVISOR", "ADMIN")
  async list(
    @Query("status") status?: string,
    @Query("group") groupName?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.projectsService.list({
      status: parseStatusFilter(status),
      groupName: groupName?.trim() || undefined,
      onlyActive: includeInactive === "true" ? false : true,
    });
  }

  @Get("grouped")
  @Roles("SUPERVISOR", "ADMIN")
  async listGrouped(
    @Query("status") status?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.projectsService.listGrouped({
      status: parseStatusFilter(status),
      onlyActive: includeInactive === "true" ? false : true,
    });
  }

  @Patch(":id/status")
  @Roles("SUPERVISOR")
  async updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProjectStatusDto,
  ) {
    return this.projectsService.updateStatus(id, dto.status);
  }
}
