import { useMemo } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
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
export type SectionRemarkMap = Record<number, string>;

interface ScoreCardFillerProps {
  sections: AuditSection[];
  answers: AnswerDraftMap;
  sectionRemarks: SectionRemarkMap;
  onAnswer: (questionId: number, value: string | null) => void;
  onAnswerRemark: (questionId: number, remark: string) => void;
  onSectionRemark: (sectionId: number, remark: string) => void;
}

const fieldClass = cn(
  "h-9 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg",
  "placeholder:text-fg-subtle transition-colors",
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
);

export function ScoreCardFiller({
  sections,
  answers,
  sectionRemarks,
  onAnswer,
  onAnswerRemark,
  onSectionRemark,
}: ScoreCardFillerProps) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          answers={answers}
          sectionRemark={sectionRemarks[section.id] ?? ""}
          onAnswer={onAnswer}
          onAnswerRemark={onAnswerRemark}
          onSectionRemark={onSectionRemark}
        />
      ))}
    </div>
  );
}

function SectionBlock(props: {
  section: AuditSection;
  answers: AnswerDraftMap;
  sectionRemark: string;
  onAnswer: (questionId: number, value: string | null) => void;
  onAnswerRemark: (questionId: number, remark: string) => void;
  onSectionRemark: (sectionId: number, remark: string) => void;
}) {
  const { section, answers, sectionRemark } = props;

  const answeredCount = useMemo(
    () =>
      section.questions.filter((q) => {
        const draft = answers[q.id];
        return draft && draft.value !== null && draft.value !== "";
      }).length,
    [section.questions, answers],
  );

  return (
    <section className="rounded-lg border border-border bg-surface shadow-elev-1">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{section.title}</p>
          <p className="text-xs text-fg-subtle">
            Weight {section.weight} · {answeredCount}/{section.questions.length} answered
          </p>
        </div>
        <div className="flex items-center gap-2">
          {typeof section.sectionScore === "number" && (
            <StatusBadge tone="info">
              {section.sectionScore.toFixed(1)}%
            </StatusBadge>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        {section.questions.map((q) => (
          <QuestionRow
            key={q.id}
            question={q}
            draft={answers[q.id]}
            onAnswer={props.onAnswer}
            onAnswerRemark={props.onAnswerRemark}
          />
        ))}

        <div className="mt-1">
          <label className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">
            Section remark
          </label>
          <textarea
            rows={2}
            value={sectionRemark}
            onChange={(e) => props.onSectionRemark(section.id, e.target.value)}
            placeholder="Optional notes for this section…"
            className={cn(
              fieldClass,
              "mt-1 h-auto resize-none py-2 leading-relaxed",
            )}
          />
        </div>
      </div>
    </section>
  );
}

function QuestionRow({
  question,
  draft,
  onAnswer,
  onAnswerRemark,
}: {
  question: AuditQuestion;
  draft?: AnswerDraft;
  onAnswer: (questionId: number, value: string | null) => void;
  onAnswerRemark: (questionId: number, remark: string) => void;
}) {
  const value = draft?.value ?? "";
  const remark = draft?.remark ?? "";

  return (
    <div className="rounded-md border border-border bg-bg-elevated p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">
            {question.prompt}
            {question.required && <span className="ml-1 text-danger">*</span>}
          </p>
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
          {question.compliance && (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
              <AlertTriangle className="h-3 w-3" />
              Compliance
            </span>
          )}
          <span className="text-[11px] text-fg-subtle">w {question.weight}</span>
        </div>
      </div>

      <div className="mt-3">
        <AnswerInput
          question={question}
          value={value}
          onChange={(next) => onAnswer(question.id, next)}
        />
      </div>

      <div className="mt-2.5">
        <input
          value={remark}
          onChange={(e) => onAnswerRemark(question.id, e.target.value)}
          placeholder="Add a remark (optional)"
          className={fieldClass}
        />
      </div>
    </div>
  );
}

function AnswerInput({
  question,
  value,
  onChange,
}: {
  question: AuditQuestion;
  value: string;
  onChange: (next: string | null) => void;
}) {
  if (question.type === AuditQuestionType.YES_NO) {
    return (
      <div className="flex flex-wrap gap-2">
        {["yes", "no", "na"].map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? null : opt)}
              className={cn(
                "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                active
                  ? opt === "yes"
                    ? "border-success/40 bg-success/15 text-success"
                    : opt === "no"
                      ? "border-danger/40 bg-danger/15 text-danger"
                      : "border-border bg-bg-muted text-fg-muted"
                  : "border-border bg-surface text-fg-muted hover:bg-bg-muted",
              )}
            >
              {opt === "na" ? "N/A" : opt[0].toUpperCase() + opt.slice(1)}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === AuditQuestionType.MULTIPLE_CHOICE) {
    const options = question.options ?? [];
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.label;
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onChange(active ? null : o.label)}
              className={cn(
                "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                active
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-border bg-surface text-fg-muted hover:bg-bg-muted",
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
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === String(o.score);
          return (
            <button
              key={o.score}
              type="button"
              onClick={() => onChange(active ? null : String(o.score))}
              className={cn(
                "h-8 w-8 rounded-md border text-xs font-medium transition-colors",
                active
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-border bg-surface text-fg-muted hover:bg-bg-muted",
              )}
            >
              {o.score}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <textarea
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type the supervisor's notes…"
      className={cn(fieldClass, "h-auto resize-none py-2 leading-relaxed")}
    />
  );
}

export default ScoreCardFiller;
