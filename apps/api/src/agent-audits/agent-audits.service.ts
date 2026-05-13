import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "../auth/role.enum";
import { AuditsService } from "../audits/audits.service";
import {
  AGENT_VISIBLE_STATUSES,
  AUDIT_STATUS_TRANSITIONS,
  AuditStatus,
} from "../audits/audit-status.enum";
import type { AcknowledgeAuditDto } from "./dto/acknowledge.dto";
import type {
  AgentAuditDetail,
  AgentAuditListItem,
  AgentSummary,
} from "./types";

/** Minimum length of a disagree remark. Keeps drive-by "no" responses out. */
const DISAGREE_REMARK_MIN = 5;

interface AuthorizedActor {
  id: string;
  role: Role;
}

@Injectable()
export class AgentAuditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditsService,
  ) {}

  // -------------------------------------------------------------------
  //  LIST
  // -------------------------------------------------------------------

  /**
   * List the agent's own audits. Backend filters by `agentId === actor.id`
   * AND by the agent-visible statuses (PUBLISHED / REVIEWED). Frontend
   * filtering is never trusted.
   */
  async list(actor: AuthorizedActor): Promise<AgentAuditListItem[]> {
    this.requireAgent(actor);

    const rows = await this.prisma.audit.findMany({
      where: {
        agentId: actor.id,
        status: { in: AGENT_VISIBLE_STATUSES },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      include: {
        agent: { select: { id: true, name: true, username: true } },
        supervisor: { select: { id: true, name: true, username: true } },
        project: {
          select: { id: true, projectName: true, groupName: true },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      auditCode: r.auditCode,
      status: r.status as AuditStatus,
      callReference: r.callReference,
      groupNameSnapshot: r.groupNameSnapshot,
      projectNameSnapshot: r.projectNameSnapshot,
      totalScore: r.totalScore,
      applicablePoints: r.applicablePoints ?? null,
      finalScore: r.finalScore,
      fatalTriggered: r.fatalTriggered,
      agent: r.agent,
      supervisor: r.supervisor,
      project: r.project,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      submittedAt: r.submittedAt,
      publishedAt: r.publishedAt,
      reviewedAt: r.reviewedAt,
      acknowledged: r.acknowledged,
      acknowledgmentMode: r.acknowledgmentMode ?? null,
      acknowledgmentRemark: r.acknowledgmentRemark ?? null,
      completedAt: r.completedAt,
      callObservation: r.callObservation ?? null,
      areaOfImprovement: r.areaOfImprovement ?? null,
      acptCategory: r.acptCategory ?? null,
      acptLevel2: r.acptLevel2 ?? null,
      acptLevel3: r.acptLevel3 ?? null,
    }));
  }

  // -------------------------------------------------------------------
  //  DETAIL
  // -------------------------------------------------------------------

  /**
   * Detail view for the agent. Delegates to `AuditsService.getById` which
   * already enforces:
   *   - ownership (`audit.agentId === actor.id`)
   *   - visibility (`status ∈ {PUBLISHED, REVIEWED}`)
   *
   * We re-verify ownership here as defense-in-depth before passing through.
   */
  async getById(
    id: number,
    actor: AuthorizedActor,
  ): Promise<AgentAuditDetail> {
    this.requireAgent(actor);

    const row = await this.prisma.audit.findUnique({
      where: { id },
      select: { agentId: true },
    });
    if (!row) throw new NotFoundException("Audit not found");
    if (row.agentId !== actor.id) {
      throw new ForbiddenException("Not your audit");
    }

    return this.audits.getById(id, actor);
  }

  // -------------------------------------------------------------------
  //  ACKNOWLEDGE
  // -------------------------------------------------------------------

  /**
   * Acknowledge an audit. The agent must pick a stance:
   *
   *   - mode = "AGREED"    → accepts the audit; remark optional
   *   - mode = "DISAGREED" → disputes the audit; remark required
   *
   * Either way the audit moves PUBLISHED → REVIEWED and is marked
   * acknowledged. Acknowledgement does NOT mutate score / answers /
   * overall comment — the published audit stays immutable.
   */
  async acknowledge(
    id: number,
    actor: AuthorizedActor,
    dto: AcknowledgeAuditDto,
  ): Promise<AgentAuditDetail> {
    this.requireAgent(actor);

    const audit = await this.prisma.audit.findUnique({ where: { id } });
    if (!audit) throw new NotFoundException("Audit not found");

    if (audit.agentId !== actor.id) {
      throw new ForbiddenException("Not your audit");
    }

    if (audit.status === AuditStatus.REVIEWED) {
      throw new BadRequestException("Audit has already been acknowledged");
    }

    if (audit.status !== AuditStatus.PUBLISHED) {
      throw new BadRequestException(
        "Audit cannot be acknowledged in its current status",
      );
    }

    const allowed =
      AUDIT_STATUS_TRANSITIONS[audit.status as AuditStatus] ?? [];
    if (!allowed.includes(AuditStatus.REVIEWED)) {
      throw new BadRequestException(
        `Illegal status transition: ${audit.status} → REVIEWED`,
      );
    }

    const trimmedRemark = dto.remark?.trim() ?? "";

    if (dto.mode === "DISAGREED") {
      if (trimmedRemark.length < DISAGREE_REMARK_MIN) {
        throw new BadRequestException(
          `A remark of at least ${DISAGREE_REMARK_MIN} characters is required when disagreeing.`,
        );
      }
    }

    await this.prisma.audit.update({
      where: { id },
      data: {
        status: AuditStatus.REVIEWED,
        acknowledged: true,
        reviewedAt: new Date(),
        reviewedById: actor.id,
        acknowledgmentMode: dto.mode,
        acknowledgmentRemark: trimmedRemark.length > 0 ? trimmedRemark : null,
      },
    });

    return this.audits.getById(id, actor);
  }

  // -------------------------------------------------------------------
  //  SUMMARY
  // -------------------------------------------------------------------

  /**
   * Lightweight dashboard counters / averages for the agent home page.
   * Mirrors `AuditScoreService` semantics — `finalScore` is what the
   * agent sees on the call card, fatal triggers are counted from the
   * persisted `fatalTriggered` column.
   */
  async summary(actor: AuthorizedActor): Promise<AgentSummary> {
    this.requireAgent(actor);

    const rows = await this.prisma.audit.findMany({
      where: {
        agentId: actor.id,
        status: { in: AGENT_VISIBLE_STATUSES },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        finalScore: true,
        fatalTriggered: true,
        status: true,
        publishedAt: true,
      },
    });

    let scoreSum = 0;
    let scoreCount = 0;
    let fatalCount = 0;
    let publishedCount = 0;
    let reviewedCount = 0;

    for (const r of rows) {
      if (r.fatalTriggered) fatalCount += 1;
      if (r.status === AuditStatus.PUBLISHED) publishedCount += 1;
      if (r.status === AuditStatus.REVIEWED) reviewedCount += 1;
      if (typeof r.finalScore === "number") {
        scoreSum += r.finalScore;
        scoreCount += 1;
      }
    }

    const averageScore =
      scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null;

    const latest = rows[0];

    return {
      totalAudits: rows.length,
      publishedCount,
      reviewedCount,
      pendingReviewCount: publishedCount,
      fatalCount,
      averageScore,
      latestScore:
        latest && typeof latest.finalScore === "number"
          ? latest.finalScore
          : null,
      latestAuditAt:
        latest?.publishedAt instanceof Date
          ? latest.publishedAt.toISOString()
          : null,
    };
  }

  // -------------------------------------------------------------------
  //  Helpers
  // -------------------------------------------------------------------

  private requireAgent(actor: AuthorizedActor): void {
    if (actor.role !== Role.AGENT) {
      throw new ForbiddenException("Agent-only endpoint");
    }
  }
}
