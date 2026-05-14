import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageSquareQuote,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import Modal from "@/components/ui/Modal";
import {
  cn,
  formatAuditScore,
  formatDateTime,
  formatDurationSeconds,
  qualityLabel,
} from "@/lib/utils";
import {
  acknowledgeAudit,
  getMyAuditById,
} from "@/features/agent-audits/api";
import type {
  AgentAuditDetail,
  AgentAuditQuestion,
  AgentAuditSection,
} from "@/features/agent-audits/types";
import AuditStatusBadge from "@/features/audits/components/AuditStatusBadge";
import { AuditStatus } from "@/features/audits/types";

const DISAGREE_REMARK_MIN = 5;

function scoreToneClass(value: number | null, fatal: boolean): string {
  if (fatal) return "text-danger";
  if (value === null) return "text-fg-muted";
  if (value >= 80) return "text-success";
  if (value >= 60) return "text-warning";
  return "text-danger";
}

/**
 * Map a question's recorded answer to a tri-state pass/fail/NA result
 * for the agent-side breakdown.
 *
 *   - YES → Pass  (normalizedScore === 1)
 *   - NO  → Fail  (normalizedScore === 0)
 *   - N/A → N/A   (value === "na" OR normalizedScore === null)
 *   - unanswered → N/A (no `answer` row, or blank value)
 *
 * This is presentation-only — it does NOT change the scoring engine.
 * Before this fix, N/A answers fell into the "passed === false" branch
 * because `normalizedScore === 1` is false when normalizedScore is
 * null, which incorrectly rendered them as "Fail" on the agent view.
 */
function isQuestionPassed(q: AgentAuditQuestion): boolean | null {
  if (!q.answer || q.answer.value === null || q.answer.value === "") {
    return null;
  }
  // YES_NO N/A answers are stored as the literal "na" string and the
  // server records normalizedScore = null (the score engine treats
  // them as non-scoring). Either signal is sufficient to render N/A.
  if (q.answer.value === "na" || q.answer.normalizedScore === null) {
    return null;
  }
  return q.answer.normalizedScore === 1;
}

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = Number(params.id);

  const [audit, setAudit] = useState<AgentAuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  const fetch = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      setError("Invalid audit id");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getMyAuditById(id);
      setAudit(data);
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const status = err.response?.status;
      if (status === 403) {
        setError("This audit isn't accessible. It may not have been published yet.");
      } else if (status === 404) {
        setError("Audit not found.");
      } else {
        setError("Could not load audit.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const [agreeBusy, setAgreeBusy] = useState(false);
  const [disagreeOpen, setDisagreeOpen] = useState(false);
  const [disagreeRemark, setDisagreeRemark] = useState("");
  const [disagreeBusy, setDisagreeBusy] = useState(false);

  const handleAgree = async () => {
    if (!audit) return;
    setAgreeBusy(true);
    setAcknowledging(true);
    try {
      const updated = await acknowledgeAudit(audit.id, { mode: "AGREED" });
      setAudit(updated);
      toast.success("Marked as reviewed — you agreed with the audit");
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not acknowledge audit");
    } finally {
      setAgreeBusy(false);
      setAcknowledging(false);
    }
  };

  const handleDisagreeSubmit = async () => {
    if (!audit) return;
    const trimmed = disagreeRemark.trim();
    if (trimmed.length < DISAGREE_REMARK_MIN) {
      toast.error(
        `Please provide at least ${DISAGREE_REMARK_MIN} characters explaining the reason.`,
      );
      return;
    }
    setDisagreeBusy(true);
    setAcknowledging(true);
    try {
      const updated = await acknowledgeAudit(audit.id, {
        mode: "DISAGREED",
        remark: trimmed,
      });
      setAudit(updated);
      setDisagreeOpen(false);
      setDisagreeRemark("");
      toast.success("Disagreement recorded — your supervisor will be notified");
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not record disagreement");
    } finally {
      setDisagreeBusy(false);
      setAcknowledging(false);
    }
  };

  const canAcknowledge = useMemo(
    () =>
      audit !== null &&
      audit.status === AuditStatus.PUBLISHED &&
      !audit.acknowledged,
    [audit],
  );

  if (loading) {
    return (
      <PageContainer maxWidth="xl">
        <AppCard padding="lg">
          <LoadingSkeleton rows={6} />
        </AppCard>
      </PageContainer>
    );
  }

  if (error || !audit) {
    return (
      <PageContainer maxWidth="xl">
        <EmptyState
          title={error ?? "Audit not available"}
          description="Head back to the list and pick a different one."
          action={
            <Link
              to="/agent/audits"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to my audits
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl">
      {/* ------- Header bar --------------------------------------------- */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/agent/audits")}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {canAcknowledge && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDisagreeOpen(true)}
              disabled={acknowledging}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-3 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
            >
              <ThumbsDown className="h-4 w-4" />
              Disagree
            </button>
            <button
              type="button"
              onClick={() => void handleAgree()}
              disabled={acknowledging}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md bg-success px-3 text-sm font-medium text-white",
                "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60",
              )}
            >
              {agreeBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsUp className="h-4 w-4" />
              )}
              Agree
            </button>
          </div>
        )}
      </div>

      {/* ------- Top summary -------------------------------------------- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <AppCard padding="md">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-fg">
                {audit.auditCode}
              </span>
              <AuditStatusBadge status={audit.status} />
              {audit.acknowledged && audit.acknowledgmentMode === "AGREED" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                  <ThumbsUp className="h-3 w-3" />
                  Agreed
                </span>
              )}
              {audit.acknowledged &&
                audit.acknowledgmentMode === "DISAGREED" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger">
                    <ThumbsDown className="h-3 w-3" />
                    Disagreed
                  </span>
                )}
              {audit.acknowledged && audit.acknowledgmentMode === null && (
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Acknowledged
                </span>
              )}
              {audit.fatalTriggered && (
                <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger">
                  <ShieldAlert className="h-3 w-3" />
                  Fatal triggered
                </span>
              )}
            </div>

            <h1 className="text-xl font-semibold tracking-tight text-fg">
              {audit.projectNameSnapshot}{" "}
              <span className="text-fg-subtle">/ {audit.groupNameSnapshot}</span>
            </h1>

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <KV label="Call reference" value={audit.callReference} />
              <KV label="Supervisor" value={audit.supervisor.name} />
              {audit.callDate && (
                <KV
                  label="Call date"
                  value={new Date(audit.callDate).toLocaleDateString()}
                />
              )}
              {audit.callDuration !== null && audit.callDuration !== undefined && (
                <KV
                  label="Call duration"
                  value={formatDurationSeconds(audit.callDuration)}
                />
              )}
              <KV label="Audit date" value={formatDateTime(audit.createdAt)} />
              <KV label="Published" value={formatDateTime(audit.publishedAt)} />
              {audit.reviewedAt && (
                <KV label="Reviewed" value={formatDateTime(audit.reviewedAt)} />
              )}
            </dl>
          </div>
        </AppCard>

        <AppCard padding="md">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
              Final score
            </p>
            <p
              className={cn(
                "text-4xl font-semibold tracking-tight tabular-nums",
                scoreToneClass(audit.finalScore, audit.fatalTriggered),
              )}
            >
              {formatAuditScore(audit.finalScore, audit.totalScore, audit.applicablePoints)}
            </p>
            {(() => {
              const q = qualityLabel(audit.finalScore, audit.fatalTriggered);
              if (q === null) return null;
              const tone =
                q === "GOOD"
                  ? "border-success/40 bg-success/15 text-success"
                  : q === "AVERAGE"
                    ? "border-warning/40 bg-warning/15 text-warning"
                    : "border-danger/40 bg-danger/15 text-danger";
              return (
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    tone,
                  )}
                >
                  Quality · {q}
                </span>
              );
            })()}
            {audit.fatalTriggered && audit.totalScore !== null && (
              <p className="text-xs text-fg-subtle">
                {audit.applicablePoints !== null
                  ? `Raw (before fatal): ${audit.totalScore} / ${audit.applicablePoints} (${((audit.totalScore / audit.applicablePoints) * 100).toFixed(1)}%)`
                  : `Raw score (before fatal): ${audit.totalScore.toFixed(1)}%`}
              </p>
            )}
            {audit.fatalTriggered && (
              <div className="mt-1 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5" />
                <span>
                  A fatal parameter was failed on this call, so the final score
                  is forced to zero. Review the parameters below for context.
                </span>
              </div>
            )}
            {!audit.fatalTriggered &&
              audit.status === AuditStatus.PUBLISHED && (
                <div className="mt-1 flex items-start gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5" />
                  <span>No fatal parameters were triggered on this call.</span>
                </div>
              )}
          </div>
        </AppCard>
      </div>

      {/* ------- Supervisor overall feedback ---------------------------- */}
      <AppCard padding="md" className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <MessageSquareQuote className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-fg">Supervisor feedback</p>
        </div>
        {audit.overallComment ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
            {audit.overallComment}
          </p>
        ) : (
          <p className="text-sm italic text-fg-subtle">
            Your supervisor did not leave an overall comment on this audit.
          </p>
        )}
      </AppCard>

      {/* ------- ACPT observations (if filled) ------------------------- */}
      {(audit.acptCategory || audit.acptLevel2 || audit.acptLevel3) && (
        <AppCard padding="md" className="mb-6">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            ACPT — call observations
          </p>
          <dl className="flex flex-col gap-3 text-sm">
            {audit.acptCategory && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                  Category
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-fg">
                  {audit.acptCategory}
                </dd>
              </div>
            )}
            {audit.acptLevel2 && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                  Level 2 — observations
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
                  {audit.acptLevel2}
                </dd>
              </div>
            )}
            {audit.acptLevel3 && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                  Level 3 — root cause / detail
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
                  {audit.acptLevel3}
                </dd>
              </div>
            )}
          </dl>
        </AppCard>
      )}

      {/* ------- Call notes (observation + area of improvement) ---------- */}
      {(audit.callObservation || audit.areaOfImprovement) && (
        <AppCard padding="md" className="mb-6">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            Call notes
          </p>
          <dl className="flex flex-col gap-4 text-sm">
            {audit.callObservation && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                  Call Observation
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
                  {audit.callObservation}
                </dd>
              </div>
            )}
            {audit.areaOfImprovement && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                  Area of Improvement
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
                  {audit.areaOfImprovement}
                </dd>
              </div>
            )}
          </dl>
        </AppCard>
      )}

      {/* ------- Supervisor correction note (post-publish) -------------- */}
      {audit.supervisorCorrectionNote && (
        <AppCard padding="md" className="mb-6 border-warning/30">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-sm font-semibold text-fg">
              Supervisor correction note
            </p>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
            {audit.supervisorCorrectionNote}
          </p>
          <p className="mt-2 text-[11px] text-fg-subtle">
            Added by your supervisor after publishing — the original audit
            is unchanged.
          </p>
        </AppCard>
      )}

      {/* ------- Agent's own disagreement remark (if any) --------------- */}
      {audit.acknowledgmentMode === "DISAGREED" &&
        audit.acknowledgmentRemark && (
          <AppCard padding="md" className="mb-6 border-danger/30">
            <div className="mb-2 flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-danger" />
              <p className="text-sm font-semibold text-fg">
                Your disagreement
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
              {audit.acknowledgmentRemark}
            </p>
          </AppCard>
        )}

      {/* ------- Section breakdown -------------------------------------- */}
      <div className="mb-6 flex flex-col gap-4">
        {audit.sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </div>

      {/* ------- Acknowledge banner ------------------------------------- */}
      {canAcknowledge && (
        <AppCard padding="md" className="border-accent/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">
                Acknowledge this audit
              </p>
              <p className="text-xs text-fg-subtle">
                Choose <span className="text-success">Agree</span> if you accept
                the feedback, or{" "}
                <span className="text-danger">Disagree</span> to record a reason
                why you dispute it. Either way the audit moves to Reviewed and
                your supervisor is notified.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDisagreeOpen(true)}
                disabled={acknowledging}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-3 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
              >
                <ThumbsDown className="h-4 w-4" />
                Disagree
              </button>
              <button
                type="button"
                onClick={() => void handleAgree()}
                disabled={acknowledging}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md bg-success px-3 text-sm font-medium text-white",
                  "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60",
                )}
              >
                {agreeBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="h-4 w-4" />
                )}
                Agree
              </button>
            </div>
          </div>
        </AppCard>
      )}

      {/* ------- Disagree remark modal ---------------------------------- */}
      <Modal
        open={disagreeOpen}
        onOpenChange={(open) => {
          if (!disagreeBusy) {
            setDisagreeOpen(open);
            if (!open) setDisagreeRemark("");
          }
        }}
        title="Disagree with this audit"
        description="Tell your supervisor why you dispute the feedback. The original audit isn't changed — your remark is recorded alongside it."
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setDisagreeOpen(false);
                setDisagreeRemark("");
              }}
              disabled={disagreeBusy}
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDisagreeSubmit()}
              disabled={
                disagreeBusy ||
                disagreeRemark.trim().length < DISAGREE_REMARK_MIN
              }
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md bg-danger px-3 text-sm font-medium text-white",
                "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60",
              )}
            >
              {disagreeBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsDown className="h-4 w-4" />
              )}
              Submit disagreement
            </button>
          </>
        }
      >
        <label className="text-xs font-medium text-fg-muted">
          Reason for disagreement
        </label>
        <textarea
          rows={5}
          value={disagreeRemark}
          onChange={(e) => setDisagreeRemark(e.target.value)}
          placeholder="Explain why you dispute the audit (minimum 5 characters)…"
          className={cn(
            "mt-1.5 w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-fg",
            "placeholder:text-fg-subtle leading-relaxed",
            "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
          )}
        />
        <p className="mt-1 text-[11px] text-fg-subtle">
          {disagreeRemark.trim().length}/1000 characters
          {disagreeRemark.trim().length < DISAGREE_REMARK_MIN && (
            <span className="ml-2 text-warning">
              minimum {DISAGREE_REMARK_MIN} characters
            </span>
          )}
        </p>
      </Modal>
    </PageContainer>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-fg">{value}</dd>
    </div>
  );
}

function SectionBlock({ section }: { section: AgentAuditSection }) {
  const earned = useMemo(
    () =>
      section.questions.reduce(
        (acc, q) =>
          acc + (q.answer && q.answer.normalizedScore === 1 ? q.weight : 0),
        0,
      ),
    [section.questions],
  );
  const possible = useMemo(
    () =>
      section.questions.reduce(
        (acc, q) => acc + (q.scoring ? q.weight : 0),
        0,
      ),
    [section.questions],
  );
  const completion = possible > 0 ? Math.round((earned / possible) * 100) : null;

  return (
    <section className="rounded-lg border border-border bg-surface shadow-elev-1">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{section.title}</p>
          <p className="text-xs text-fg-subtle">
            {earned} / {possible} pts
            {completion !== null && (
              <>
                {" "}
                · {completion}% completion
              </>
            )}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2.5 px-5 py-4">
        {section.questions.map((q) => (
          <QuestionRow key={q.id} question={q} />
        ))}

        {section.remark && (
          <div className="mt-2 rounded-md border border-border bg-bg-muted/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
              Section remark
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">
              {section.remark}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function QuestionRow({ question }: { question: AgentAuditQuestion }) {
  const passed = isQuestionPassed(question);
  const earned =
    passed === true ? question.weight : 0;
  const fatalHit = question.answer?.fatalHit ?? false;

  return (
    <div className="rounded-md border border-border bg-bg-elevated p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">{question.prompt}</p>
          {question.helpText && (
            <p className="mt-0.5 text-xs text-fg-subtle">{question.helpText}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {question.fatal && (
            <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger">
              <ShieldAlert className="h-3 w-3" />
              Fatal
            </span>
          )}
          {passed === true && (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
              <CheckCircle2 className="h-3 w-3" />
              Pass
            </span>
          )}
          {passed === false && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                fatalHit
                  ? "border-danger/40 bg-danger/15 text-danger"
                  : "border-warning/40 bg-warning/15 text-warning",
              )}
            >
              <XCircle className="h-3 w-3" />
              Fail
            </span>
          )}
          {passed === null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-muted px-2 py-0.5 text-[11px] font-medium text-fg-muted">
              N/A
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-fg-subtle">
        <span>
          Weight: <span className="text-fg-muted">{question.weight}</span>
        </span>
        <span>
          Earned:{" "}
          <span
            className={cn(
              "tabular-nums",
              passed === true ? "text-success" : "text-fg-muted",
            )}
          >
            {earned}
          </span>
        </span>
      </div>

      {question.answer?.remark && (
        <div className="mt-2 rounded-md border border-border bg-surface px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            Supervisor remark
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">
            {question.answer.remark}
          </p>
        </div>
      )}
    </div>
  );
}
