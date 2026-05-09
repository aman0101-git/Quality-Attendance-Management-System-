import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "../auth/role.enum";
import { AuditQuestionType } from "../audits/audit-status.enum";
import {
  ScorecardStatus,
  booleanToStatus,
  statusToBoolean,
} from "./scorecard-status.enum";
import {
  DEFAULT_RATING_SCALE,
  MAX_QUESTIONS_PER_SECTION,
  MAX_SECTIONS,
} from "./scorecard.constants";
import type {
  CreateScorecardDto,
  ScorecardOptionInputDto,
  ScorecardQuestionInputDto,
  ScorecardSectionInputDto,
  UpdateScorecardHeaderDto,
  UpdateScorecardStatusDto,
  UpdateScorecardStructureDto,
} from "./scorecards.dto";
import type {
  ScorecardDetailResponse,
  ScorecardListItem,
  ScorecardQuestionResponse,
  ScorecardSectionResponse,
} from "./types";

interface AuthorizedActor {
  id: string;
  role: Role;
}

interface ListFilter {
  groupName?: string;
  /** When true, returns inactive templates as well. Defaults to false. */
  includeInactive?: boolean;
}

@Injectable()
export class ScorecardsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  //  LIST / READ
  // -------------------------------------------------------------------

  /**
   * Admin-facing listing: all templates with section/question counts.
   * Supervisor-facing reuse goes through `listForGroup` so we can keep
   * its scope narrow.
   */
  async list(filter: ListFilter = {}): Promise<ScorecardListItem[]> {
    const rows = await this.prisma.scorecardTemplate.findMany({
      where: {
        groupName: filter.groupName,
        isActive: filter.includeInactive ? undefined : true,
      },
      orderBy: [{ groupName: "asc" }, { createdAt: "desc" }],
      include: {
        createdBy: { select: { id: true, name: true, username: true } },
        sections: {
          select: {
            _count: { select: { questions: true } },
          },
        },
      },
    });

    return rows.map((r) => this.toListItem(r));
  }

  /**
   * Supervisor convenience: read-only list scoped to a single group.
   * Always omits inactive templates.
   */
  async listForGroup(groupName?: string): Promise<ScorecardListItem[]> {
    return this.list({ groupName, includeInactive: false });
  }

  async getById(id: number): Promise<ScorecardDetailResponse> {
    const row = await this.prisma.scorecardTemplate.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, username: true } },
        sections: {
          orderBy: { position: "asc" },
          include: {
            questions: { orderBy: { position: "asc" } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Scorecard not found");

    return {
      ...this.toListItem({
        ...row,
        sections: row.sections.map((s) => ({
          _count: { questions: s.questions.length },
        })),
      }),
      sections: row.sections.map<ScorecardSectionResponse>((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        weight: s.weight,
        position: s.position,
        questions: s.questions.map<ScorecardQuestionResponse>((q) => {
          const { options, ratingScale } = parseOptions(
            q.type as AuditQuestionType,
            q.optionsJson,
          );
          return {
            id: q.id,
            prompt: q.prompt,
            helpText: q.helpText,
            type: q.type as AuditQuestionType,
            weight: q.weight,
            scoring: q.scoring,
            fatal: q.fatal,
            compliance: q.compliance,
            required: q.required,
            position: q.position,
            options,
            ratingScale,
          };
        }),
      })),
    };
  }

  // -------------------------------------------------------------------
  //  CREATE
  // -------------------------------------------------------------------

  async create(
    actor: AuthorizedActor,
    dto: CreateScorecardDto,
  ): Promise<ScorecardDetailResponse> {
    this.requireAdmin(actor);

    const name = dto.name.trim();
    const groupName = dto.groupName.trim();

    // Duplicate-name check within the same group — clearer than the raw
    // DB error a unique constraint would surface.
    const existing = await this.prisma.scorecardTemplate.findFirst({
      where: { name, groupName, isActive: true },
    });
    if (existing) {
      throw new ConflictException(
        `An active scorecard named "${name}" already exists in group "${groupName}"`,
      );
    }

    if (dto.sections && dto.sections.length) {
      this.assertStructureLimits(dto.sections);
    }

    const created = await this.prisma.scorecardTemplate.create({
      data: {
        name,
        description: dto.description?.trim() ?? null,
        groupName,
        projectId: dto.projectId ?? null,
        createdById: actor.id,
        ...(dto.sections && dto.sections.length
          ? {
              sections: {
                create: dto.sections.map((s, sIdx) => ({
                  title: s.title.trim(),
                  description: s.description?.trim() ?? null,
                  weight: s.weight ?? 1,
                  position: sIdx,
                  questions: {
                    create: s.questions.map((q, qIdx) =>
                      buildQuestionCreate(q, qIdx),
                    ),
                  },
                })),
              },
            }
          : {}),
      },
    });

    return this.getById(created.id);
  }

  // -------------------------------------------------------------------
  //  UPDATE — header only
  // -------------------------------------------------------------------

  async updateHeader(
    actor: AuthorizedActor,
    id: number,
    dto: UpdateScorecardHeaderDto,
  ): Promise<ScorecardDetailResponse> {
    this.requireAdmin(actor);

    const existing = await this.prisma.scorecardTemplate.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Scorecard not found");

    const nextName = dto.name?.trim() ?? existing.name;
    const nextGroup = dto.groupName?.trim() ?? existing.groupName;

    if (nextName !== existing.name || nextGroup !== existing.groupName) {
      const dup = await this.prisma.scorecardTemplate.findFirst({
        where: {
          name: nextName,
          groupName: nextGroup,
          id: { not: id },
          isActive: true,
        },
      });
      if (dup) {
        throw new ConflictException(
          `An active scorecard named "${nextName}" already exists in group "${nextGroup}"`,
        );
      }
    }

    await this.prisma.scorecardTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: nextName } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.toString().trim() || null }
          : {}),
        ...(dto.groupName !== undefined ? { groupName: nextGroup } : {}),
        ...(dto.projectId !== undefined
          ? { projectId: dto.projectId ?? null }
          : {}),
      },
    });

    return this.getById(id);
  }

  // -------------------------------------------------------------------
  //  UPDATE — structure (bumps version)
  // -------------------------------------------------------------------

  async replaceStructure(
    actor: AuthorizedActor,
    id: number,
    dto: UpdateScorecardStructureDto,
  ): Promise<ScorecardDetailResponse> {
    this.requireAdmin(actor);

    const existing = await this.prisma.scorecardTemplate.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Scorecard not found");

    this.assertStructureLimits(dto.sections);

    // Cascade-deletes wipe questions when their section is removed,
    // so deleting top-level sections removes the whole structure.
    await this.prisma.scorecardSection.deleteMany({
      where: { templateId: id },
    });

    for (const [sIdx, s] of dto.sections.entries()) {
      await this.prisma.scorecardSection.create({
        data: {
          templateId: id,
          title: s.title.trim(),
          description: s.description?.trim() ?? null,
          weight: s.weight ?? 1,
          position: sIdx,
          questions: {
            create: s.questions.map((q, qIdx) => buildQuestionCreate(q, qIdx)),
          },
        },
      });
    }

    await this.prisma.scorecardTemplate.update({
      where: { id },
      data: { version: { increment: 1 } },
    });

    return this.getById(id);
  }

  // -------------------------------------------------------------------
  //  STATUS TOGGLE
  // -------------------------------------------------------------------

  async setStatus(
    actor: AuthorizedActor,
    id: number,
    dto: UpdateScorecardStatusDto,
  ): Promise<ScorecardDetailResponse> {
    this.requireAdmin(actor);

    const existing = await this.prisma.scorecardTemplate.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Scorecard not found");

    const nextActive = statusToBoolean(dto.status);

    // Business rule: the global default QA template must always remain
    // active so audits can attach it. Promote a different template to
    // default first, then deactivate this one.
    if (existing.isDefault && !nextActive) {
      throw new BadRequestException(
        "The default QA template cannot be deactivated. Promote a different template to default first.",
      );
    }

    await this.prisma.scorecardTemplate.update({
      where: { id },
      data: { isActive: nextActive },
    });

    return this.getById(id);
  }

  // -------------------------------------------------------------------
  //  DEFAULT TEMPLATE
  // -------------------------------------------------------------------

  /**
   * Resolve the single global default QA template, fully expanded.
   * Used by the audit module to auto-attach a scorecard at audit
   * creation — supervisors don't pick a template per audit.
   */
  async getDefault(): Promise<ScorecardDetailResponse | null> {
    const row = await this.prisma.scorecardTemplate.findFirst({
      where: { isDefault: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!row) return null;
    return this.getById(row.id);
  }

  /**
   * Promote a template to the default. Demotes the previous default in
   * the same transaction so the "exactly one default" invariant holds.
   * Also forces the new default to be active.
   */
  async setAsDefault(
    actor: AuthorizedActor,
    id: number,
  ): Promise<ScorecardDetailResponse> {
    this.requireAdmin(actor);

    const target = await this.prisma.scorecardTemplate.findUnique({
      where: { id },
    });
    if (!target) throw new NotFoundException("Scorecard not found");

    await this.prisma.$transaction([
      this.prisma.scorecardTemplate.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      }),
      this.prisma.scorecardTemplate.update({
        where: { id },
        data: { isDefault: true, isActive: true },
      }),
    ]);

    return this.getById(id);
  }

  // -------------------------------------------------------------------
  //  Internals
  // -------------------------------------------------------------------

  private requireAdmin(actor: AuthorizedActor) {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException(
        "Only ADMIN can manage scorecard templates",
      );
    }
  }

  private assertStructureLimits(sections: ScorecardSectionInputDto[]) {
    if (sections.length > MAX_SECTIONS) {
      throw new BadRequestException(
        `Too many sections (max ${MAX_SECTIONS})`,
      );
    }
    for (const s of sections) {
      if (s.questions.length > MAX_QUESTIONS_PER_SECTION) {
        throw new BadRequestException(
          `Section "${s.title}" has too many questions (max ${MAX_QUESTIONS_PER_SECTION})`,
        );
      }
      for (const q of s.questions) {
        if (q.type === AuditQuestionType.MULTIPLE_CHOICE) {
          if (!q.options || q.options.length < 2) {
            throw new BadRequestException(
              `Multiple-choice question "${q.prompt}" needs at least 2 options`,
            );
          }
        }
      }
    }
  }

  private toListItem(row: {
    id: number;
    name: string;
    description: string | null;
    groupName: string;
    projectId: number | null;
    isActive: boolean;
    isDefault: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { id: string; name: string; username: string };
    sections: Array<{ _count: { questions: number } }>;
  }): ScorecardListItem {
    const questionCount = row.sections.reduce(
      (acc, s) => acc + s._count.questions,
      0,
    );

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      groupName: row.groupName,
      projectId: row.projectId,
      status: booleanToStatus(row.isActive),
      isDefault: row.isDefault,
      version: row.version,
      sectionCount: row.sections.length,
      questionCount,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

// =====================================================================
//  Helpers
// =====================================================================

function buildQuestionCreate(q: ScorecardQuestionInputDto, qIdx: number) {
  const base = {
    prompt: q.prompt.trim(),
    helpText: q.helpText?.trim() ?? null,
    type: q.type,
    weight: q.weight ?? 1,
    scoring: q.scoring ?? true,
    fatal: q.fatal ?? false,
    compliance: q.compliance ?? false,
    required: q.required ?? true,
    position: qIdx,
  };

  const options = buildOptionsJson(q);
  return options === null ? base : { ...base, optionsJson: options as never };
}

function buildOptionsJson(q: ScorecardQuestionInputDto): unknown | null {
  switch (q.type) {
    case AuditQuestionType.MULTIPLE_CHOICE:
      return (q.options ?? []).map((o) => ({
        label: o.label.trim(),
        score: o.score,
      })) satisfies ScorecardOptionInputDto[];
    case AuditQuestionType.RATING:
      return { scale: q.ratingScale ?? DEFAULT_RATING_SCALE };
    default:
      return null;
  }
}

/** Inverse of buildOptionsJson — used when shaping API responses. */
function parseOptions(
  type: AuditQuestionType,
  raw: unknown,
): { options: { label: string; score: number }[] | null; ratingScale: number | null } {
  if (type === AuditQuestionType.MULTIPLE_CHOICE && Array.isArray(raw)) {
    const options = raw.flatMap((row) => {
      if (
        row &&
        typeof row === "object" &&
        typeof (row as { label?: unknown }).label === "string" &&
        typeof (row as { score?: unknown }).score === "number"
      ) {
        return [
          {
            label: (row as { label: string }).label,
            score: (row as { score: number }).score,
          },
        ];
      }
      return [];
    });
    return { options, ratingScale: null };
  }

  if (type === AuditQuestionType.RATING) {
    const scale =
      raw &&
      typeof raw === "object" &&
      typeof (raw as { scale: unknown }).scale === "number"
        ? (raw as { scale: number }).scale
        : DEFAULT_RATING_SCALE;
    return { options: null, ratingScale: scale };
  }

  return { options: null, ratingScale: null };
}
