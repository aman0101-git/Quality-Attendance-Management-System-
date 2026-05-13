import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "../auth/role.enum";
import {
  AGENT_VISIBLE_STATUSES,
  AUDIT_IMMUTABLE_STATUSES,
  AUDIT_STATUS_TRANSITIONS,
  AuditQuestionType,
  AuditStatus,
} from "./audit-status.enum";
import {
  AUDIT_CODE_PREFIX,
  AUDIT_CODE_SUFFIX_LENGTH,
} from "./audit.constants";
import { AuditScoreService } from "./audit-score.service";
import { ScorecardsService } from "../scorecards/scorecards.service";
import type { CreateAuditDto } from "./dto/create-audit.dto";
import type {
  AnswerInputDto,
  SectionRemarkInputDto,
  UpdateAuditDto,
} from "./dto/update-audit.dto";
import type {
  ReopenAuditDto,
  SubmitAuditDto,
} from "./dto/submit-audit.dto";
import type { CorrectionNoteDto } from "./dto/correction-note.dto";
import type {
  AuditDetailResponse,
  AuditListItem,
  AuditQuestionResponse,
  AuditSectionResponse,
} from "./types";

interface ListFilter {
  status?: AuditStatus;
  agentId?: string;
  projectId?: number;
  groupName?: string;
  /** Limit to the supervisor's own audits — defaults true for SUPERVISOR. */
  supervisorId?: string;
}

interface AuthorizedActor {
  id: string;
  role: Role;
}

/** Subset of `ScorecardTemplate` we actually consume during materialization. */
interface TemplateWithSections {
  id: number;
  name: string;
  groupName: string;
  sections: Array<{
    id: number;
    title: string;
    weight: number;
    position: number;
    questions: Array<{
      id: number;
      prompt: string;
      helpText: string | null;
      type: AuditQuestionType | string;
      weight: number;
      scoring: boolean;
      fatal: boolean;
      compliance: boolean;
      required: boolean;
      position: number;
      optionsJson: unknown;
    }>;
  }>;
}

@Injectable()
export class AuditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly score: AuditScoreService,
    private readonly scorecards: ScorecardsService,
  ) {}

  // -------------------------------------------------------------------
  //  CREATE
  // -------------------------------------------------------------------

  async create(
    actor: AuthorizedActor,
    dto: CreateAuditDto,
  ): Promise<AuditDetailResponse> {
    if (actor.role !== Role.SUPERVISOR) {
      throw new ForbiddenException("Only supervisors can create audits");
    }

    const agent = await this.prisma.user.findUnique({
      where: { id: dto.agentId },
    });
    if (!agent || agent.role !== Role.AGENT) {
      throw new BadRequestException("Selected user is not an agent");
    }
    if (!agent.isActive) {
      throw new BadRequestException("Selected agent is inactive");
    }

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project || !project.isActive) {
      throw new BadRequestException("Project not found or inactive");
    }

    // Make sure we don't create a duplicate for the same call reference.
    // Any existing audit for this agent+call (in any non-terminal status,
    // including PUBLISHED/REVIEWED) blocks a new draft. Discarded
    // (soft-deleted) audits free their call reference for re-use so
    // the supervisor can throw away a mistaken draft and start over.
    const existing = await this.prisma.audit.findFirst({
      where: {
        agentId: dto.agentId,
        callReference: dto.callReference.trim(),
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(
        `An audit for this call reference already exists in status ${existing.status}.`,
      );
    }

    const auditCode = await this.generateAuditCode();

    // Always attach the single global default QA template — supervisors
    // never pick a template per audit. The admin manages it from
    // `/admin/scorecards`. Falling back to a per-group template is no
    // longer supported under the simplified business rules.
    const template = await this.loadDefaultTemplateForAudit();

    const audit = await this.prisma.audit.create({
      data: {
        auditCode,
        status: AuditStatus.DRAFT,
        agentId: dto.agentId,
        supervisorId: actor.id,
        projectId: project.id,
        groupNameSnapshot: project.groupName,
        projectNameSnapshot: project.projectName,
        callReference: dto.callReference.trim(),
        scorecardTemplateId: template.id,
        createdById: actor.id,
        scorecardSnapshot: this.snapshotTemplate(template),
      },
    });

    await this.materializeScorecard(audit.id, template);

    return this.getById(audit.id, actor);
  }

  /**
   * Resolve the global default QA template into the shape the
   * materialization helper expects. Throws a clear 500 if the admin
   * has not seeded a default yet — operationally impossible in a
   * configured environment but worth surfacing explicitly.
   */
  private async loadDefaultTemplateForAudit(): Promise<TemplateWithSections> {
    const def = await this.scorecards.getDefault();
    if (!def) {
      throw new InternalServerErrorException(
        "No default QA template is configured. Ask an admin to set one in /admin/scorecards.",
      );
    }

    return {
      id: def.id,
      name: def.name,
      groupName: def.groupName,
      sections: def.sections.map((s) => ({
        id: s.id,
        title: s.title,
        weight: s.weight,
        position: s.position,
        questions: s.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          helpText: q.helpText,
          type: q.type,
          weight: q.weight,
          scoring: q.scoring,
          fatal: q.fatal,
          compliance: q.compliance,
          required: q.required,
          position: q.position,
          // Re-serialize to the on-disk shape expected by
          // `materializeScorecard`. MULTIPLE_CHOICE keeps the array
          // of {label,score}; RATING re-wraps the scale.
          optionsJson:
            q.options !== null
              ? q.options
              : q.ratingScale !== null
                ? { scale: q.ratingScale }
                : null,
        })),
      })),
    };
  }

  // -------------------------------------------------------------------
  //  UPDATE / AUTOSAVE
  // -------------------------------------------------------------------

  async update(
    id: number,
    actor: AuthorizedActor,
    dto: UpdateAuditDto,
  ): Promise<AuditDetailResponse> {
    const audit = await this.requireAuditForEdit(id, actor);

    // Scorecard binding is no longer set at update time — every audit is
    // created with the global default QA template already attached. Any
    // `scorecardTemplateId` in the body is therefore ignored, but rejected
    // when it would imply a swap so we surface the issue instead of
    // silently dropping client intent.
    if (
      dto.scorecardTemplateId &&
      dto.scorecardTemplateId !== audit.scorecardTemplateId
    ) {
      throw new BadRequestException(
        "Audits use the global default QA template and cannot swap scorecards",
      );
    }

    if (dto.callReference !== undefined) {
      await this.prisma.audit.update({
        where: { id: audit.id },
        data: { callReference: dto.callReference.trim() },
      });
    }

    if (dto.overallComment !== undefined) {
      await this.prisma.audit.update({
        where: { id: audit.id },
        data: { overallComment: dto.overallComment ?? null },
      });
    }

    // Persist ACPT fields when any are present in the payload.
    if (
      dto.acptCategory !== undefined ||
      dto.acptLevel2 !== undefined ||
      dto.acptLevel3 !== undefined
    ) {
      await this.prisma.audit.update({
        where: { id: audit.id },
        data: {
          ...(dto.acptCategory !== undefined
            ? { acptCategory: dto.acptCategory ?? null }
            : {}),
          ...(dto.acptLevel2 !== undefined
            ? { acptLevel2: dto.acptLevel2 ?? null }
            : {}),
          ...(dto.acptLevel3 !== undefined
            ? { acptLevel3: dto.acptLevel3 ?? null }
            : {}),
        },
      });
    }

    // Persist audit-level qualitative notes (call observation, area of improvement).
    if (dto.callObservation !== undefined || dto.areaOfImprovement !== undefined) {
      await this.prisma.audit.update({
        where: { id: audit.id },
        data: {
          ...(dto.callObservation !== undefined
            ? { callObservation: dto.callObservation ?? null }
            : {}),
          ...(dto.areaOfImprovement !== undefined
            ? { areaOfImprovement: dto.areaOfImprovement ?? null }
            : {}),
        },
      });
    }

    if (dto.answers && dto.answers.length > 0) {
      await this.upsertAnswers(audit.id, dto.answers);
    }

    if (dto.sectionRemarks && dto.sectionRemarks.length > 0) {
      await this.applySectionRemarks(audit.id, dto.sectionRemarks);
    }

    // Auto-promote a DRAFT to IN_PROGRESS on the first meaningful save —
    // either the supervisor explicitly signalled `start`, or they sent
    // an answer / section remark. Pure header-only edits leave a draft
    // alone so the supervisor can keep tinkering before it's "started".
    const touchedScorecard =
      (dto.answers && dto.answers.length > 0) ||
      (dto.sectionRemarks && dto.sectionRemarks.length > 0);

    if (
      audit.status === AuditStatus.DRAFT &&
      (dto.start === true || touchedScorecard)
    ) {
      await this.transitionStatus(audit.id, audit.status, AuditStatus.IN_PROGRESS);
    }

    await this.recomputeAndPersistScore(audit.id);

    return this.getById(audit.id, actor);
  }

  // -------------------------------------------------------------------
  //  SUBMIT
  // -------------------------------------------------------------------

  async submit(
    id: number,
    actor: AuthorizedActor,
    dto: SubmitAuditDto,
  ): Promise<AuditDetailResponse> {
    const audit = await this.requireAuditForEdit(id, actor);

    if (!audit.scorecardTemplateId) {
      throw new BadRequestException(
        "A scorecard must be selected before submitting",
      );
    }

    if (dto.overallComment !== undefined) {
      await this.prisma.audit.update({
        where: { id: audit.id },
        data: { overallComment: dto.overallComment ?? null },
      });
    }

    // Persist ACPT fields when any are present in the submit payload.
    if (
      dto.acptCategory !== undefined ||
      dto.acptLevel2 !== undefined ||
      dto.acptLevel3 !== undefined
    ) {
      await this.prisma.audit.update({
        where: { id: audit.id },
        data: {
          ...(dto.acptCategory !== undefined
            ? { acptCategory: dto.acptCategory ?? null }
            : {}),
          ...(dto.acptLevel2 !== undefined
            ? { acptLevel2: dto.acptLevel2 ?? null }
            : {}),
          ...(dto.acptLevel3 !== undefined
            ? { acptLevel3: dto.acptLevel3 ?? null }
            : {}),
        },
      });
    }

    // Persist audit-level qualitative notes.
    if (dto.callObservation !== undefined || dto.areaOfImprovement !== undefined) {
      await this.prisma.audit.update({
        where: { id: audit.id },
        data: {
          ...(dto.callObservation !== undefined
            ? { callObservation: dto.callObservation ?? null }
            : {}),
          ...(dto.areaOfImprovement !== undefined
            ? { areaOfImprovement: dto.areaOfImprovement ?? null }
            : {}),
        },
      });
    }

    if (dto.answers && dto.answers.length > 0) {
      await this.upsertAnswers(audit.id, dto.answers);
    }
    if (dto.sectionRemarks && dto.sectionRemarks.length > 0) {
      await this.applySectionRemarks(audit.id, dto.sectionRemarks);
    }

    // Validate all required questions are answered.
    const questions = await this.prisma.auditQuestion.findMany({
      where: { auditId: audit.id, required: true },
      include: { answers: true },
    });
    const missing = questions.filter(
      (q) => !q.answers.length || isBlank(q.answers[0].value),
    );
    if (missing.length) {
      throw new BadRequestException(
        `Cannot submit: ${missing.length} required question(s) unanswered`,
      );
    }

    await this.recomputeAndPersistScore(audit.id);

    await this.transitionStatus(audit.id, audit.status, AuditStatus.SUBMITTED);

    await this.prisma.audit.update({
      where: { id: audit.id },
      data: { submittedAt: new Date() },
    });

    return this.getById(audit.id, actor);
  }

  // -------------------------------------------------------------------
  //  REOPEN
  // -------------------------------------------------------------------

  async reopen(
    id: number,
    actor: AuthorizedActor,
    _dto: ReopenAuditDto,
  ): Promise<AuditDetailResponse> {
    const audit = await this.prisma.audit.findUnique({ where: { id } });
    if (!audit) throw new NotFoundException("Audit not found");

    if (actor.role !== Role.SUPERVISOR || audit.supervisorId !== actor.id) {
      throw new ForbiddenException("Only the audit's supervisor can re-open it");
    }

    // Only SUBMITTED audits can be re-opened. Once an audit is PUBLISHED
    // it is locked — the supervisor cannot pull it back from the agent.
    if (audit.status !== AuditStatus.SUBMITTED) {
      throw new BadRequestException(
        "Only submitted audits can be re-opened. Published audits are immutable.",
      );
    }

    await this.transitionStatus(audit.id, audit.status, AuditStatus.IN_PROGRESS);
    await this.prisma.audit.update({
      where: { id: audit.id },
      data: { submittedAt: null },
    });

    return this.getById(audit.id, actor);
  }

  // -------------------------------------------------------------------
  //  PUBLISH
  // -------------------------------------------------------------------

  /**
   * Publish a SUBMITTED audit so the agent can see it. Locks the audit
   * for everyone — no further answer / score / header edits allowed,
   * and the audit cannot be re-opened. The agent's acknowledgement
   * (handled by `AgentAuditsService.acknowledge`) is the only state
   * change permitted afterwards.
   */
  async publish(
    id: number,
    actor: AuthorizedActor,
  ): Promise<AuditDetailResponse> {
    const audit = await this.prisma.audit.findUnique({ where: { id } });
    if (!audit) throw new NotFoundException("Audit not found");

    if (actor.role !== Role.SUPERVISOR || audit.supervisorId !== actor.id) {
      throw new ForbiddenException(
        "Only the audit's supervisor can publish it",
      );
    }

    if (audit.status !== AuditStatus.SUBMITTED) {
      throw new BadRequestException(
        "Only submitted audits can be published. Submit the audit first.",
      );
    }

    // Recompute and persist scores one last time so what the agent sees
    // is exactly what was scored at publish time.
    await this.recomputeAndPersistScore(audit.id);

    await this.transitionStatus(
      audit.id,
      audit.status,
      AuditStatus.PUBLISHED,
    );

    await this.prisma.audit.update({
      where: { id: audit.id },
      data: {
        publishedAt: new Date(),
        publishedById: actor.id,
      },
    });

    return this.getById(audit.id, actor);
  }

  // -------------------------------------------------------------------
  //  READ
  // -------------------------------------------------------------------

  async list(
    actor: AuthorizedActor,
    filter: ListFilter = {},
  ): Promise<AuditListItem[]> {
    const supervisorScope =
      actor.role === Role.SUPERVISOR ? { supervisorId: actor.id } : {};

    // Agents can only ever see their own audits, regardless of `filter.agentId`.
    const agentIdFilter =
      actor.role === Role.AGENT ? actor.id : filter.agentId;

    const rows = await this.prisma.audit.findMany({
      where: {
        ...supervisorScope,
        status: filter.status,
        agentId: agentIdFilter,
        projectId: filter.projectId,
        groupNameSnapshot: filter.groupName,
        // Soft-deleted audits are hidden from every list path. There's
        // no admin "trash" view today; if one is added later it should
        // explicitly opt-in by passing `{ deletedAt: { not: null } }`.
        deletedAt: null,
      },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        agent: { select: { id: true, name: true, username: true } },
        supervisor: { select: { id: true, name: true, username: true } },
        project: {
          select: { id: true, projectName: true, groupName: true },
        },
      },
    });

    return rows.map(toListItem);
  }

  async getById(
    id: number,
    actor: AuthorizedActor,
  ): Promise<AuditDetailResponse> {
    const row = await this.prisma.audit.findUnique({
      where: { id },
      include: {
        agent: { select: { id: true, name: true, username: true } },
        supervisor: { select: { id: true, name: true, username: true } },
        project: { select: { id: true, projectName: true, groupName: true } },
        sections: {
          orderBy: { position: "asc" },
        },
        answers: true,
      },
    });
    if (!row) throw new NotFoundException("Audit not found");
    if (row.deletedAt) {
      // Hide soft-deleted audits as if they didn't exist — keeps the
      // discard surface a clean "remove from view" without leaking
      // 410 Gone semantics that callers don't currently handle.
      throw new NotFoundException("Audit not found");
    }

    // Authorization: supervisor must own it; agent may only view their own
    // and only once it's PUBLISHED or REVIEWED (audit visibility rule).
    if (actor.role === Role.SUPERVISOR && row.supervisorId !== actor.id) {
      throw new ForbiddenException("Not your audit");
    }
    if (actor.role === Role.AGENT) {
      if (row.agentId !== actor.id) {
        throw new ForbiddenException("Not your audit");
      }
      if (!AGENT_VISIBLE_STATUSES.includes(row.status as AuditStatus)) {
        throw new ForbiddenException("Audit not yet released");
      }
    }

    const questions = await this.prisma.auditQuestion.findMany({
      where: { auditId: id },
      orderBy: [{ sectionId: "asc" }, { position: "asc" }],
    });

    const answersByQuestion = new Map<number, (typeof row.answers)[number]>();
    for (const a of row.answers) answersByQuestion.set(a.questionId, a);

    const sectionResponses: AuditSectionResponse[] = row.sections.map(
      (section) => ({
        id: section.id,
        title: section.title,
        weight: section.weight,
        position: section.position,
        sectionScore: section.sectionScore,
        remark: section.remark,
        questions: questions
          .filter((q) => q.sectionId === section.id)
          .map<AuditQuestionResponse>((q) => {
            const ans = answersByQuestion.get(q.id) ?? null;
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
              options: parseOptionsForResponse(q.type as AuditQuestionType, q.optionsJson),
              answer: ans
                ? {
                    id: ans.id,
                    questionId: ans.questionId,
                    value: ans.value,
                    normalizedScore: ans.normalizedScore,
                    fatalHit: ans.fatalHit,
                    remark: ans.remark,
                  }
                : null,
            };
          }),
      }),
    );

    return {
      ...toListItem(row),
      overallComment: row.overallComment,
      scorecardTemplateId: row.scorecardTemplateId,
      sections: sectionResponses,
      supervisorCorrectionNote: row.supervisorCorrectionNote ?? null,
      callObservation: row.callObservation ?? null,
      areaOfImprovement: row.areaOfImprovement ?? null,
    };
  }

  // -------------------------------------------------------------------
  //  SCORECARDS — moved to ScorecardsService.
  //  This service no longer manages templates; see `apps/api/src/scorecards/`.
  // -------------------------------------------------------------------


  // -------------------------------------------------------------------
  //  Internals
  // -------------------------------------------------------------------

  private async generateAuditCode(): Promise<string> {
    const today = new Date();
    const ymd = `${today.getFullYear()}${pad2(today.getMonth() + 1)}${pad2(
      today.getDate(),
    )}`;

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const todayCount = await this.prisma.audit.count({
      where: { createdAt: { gte: todayStart } },
    });

    const seq = String(todayCount + 1).padStart(AUDIT_CODE_SUFFIX_LENGTH, "0");
    return `${AUDIT_CODE_PREFIX}-${ymd}-${seq}`;
  }

  /** Copy template into per-audit `AuditSection` + `AuditQuestion` rows. */
  private async materializeScorecard(
    auditId: number,
    template: TemplateWithSections,
  ) {
    // Wipe any prior materialization (idempotent — supports scorecard swap
    // before first answer is persisted).
    await this.prisma.auditAnswer.deleteMany({ where: { auditId } });
    await this.prisma.auditQuestion.deleteMany({ where: { auditId } });
    await this.prisma.auditSection.deleteMany({ where: { auditId } });

    for (const section of template.sections) {
      const createdSection = await this.prisma.auditSection.create({
        data: {
          auditId,
          sourceSectionId: section.id,
          title: section.title,
          weight: section.weight,
          position: section.position,
        },
      });

      for (const q of section.questions) {
        const baseData = {
          auditId,
          sectionId: createdSection.id,
          sourceQuestionId: q.id,
          prompt: q.prompt,
          helpText: q.helpText,
          type: q.type as AuditQuestionType,
          weight: q.weight,
          scoring: q.scoring,
          fatal: q.fatal,
          compliance: q.compliance,
          required: q.required,
          position: q.position,
        };

        await this.prisma.auditQuestion.create({
          data:
            q.optionsJson === null || q.optionsJson === undefined
              ? baseData
              : { ...baseData, optionsJson: q.optionsJson as never },
        });
      }
    }
  }

  /** Frozen JSON snapshot of the template — used for archival/UI fallback. */
  private snapshotTemplate(template: {
    id: number; name: string; groupName: string; sections: unknown[];
  }) {
    return JSON.parse(JSON.stringify({
      id: template.id,
      name: template.name,
      groupName: template.groupName,
      sections: template.sections,
      capturedAt: new Date().toISOString(),
    })) as never;
  }

  private async upsertAnswers(auditId: number, answers: AnswerInputDto[]) {
    const auditQuestions = await this.prisma.auditQuestion.findMany({
      where: { auditId },
      select: { id: true, sectionId: true },
    });
    const questionMap = new Map(auditQuestions.map((q) => [q.id, q.sectionId]));

    for (const a of answers) {
      const sectionId = questionMap.get(a.questionId);
      if (sectionId === undefined) {
        throw new BadRequestException(
          `Question ${a.questionId} does not belong to this audit`,
        );
      }

      await this.prisma.auditAnswer.upsert({
        where: {
          uniq_audit_question: { auditId, questionId: a.questionId },
        },
        create: {
          auditId,
          sectionId,
          questionId: a.questionId,
          value: a.value ?? null,
          remark: a.remark ?? null,
        },
        update: {
          value: a.value ?? null,
          ...(a.remark !== undefined ? { remark: a.remark } : {}),
        },
      });
    }
  }

  private async applySectionRemarks(
    auditId: number,
    remarks: SectionRemarkInputDto[],
  ) {
    for (const r of remarks) {
      const exists = await this.prisma.auditSection.findFirst({
        where: { id: r.sectionId, auditId },
        select: { id: true },
      });
      if (!exists) {
        throw new BadRequestException(
          `Section ${r.sectionId} does not belong to this audit`,
        );
      }
      await this.prisma.auditSection.update({
        where: { id: r.sectionId },
        data: { remark: r.remark ?? null },
      });
    }
  }

  private async transitionStatus(
    id: number,
    from: AuditStatus,
    to: AuditStatus,
  ): Promise<void> {
    const allowed = AUDIT_STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Illegal status transition: ${from} → ${to}`,
      );
    }
    await this.prisma.audit.update({
      where: { id },
      data: { status: to },
    });
  }

  private async requireAuditForEdit(id: number, actor: AuthorizedActor) {
    const audit = await this.prisma.audit.findUnique({ where: { id } });
    if (!audit) throw new NotFoundException("Audit not found");
    if (audit.deletedAt) {
      throw new NotFoundException("Audit not found");
    }

    if (actor.role !== Role.SUPERVISOR) {
      throw new ForbiddenException("Only supervisors can edit audits");
    }
    if (audit.supervisorId !== actor.id) {
      throw new ForbiddenException("Not your audit");
    }
    if (
      AUDIT_IMMUTABLE_STATUSES.includes(audit.status as AuditStatus)
    ) {
      throw new BadRequestException(
        `Audit is ${audit.status} — published audits are immutable`,
      );
    }
    if (audit.status === AuditStatus.SUBMITTED) {
      throw new BadRequestException(
        `Audit is SUBMITTED — re-open it before editing`,
      );
    }

    return audit;
  }

  // -------------------------------------------------------------------
  //  CORRECTION NOTE (safe post-publish supervisor edit)
  // -------------------------------------------------------------------

  /**
   * Append (or clear) a supervisor correction note on a PUBLISHED /
   * REVIEWED audit. This is the SAFE alternative to direct editing —
   * the score, answers, and overall comment stay locked. The note is a
   * separate append-only field surfaced alongside the original audit so
   * the agent / supervisor can record context after the fact (e.g.
   * "agent's dispute is invalid because X").
   *
   * Allowed states:
   *   - PUBLISHED: supervisor can add / update / clear the note
   *   - REVIEWED:  same — agent has already acknowledged but the
   *                supervisor may still add follow-up context
   *   - DRAFT / IN_PROGRESS / SUBMITTED: rejected; use the regular
   *                edit path before publishing instead.
   *   - COMPLETED: legacy, immutable.
   */
  async setCorrectionNote(
    id: number,
    actor: AuthorizedActor,
    dto: CorrectionNoteDto,
  ): Promise<AuditDetailResponse> {
    const audit = await this.prisma.audit.findUnique({ where: { id } });
    if (!audit || audit.deletedAt) {
      throw new NotFoundException("Audit not found");
    }

    if (actor.role !== Role.SUPERVISOR || audit.supervisorId !== actor.id) {
      throw new ForbiddenException(
        "Only the audit's supervisor can edit the correction note",
      );
    }

    const status = audit.status as AuditStatus;
    if (
      status !== AuditStatus.PUBLISHED &&
      status !== AuditStatus.REVIEWED
    ) {
      throw new BadRequestException(
        `Correction notes are only allowed on published or reviewed audits (current: ${status}).`,
      );
    }

    const next = dto.note === undefined ? null : dto.note;
    await this.prisma.audit.update({
      where: { id: audit.id },
      data: { supervisorCorrectionNote: next },
    });

    return this.getById(audit.id, actor);
  }

  // -------------------------------------------------------------------
  //  DISCARD
  // -------------------------------------------------------------------

  /**
   * Soft-delete a DRAFT or IN_PROGRESS audit. Sets `deletedAt` /
   * `deletedById` so the row stays in MySQL for audit-trail purposes
   * but every subsequent list / detail query treats it as gone.
   *
   * Allowed only for the audit's own supervisor. Already-SUBMITTED
   * audits must be re-opened first; PUBLISHED / REVIEWED / COMPLETED
   * audits can never be discarded — the immutability promise extends
   * to the discard surface as well.
   */
  async discard(id: number, actor: AuthorizedActor): Promise<void> {
    const audit = await this.prisma.audit.findUnique({ where: { id } });
    if (!audit || audit.deletedAt) {
      throw new NotFoundException("Audit not found");
    }
    if (actor.role !== Role.SUPERVISOR || audit.supervisorId !== actor.id) {
      throw new ForbiddenException(
        "Only the audit's supervisor can discard it",
      );
    }
    const status = audit.status as AuditStatus;
    if (
      status !== AuditStatus.DRAFT &&
      status !== AuditStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        `Only draft or in-progress audits can be discarded (current: ${status}).`,
      );
    }
    await this.prisma.audit.update({
      where: { id: audit.id },
      data: {
        deletedAt: new Date(),
        deletedById: actor.id,
      },
    });
  }

  private async recomputeAndPersistScore(auditId: number) {
    const sections = await this.prisma.auditSection.findMany({
      where: { auditId },
      orderBy: { position: "asc" },
    });
    const questions = await this.prisma.auditQuestion.findMany({
      where: { auditId },
    });
    const answers = await this.prisma.auditAnswer.findMany({
      where: { auditId },
    });

    const result = this.score.computeAudit(
      sections.map((s) => ({
        id: s.id,
        weight: s.weight,
        questions: questions
          .filter((q) => q.sectionId === s.id)
          .map((q) => ({
            id: q.id,
            type: q.type as AuditQuestionType,
            weight: q.weight,
            scoring: q.scoring,
            fatal: q.fatal,
            optionsJson: q.optionsJson,
          })),
      })),
      answers.map((a) => ({ questionId: a.questionId, value: a.value })),
    );

    // Persist section scores
    for (const sec of result.sections) {
      await this.prisma.auditSection.update({
        where: { id: sec.sectionId },
        data: { sectionScore: sec.score },
      });
    }

    // Persist answer normalized scores
    for (const ans of result.answers) {
      const existing = answers.find((a) => a.questionId === ans.questionId);
      if (!existing) continue;
      await this.prisma.auditAnswer.update({
        where: { id: existing.id },
        data: {
          normalizedScore: ans.normalizedScore,
          fatalHit: ans.fatalHit,
        },
      });
    }

    await this.prisma.audit.update({
      where: { id: auditId },
      data: {
        totalScore: result.totalScore,
        applicablePoints: result.applicablePoints,
        finalScore: result.finalScore,
        fatalTriggered: result.fatalTriggered,
      },
    });
  }
}

// =====================================================================
//  Helpers
// =====================================================================

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isBlank(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim() === "";
}

function toListItem(row: {
  id: number;
  auditCode: string;
  status: AuditStatus | string;
  callReference: string;
  groupNameSnapshot: string;
  projectNameSnapshot: string;
  totalScore: number | null;
  applicablePoints?: number | null;
  finalScore: number | null;
  fatalTriggered: boolean;
  acknowledged: boolean;
  acknowledgmentMode?: string | null;
  acknowledgmentRemark?: string | null;
  acptCategory?: string | null;
  acptLevel2?: string | null;
  acptLevel3?: string | null;
  callObservation?: string | null;
  areaOfImprovement?: string | null;
  agent: { id: string; name: string; username: string };
  supervisor: { id: string; name: string; username: string };
  project: { id: number; projectName: string; groupName: string };
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  publishedAt: Date | null;
  reviewedAt: Date | null;
  completedAt: Date | null;
}): AuditListItem {
  return {
    id: row.id,
    auditCode: row.auditCode,
    status: row.status as AuditStatus,
    callReference: row.callReference,
    groupNameSnapshot: row.groupNameSnapshot,
    projectNameSnapshot: row.projectNameSnapshot,
    totalScore: row.totalScore,
    applicablePoints: row.applicablePoints ?? null,
    finalScore: row.finalScore,
    fatalTriggered: row.fatalTriggered,
    agent: row.agent,
    supervisor: row.supervisor,
    project: row.project,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    submittedAt: row.submittedAt,
    publishedAt: row.publishedAt,
    reviewedAt: row.reviewedAt,
    acknowledged: row.acknowledged,
    acknowledgmentMode: row.acknowledgmentMode ?? null,
    acknowledgmentRemark: row.acknowledgmentRemark ?? null,
    completedAt: row.completedAt,
    acptCategory: row.acptCategory ?? null,
    acptLevel2: row.acptLevel2 ?? null,
    acptLevel3: row.acptLevel3 ?? null,
    callObservation: row.callObservation ?? null,
    areaOfImprovement: row.areaOfImprovement ?? null,
  };
}

/**
 * Convert the raw DB optionsJson into the public response shape.
 *  - MULTIPLE_CHOICE → list of {label, score}
 *  - RATING          → list of synthesized {label, score} for the scale
 *  - YES_NO          → null (UI knows the options)
 *  - FREE_TEXT       → null
 */
function parseOptionsForResponse(
  type: AuditQuestionType,
  raw: unknown,
): { label: string; score: number }[] | null {
  if (type === AuditQuestionType.MULTIPLE_CHOICE && Array.isArray(raw)) {
    return raw.flatMap((row) => {
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
  }
  if (type === AuditQuestionType.RATING) {
    const scale =
      raw &&
      typeof raw === "object" &&
      typeof (raw as { scale: unknown }).scale === "number"
        ? (raw as { scale: number }).scale
        : 5;
    return Array.from({ length: scale }, (_, i) => ({
      label: String(i + 1),
      score: i + 1,
    }));
  }
  return null;
}
