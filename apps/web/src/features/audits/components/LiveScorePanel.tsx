import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
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
  pointsPossible: number;
  /** Section completion as %. Display-only — independent of overall total. */
  percent: number | null;
  answered: number;
  total: number;
  fatal: boolean;
}

interface AuditPreview {
  /** Sum of weights for passing parameters (0..100). */
  total: number | null;
  /** Same as total, forced to 0 when any fatal parameter has not passed. */
  final: number | null;
  fatal: boolean;
  sections: SectionPreview[];
  answeredCount: number;
  totalQuestions: number;
}

/**
 * Mirror of the backend's `AuditScoreService.computeAudit` — kept in lockstep
 * so the on-screen number always matches what the server will persist.
 *
 *  - PASS  → +`weight` points
 *  - FAIL / N/A / unanswered → 0
 *  - any fatal that did not pass → final = 0
 */
function previewScore(audit: AuditDetail, answers: AnswerDraftMap): AuditPreview {
  let total = 0;
  let fatalTriggered = false;
  let answeredCount = 0;
  let totalQuestions = 0;

  const sections: SectionPreview[] = audit.sections.map((section) => {
    let sectionEarned = 0;
    let sectionPossible = 0;
    let sectionFatal = false;
    let sectionAnswered = 0;

    for (const q of section.questions) {
      totalQuestions += 1;

      const draft = answers[q.id];
      const value = draft?.value ?? null;
      const isAnswered = value !== null && value !== "";
      if (isAnswered) sectionAnswered += 1;

      if (!q.scoring) continue;

      const passed = isAnswered && isPass(q, value);
      const earned = passed ? q.weight : 0;

      const fatalMiss = q.fatal && !passed;
      if (fatalMiss) {
        fatalTriggered = true;
        sectionFatal = true;
      }

      sectionEarned += earned;
      sectionPossible += q.weight;
      total += earned;
    }

    answeredCount += sectionAnswered;

    const percent =
      sectionPossible > 0
        ? Math.round((sectionEarned / sectionPossible) * 1000) / 10
        : null;

    return {
      id: section.id,
      title: section.title,
      pointsEarned: sectionEarned,
      pointsPossible: sectionPossible,
      percent,
      answered: sectionAnswered,
      total: section.questions.length,
      fatal: sectionFatal,
    };
  });

  const totalRounded =
    answeredCount === 0 ? null : Math.round(total * 10) / 10;
  const final =
    totalRounded === null ? null : fatalTriggered ? 0 : totalRounded;

  return {
    total: totalRounded,
    final,
    fatal: fatalTriggered,
    sections,
    answeredCount,
    totalQuestions,
  };
}

function isPass(q: AuditQuestion, raw: string | null): boolean {
  if (raw === null || raw === undefined || raw === "") return false;

  switch (q.type) {
    case AuditQuestionType.YES_NO:
      return raw.toLowerCase() === "yes";

    case AuditQuestionType.RATING: {
      // The wizard's question payload uses `options` to expose the
      // rating scale as a list of {label,score}. PASS is the top score.
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

export function LiveScorePanel({ audit, answers }: LiveScorePanelProps) {
  const preview = useMemo(() => previewScore(audit, answers), [audit, answers]);

  const finalLabel =
    preview.final === null ? "—" : `${preview.final.toFixed(1)} / 100`;

  return (
    <aside className="sticky top-4 flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-4 shadow-elev-1">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          Live score
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <p
            className={cn(
              "text-3xl font-semibold tracking-tight",
              preview.fatal ? "text-danger" : "text-fg",
            )}
          >
            {finalLabel}
          </p>
          {preview.fatal && (
            <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger">
              <ShieldAlert className="h-3 w-3" />
              Fatal hit
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-fg-muted">
          {preview.answeredCount}/{preview.totalQuestions} parameters answered
          {preview.fatal && preview.total !== null && (
            <span className="text-fg-subtle">
              {" "}
              · raw {preview.total.toFixed(1)} / 100
            </span>
          )}
        </p>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-2">
        {preview.sections.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-fg">{s.title}</p>
              <p className="text-[10px] text-fg-subtle">
                {s.answered}/{s.total} answered ·{" "}
                {s.pointsEarned}/{s.pointsPossible} pts
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
