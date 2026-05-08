import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateProjectDto } from "./dto/create-project.dto";
import {
  ProjectStatus,
  type GroupedProjects,
  type ProjectResponse,
} from "./types";

interface ListFilter {
  /** Filter by `status` (ACTIVE / INACTIVE). Omit for all. */
  status?: ProjectStatus;
  /** Hide soft-deleted rows (default: true). */
  onlyActive?: boolean;
  /** Filter by group. Useful for the future audit lookup. */
  groupName?: string;
}

/**
 * Prisma row shape after our standard `include`.
 * Declared inline so the service stays decoupled from `@prisma/client` types.
 */
type ProjectRow = {
  id: number;
  projectName: string;
  groupName: string;
  description: string | null;
  status: ProjectStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string; username: string };
};

function toResponse(row: ProjectRow): ProjectResponse {
  return {
    id: row.id,
    projectName: row.projectName,
    groupName: row.groupName,
    description: row.description,
    status: row.status,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: {
      id: row.createdBy.id,
      name: row.createdBy.name,
      username: row.createdBy.username,
    },
  };
}

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private readonly creatorSelect = {
    select: { id: true, name: true, username: true },
  };

  /**
   * Create a new project for the given supervisor.
   * Enforces a (projectName, groupName) uniqueness — if duplicated, returns 409.
   */
  async create(actorId: string, dto: CreateProjectDto): Promise<ProjectResponse> {
    const projectName = dto.projectName.trim();
    const groupName = dto.groupName.trim();

    const existing = await this.prisma.project.findUnique({
      where: {
        uniq_project_per_group: { projectName, groupName },
      },
    });
    if (existing) {
      throw new ConflictException(
        `A project named "${projectName}" already exists in group "${groupName}"`,
      );
    }

    const created = (await this.prisma.project.create({
      data: {
        projectName,
        groupName,
        description: dto.description?.trim() || null,
        status: dto.status ?? ProjectStatus.ACTIVE,
        createdById: actorId,
      },
      include: { createdBy: this.creatorSelect },
    })) as unknown as ProjectRow;

    return toResponse(created);
  }

  /**
   * Flat list, newest first. Filters mirror the future audit query
   * (`{ status: ACTIVE, groupName: ... }`).
   */
  async list(filter: ListFilter = {}): Promise<ProjectResponse[]> {
    const rows = (await this.prisma.project.findMany({
      where: {
        isActive: filter.onlyActive === false ? undefined : true,
        status: filter.status,
        groupName: filter.groupName,
      },
      orderBy: [{ groupName: "asc" }, { createdAt: "desc" }],
      include: { createdBy: this.creatorSelect },
    })) as unknown as ProjectRow[];

    return rows.map(toResponse);
  }

  /**
   * Same data as `list` but pre-bucketed by `groupName`, ready to render.
   * Sorted by group name and project name within each group.
   */
  async listGrouped(filter: ListFilter = {}): Promise<GroupedProjects[]> {
    const projects = await this.list(filter);

    const buckets = new Map<string, ProjectResponse[]>();
    for (const p of projects) {
      const list = buckets.get(p.groupName) ?? [];
      list.push(p);
      buckets.set(p.groupName, list);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupName, list]) => ({
        groupName,
        count: list.length,
        projects: list.sort((a, b) =>
          a.projectName.localeCompare(b.projectName),
        ),
      }));
  }

  /** Toggle a project's active/inactive status. */
  async updateStatus(
    id: number,
    status: ProjectStatus,
  ): Promise<ProjectResponse> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    const updated = (await this.prisma.project.update({
      where: { id },
      data: { status },
      include: { createdBy: this.creatorSelect },
    })) as unknown as ProjectRow;

    return toResponse(updated);
  }
}
