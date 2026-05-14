import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  AuditQuestionType,
  type AuditQuestion,
  type AuditSection,
} from "../types";

export interface AnswerDraft {
  value: string | null;
  remark?: string | null;
}

export type AnswerDraftMap = Record<number, AnswerDraft>;
/** @deprecated section-level remarks removed; kept for type compatibility during migration */
export type SectionRemarkMap = Record<number, string>;

interface ScoreCardFillerProps {
  sections: AuditSection[];
  answers: AnswerDraftMap;
  onAnswer: (questionId: number, value: string | null) => void;
  onAnswerRemark: (questionId: number, remark: string) => void;
  /** When true, all inputs are disabled — used for published audits. */
  readOnly?: boolean;
}

const fieldClass = cn(
  "h-9 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg",
  "placeholder:text-fg-subtle transition-colors",
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
);

/**
 * Compact, single-row scorecard. Each question is rendered as one row
 * with the prompt, the chip group (Yes / No / N/A or MC / rating), and
 * the question's weight. Remarks collapse into an expandable popover so
 * the visual rhythm stays tight even on long templates.
 *
 * The container assumes the parent caps its height (the wizard sticky
 * layout supplies that) — only the question list scrolls; the wizard
 * keeps its sidebars + step header fixed.
 */
export function ScoreCardFiller({
  sections,
  answers,
  onAnswer,
  onAnswerRemark,
  readOnly = false,
}: ScoreCardFillerProps) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          answers={answers}
          readOnly={readOnly}
          onAnswer={onAnswer}
          onAnswerRemark={onAnswerRemark}
        />
      ))}
    </div>
  );
}

function SectionBlock(props: {
  section: AuditSection;
  answers: AnswerDraftMap;
  readOnly: boolean;
  onAnswer: (questionId: number, value: string | null) => void;
  onAnswerRemark: (questionId: number, remark: string) => void;
}) {
  const { section, answers, readOnly } = props;

  const answeredCount = useMemo(
    () =>
      section.questions.filter((q) => {
        const draft = answers[q.id];
        return draft && draft.value !== null && draft.value !== "";
      }).length,
    [section.questions, answers],
  );

  const total = section.questions.length;
  // Phase 2 fatal detection — answer-driven. A section flips to fatal
  // only when at least one question is explicitly answered FATAL.
  const sectionFatalHit = useMemo(
    () =>
      section.questions.some((q) => {
        const v = answers[q.id]?.value ?? null;
        return v === "fatal";
      }),
    [section.questions, answers],
  );

  return (
    <section className="rounded-lg border border-border bg-surface shadow-elev-1">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-border bg-surface/95 px-4 py-2 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{section.title}</p>
          <p className="text-[11px] text-fg-subtle">
            {answeredCount}/{total} answered · weight {section.weight}
            {sectionFatalHit && (
              <>
                {" "}
                ·{" "}
                <span className="text-danger">fatal triggered</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {typeof section.sectionScore === "number" && (
            <StatusBadge tone={sectionFatalHit ? "danger" : "info"}>
              {section.sectionScore.toFixed(0)}%
            </StatusBadge>
          )}
        </div>
      </header>

      <div className="divide-y divide-border">
        {section.questions.map((q) => (
          <QuestionRow
            key={q.id}
            question={q}
            draft={answers[q.id]}
            readOnly={readOnly}
            onAnswer={props.onAnswer}
            onAnswerRemark={props.onAnswerRemark}
          />
        ))}
      </div>
    </section>
  );
}

function QuestionRow({
  question,
  draft,
  readOnly,
  onAnswer,
  onAnswerRemark,
}: {
  question: AuditQuestion;
  draft?: AnswerDraft;
  readOnly: boolean;
  onAnswer: (questionId: number, value: string | null) => void;
  onAnswerRemark: (questionId: number, remark: string) => void;
}) {
  const value = draft?.value ?? "";
  const remark = draft?.remark ?? "";
  const [remarkOpen, setRemarkOpen] = useState(remark.length > 0);

  // Phase 2: fatal is now ANSWER-DRIVEN. The chip group has an explicit
  // FATAL option — a plain NO is no longer treated as a fatal miss.
  // The legacy `question.fatal` template attribute still tags the row
  // with a "Fatal" pill so the supervisor knows the question can carry
  // a fatal verdict, but only the explicit FATAL answer trips the
  // audit-wide warning + zero override.
  const fatalHit = value === "fatal";

  return (
    <div className="px-4 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
        {/* Prompt + indicators */}
        <div className="min-w-0">
          <div className="flex items-start gap-1.5">
            <p className="truncate text-sm text-fg" title={question.prompt}>
              {question.prompt}
              {question.required && <span className="ml-0.5 text-danger">*</span>}
            </p>
            {question.fatal && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-danger">
                <ShieldAlert className="h-2.5 w-2.5" />
                Fatal
              </span>
            )}
            {question.compliance && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-warning">
                <AlertTriangle className="h-2.5 w-2.5" />
                Compl.
              </span>
            )}
          </div>
          {question.helpText && (
            <p className="mt-0.5 truncate text-[11px] text-fg-subtle">
              {question.helpText}
            </p>
          )}
        </div>

        {/* Answer chips */}
        <AnswerInput
          question={question}
          value={value}
          readOnly={readOnly}
          onChange={(next) => onAnswer(question.id, next)}
        />

        {/* Weight + remark toggle */}
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-fg-subtle">
          <span className="tabular-nums">w {question.weight}</span>
          <button
            type="button"
            onClick={() => setRemarkOpen((s) => !s)}
            title={remark ? "Edit remark" : "Add remark"}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
              remark
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-bg-elevated text-fg-muted hover:bg-bg-muted hover:text-fg",
            )}
          >
            {remarkOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : remark ? (
              <MessageSquare className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {fatalHit && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-danger">
          <ShieldAlert className="h-3 w-3" />
          Fatal failure — final score will be forced to 0.
        </p>
      )}

      {remarkOpen && (
        <div className="mt-2">
          <input
            value={remark}
            onChange={(e) => onAnswerRemark(question.id, e.target.value)}
            placeholder="Remark (optional)…"
            disabled={readOnly}
            className={cn(
              "h-8 w-full rounded-md border border-border bg-bg-elevated px-3 text-xs text-fg",
              "placeholder:text-fg-subtle focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
              readOnly && "cursor-not-allowed opacity-70",
            )}
          />
        </div>
      )}
    </div>
  );
}

function AnswerInput({
  question,
  value,
  readOnly,
  onChange,
}: {
  question: AuditQuestion;
  value: string;
  readOnly: boolean;
  onChange: (next: string | null) => void;
}) {
  const ro = readOnly ? "cursor-not-allowed opacity-70" : "";

  if (question.type === AuditQuestionType.YES_NO) {
    // Phase 2: four-way YES / NO / N/A / FATAL.
    //
    //   YES   → green  (full credit)
    //   NO    → red    (zero, no audit-wide effect)
    //   N/A   → yellow (excluded from denominator)
    //   FATAL → deep red, warning icon (forces final score to 0)
    //
    // FATAL gets a distinct destructive treatment so it can never be
    // confused with NO at a glance — the visual weight signals "this
    // call has a critical failure and the whole audit goes to zero".
    return (
      <div className="flex shrink-0 items-center gap-1">
        {(["yes", "no", "na", "fatal"] as const).map((opt) => {
          const active = value === opt;
          const activeClass =
            opt === "yes"
              ? "border-success/40 bg-success/15 text-success"
              : opt === "no"
                ? "border-danger/40 bg-danger/15 text-danger"
                : opt === "na"
                  ? "border-warning/40 bg-warning/15 text-warning"
                  : // FATAL — destructive treatment, slightly stronger than NO
                    "border-danger/60 bg-danger text-white shadow-elev-1";
          // FATAL inactive state nudges users away from clicking it
          // accidentally by using a hairline outline + alarm icon.
          const inactiveClass =
            opt === "fatal"
              ? "border-danger/30 bg-surface text-danger hover:bg-danger/10"
              : "border-border bg-surface text-fg-muted hover:bg-bg-muted";
          const label =
            opt === "na" ? "N/A" : opt === "fatal" ? "FATAL" : opt;
          return (
            <button
              key={opt}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(active ? null : opt)}
              title={
                opt === "fatal"
                  ? "Fatal — final audit score is forced to 0"
                  : undefined
              }
              className={cn(
                "inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                opt === "fatal" ? "min-w-[56px]" : "min-w-[42px]",
                active ? activeClass : inactiveClass,
                ro,
              )}
            >
              {opt === "fatal" && (
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              )}
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === AuditQuestionType.MULTIPLE_CHOICE) {
    const options = question.options ?? [];
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {options.map((o) => {
          const active = value === o.label;
          return (
            <button
              key={o.label}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(active ? null : o.label)}
              className={cn(
                "h-7 rounded-md border px-2 text-[11px] font-medium transition-colors",
                active
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-border bg-surface text-fg-muted hover:bg-bg-muted",
                ro,
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === AuditQuestionType.RATING) {
    const options = question.options ?? [];
    return (
      <div className="flex shrink-0 items-center gap-1">
        {options.map((o) => {
          const active = value === String(o.score);
          return (
            <button
              key={o.score}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(active ? null : String(o.score))}
              className={cn(
                "h-7 w-7 rounded-md border text-[11px] font-medium transition-colors",
                active
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-border bg-surface text-fg-muted hover:bg-bg-muted",
                ro,
              )}
            >
              {o.score}
            </button>
          );
        })}
      </div>
    );
  }

  // FREE_TEXT — keep inline but compact
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Notes…"
      disabled={readOnly}
      className={cn(
        "h-7 w-56 rounded-md border border-border bg-bg-elevated px-2 text-xs text-fg",
        "placeholder:text-fg-subtle focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
        ro,
      )}
    />
  );
}

export default ScoreCardFiller;
