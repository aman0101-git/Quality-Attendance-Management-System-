import { useMemo } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { cn, qualityLabel } from "@/lib/utils";
import { AuditQuestionType, type AuditDetail, type AuditQuestion } from "../types";
import type { AnswerDraftMap } from "./ScoreCardFiller";

interface LiveScorePanelProps {
  audit: AuditDetail;
  answers: AnswerDraftMap;
}

interface SectionPreview {
  id: number;
  title: string;
  pointsEarned: number;
  /** Sum of weights for YES + NO questions (applicable denominator). */
  applicablePoints: number;
  /** Sum of weights for N/A questions (excluded from denominator). */
  excludedPoints: number;
  /** Section score as a % over applicable questions only. */
  percent: number | null;
  answered: number;
  total: number;
  fatal: boolean;
}

interface AuditPreview {
  /** Sum of weights for passing (YES) questions. */
  earnedPoints: number | null;
  /** Sum of weights for YES + NO questions (applicable denominator). */
  applicablePoints: number | null;
  /** Sum of weights for N/A questions. */
  excludedPoints: number;
  /**
   * Raw percentage over applicable: earnedPoints / applicablePoints * 100.
   * Fatal-agnostic — shows the "real" score before the fatal override.
   */
  rawPct: number | null;
  /**
   * Final score: rawPct, but forced to 0 when any fatal parameter failed.
   */
  finalPct: number | null;
  fatal: boolean;
  sections: SectionPreview[];
  answeredCount: number;
  totalQuestions: number;
}

/**
 * Mirror of the backend's `AuditScoreService.computeAudit` — kept in lockstep
 * so the on-screen number always matches what the server will persist.
 *
 *   YES   answer → earns weight, counts in denominator
 *   NO    answer → earns 0,      counts in denominator
 *   N/A   answer → earns 0,      EXCLUDED from denominator
 *   FATAL answer → earns 0,      counts in denominator, AND forces
 *                  the audit's final score to 0 (Phase 2 — fatal is
 *                  now answer-driven, NO no longer zeros the audit)
 */
function previewScore(audit: AuditDetail, answers: AnswerDraftMap): AuditPreview {
  let totalEarned = 0;
  let totalApplicable = 0;
  let totalExcluded = 0;
  let fatalTriggered = false;
  let answeredCount = 0;
  let totalQuestions = 0;
  let applicableAnsweredCount = 0;

  const sections: SectionPreview[] = audit.sections.map((section) => {
    let sectionEarned = 0;
    let sectionApplicable = 0;
    let sectionExcluded = 0;
    let sectionFatal = false;
    let sectionAnswered = 0;

    for (const q of section.questions) {
      totalQuestions += 1;

      const draft = answers[q.id];
      const value = draft?.value ?? null;
      const isAnswered = value !== null && value !== "";
      if (isAnswered) sectionAnswered += 1;

      if (!q.scoring) continue;

      // N/A: excluded entirely from denominator and from fatal rule.
      if (isAnswered && isNA(q, value)) {
        sectionExcluded += q.weight;
        totalExcluded += q.weight;
        continue;
      }

      if (isAnswered) {
        applicableAnsweredCount += 1;
        sectionApplicable += q.weight;
        totalApplicable += q.weight;
      }

      const passed = isAnswered && isPass(q, value);
      const earned = passed ? q.weight : 0;

      // Phase 2 fatal rule (answer-driven): the audit goes fatal only
      // when the supervisor explicitly picks the FATAL chip. A plain
      // NO is just a zero — it no longer flips the audit-wide override.
      const fatalAnswer = isAnswered && isFatal(q, value);
      if (fatalAnswer) {
        fatalTriggered = true;
        sectionFatal = true;
      }

      sectionEarned += earned;
      totalEarned += earned;
    }

    answeredCount += sectionAnswered;

    const percent =
      sectionApplicable > 0
        ? Math.round((sectionEarned / sectionApplicable) * 1000) / 10
        : null;

    return {
      id: section.id,
      title: section.title,
      pointsEarned: sectionEarned,
      applicablePoints: sectionApplicable,
      excludedPoints: sectionExcluded,
      percent,
      answered: sectionAnswered,
      total: section.questions.length,
      fatal: sectionFatal,
    };
  });

  if (applicableAnsweredCount === 0) {
    return {
      earnedPoints: null,
      applicablePoints: null,
      excludedPoints: totalExcluded,
      rawPct: null,
      finalPct: null,
      fatal: fatalTriggered,
      sections,
      answeredCount,
      totalQuestions,
    };
  }

  const rawPct = Math.round((totalEarned / totalApplicable) * 1000) / 10;
  const finalPct = fatalTriggered ? 0 : rawPct;

  return {
    earnedPoints: totalEarned,
    applicablePoints: totalApplicable,
    excludedPoints: totalExcluded,
    rawPct,
    finalPct,
    fatal: fatalTriggered,
    sections,
    answeredCount,
    totalQuestions,
  };
}

/** True when a YES_NO question was answered N/A. */
function isNA(q: AuditQuestion, raw: string | null): boolean {
  if (!raw) return false;
  return q.type === AuditQuestionType.YES_NO && raw.toLowerCase() === "na";
}

/**
 * Phase 2 — true when a YES_NO question was answered FATAL.
 * Fatal is meaningful only on YES_NO questions; rating / MC / free-text
 * answers never flip the audit-wide fatal flag.
 */
function isFatal(q: AuditQuestion, raw: string | null): boolean {
  if (!raw) return false;
  return q.type === AuditQuestionType.YES_NO && raw.toLowerCase() === "fatal";
}

function isPass(q: AuditQuestion, raw: string | null): boolean {
  if (raw === null || raw === undefined || raw === "") return false;

  switch (q.type) {
    case AuditQuestionType.YES_NO:
      return raw.toLowerCase() === "yes";

    case AuditQuestionType.RATING: {
      const options = q.options ?? [];
      if (!options.length) return false;
      const max = Math.max(...options.map((o) => o.score));
      const n = Number(raw);
      if (!Number.isFinite(n)) return false;
      return n >= max;
    }

    case AuditQuestionType.MULTIPLE_CHOICE: {
      const options = q.options ?? [];
      const match = options.find(
        (o) => o.label.trim().toLowerCase() === raw.trim().toLowerCase(),
      );
      if (!match) return false;
      const max = Math.max(...options.map((o) => o.score));
      if (max <= 0) return false;
      return match.score >= max;
    }

    default:
      return false;
  }
}

const QUALITY_TONE: Record<"GOOD" | "AVERAGE" | "BAD", string> = {
  GOOD: "border-success/40 bg-success/15 text-success",
  AVERAGE: "border-warning/40 bg-warning/15 text-warning",
  BAD: "border-danger/40 bg-danger/15 text-danger",
};

export function LiveScorePanel({ audit, answers }: LiveScorePanelProps) {
  const preview = useMemo(() => previewScore(audit, answers), [audit, answers]);

  // "50 / 75 (66.7%)" — the canonical display format.
  const finalLabel = (() => {
    if (preview.finalPct === null) return "—";
    if (preview.applicablePoints === null) return `${preview.finalPct.toFixed(1)}%`;
    return `${preview.earnedPoints} / ${preview.applicablePoints} (${preview.finalPct.toFixed(1)}%)`;
  })();

  // Raw percentage is shown only when fatal forces the final to 0 so the
  // supervisor can still see the underlying earned percentage.
  const showRaw = preview.fatal && preview.rawPct !== null;
  const rawLabel =
    preview.rawPct === null
      ? "—"
      : preview.applicablePoints !== null
        ? `${preview.earnedPoints} / ${preview.applicablePoints} (${preview.rawPct.toFixed(1)}%)`
        : `${preview.rawPct.toFixed(1)}%`;

  // Operational quality label is a UI hint based on the *final* score.
  // Fatal triggers always read as BAD.
  const quality = qualityLabel(preview.finalPct, preview.fatal);

  return (
    <aside className="flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-4 shadow-elev-1">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          Live score
        </p>

        {/* Final + fatal status (the "decision number") */}
        <div className="mt-1 flex items-baseline gap-2">
          <p
            className={cn(
              "text-3xl font-semibold tracking-tight tabular-nums",
              preview.fatal ? "text-danger" : "text-fg",
            )}
          >
            {finalLabel}
          </p>
          <span className="text-[11px] text-fg-subtle">final</span>
        </div>

        {/* Raw score shown only when fatal override is active */}
        {showRaw && (
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-sm font-medium text-fg-muted tabular-nums">
              {rawLabel}
            </p>
            <span className="text-[11px] text-fg-subtle">raw (before fatal)</span>
          </div>
        )}

        {/* N/A exclusion hint */}
        {preview.excludedPoints > 0 && (
          <p className="mt-1 text-[10px] text-fg-subtle">
            {preview.excludedPoints} pts excluded (N/A)
          </p>
        )}

        {/* Status row: fatal badge or "all clear" hint, plus quality label */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {preview.fatal ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger">
              <ShieldAlert className="h-3 w-3" />
              Fatal triggered → final 0
            </span>
          ) : preview.answeredCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
              <ShieldCheck className="h-3 w-3" />
              No fatal hits
            </span>
          ) : null}
          {quality !== null && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                QUALITY_TONE[quality],
              )}
            >
              Quality · {quality}
            </span>
          )}
        </div>

        <p className="mt-2 text-xs text-fg-muted">
          {preview.answeredCount}/{preview.totalQuestions} parameters answered
        </p>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-1.5">
        {preview.sections.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-fg">{s.title}</p>
              <p className="text-[10px] text-fg-subtle">
                {s.answered}/{s.total} answered ·{" "}
                {s.pointsEarned}/{s.applicablePoints} pts
                {s.excludedPoints > 0 && ` · ${s.excludedPoints} excl.`}
              </p>
            </div>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                s.fatal ? "text-danger" : "text-fg-muted",
              )}
            >
              {s.percent === null ? "—" : `${s.percent.toFixed(0)}%`}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default LiveScorePanel;
