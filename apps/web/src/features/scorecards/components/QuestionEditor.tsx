import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuditQuestionType } from "@/features/audits/types";
import type { QuestionInput } from "../types";

interface QuestionEditorProps {
  question: QuestionInput;
  index: number;
  total: number;
  onChange: (next: QuestionInput) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

const fieldClass = cn(
  "h-9 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg",
  "placeholder:text-fg-subtle transition-colors",
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
);

const labelClass = "text-[11px] font-medium text-fg-muted";

const TYPE_OPTIONS: { value: AuditQuestionType; label: string }[] = [
  { value: AuditQuestionType.YES_NO, label: "Yes / No" },
  { value: AuditQuestionType.MULTIPLE_CHOICE, label: "Multiple choice" },
  { value: AuditQuestionType.RATING, label: "Rating scale" },
  { value: AuditQuestionType.FREE_TEXT, label: "Free text" },
];

/**
 * Editor for a single question inside a section. Lets the admin set type,
 * weight, fatal/compliance flags, options (multiple choice), and the
 * rating scale (rating).
 */
export function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: QuestionEditorProps) {
  const update = (patch: Partial<QuestionInput>) =>
    onChange({ ...question, ...patch });

  return (
    <div className="rounded-md border border-border bg-bg-elevated p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          Question {index + 1}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move up"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-fg-muted hover:bg-bg-muted hover:text-fg disabled:opacity-40"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move down"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-fg-muted hover:bg-bg-muted hover:text-fg disabled:opacity-40"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove question"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-fg-muted hover:border-danger/30 hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className={labelClass}>Prompt</label>
          <input
            value={question.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
            placeholder="What did the agent do well or miss?"
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className={labelClass}>
            Help text <span className="text-fg-subtle">(optional)</span>
          </label>
          <input
            value={question.helpText ?? ""}
            onChange={(e) => update({ helpText: e.target.value })}
            placeholder="Guidance shown under the question for the supervisor."
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Type</label>
          <select
            value={question.type}
            onChange={(e) =>
              update({ type: e.target.value as AuditQuestionType })
            }
            className={cn(fieldClass, "appearance-none pr-8")}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Weight</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={question.weight ?? 1}
            onChange={(e) =>
              update({ weight: Number(e.target.value) || 0 })
            }
            className={fieldClass}
          />
        </div>

        {question.type === AuditQuestionType.MULTIPLE_CHOICE && (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label className={labelClass}>Options</label>
            <OptionsEditor
              value={question.options ?? []}
              onChange={(options) => update({ options })}
            />
          </div>
        )}

        {question.type === AuditQuestionType.RATING && (
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Rating scale (max)</label>
            <input
              type="number"
              min={2}
              max={10}
              value={question.ratingScale ?? 5}
              onChange={(e) =>
                update({ ratingScale: Number(e.target.value) || 5 })
              }
              className={fieldClass}
            />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Toggle
          label="Required"
          value={question.required ?? true}
          onChange={(v) => update({ required: v })}
        />
        <Toggle
          label="Scoring"
          value={question.scoring ?? true}
          onChange={(v) => update({ scoring: v })}
        />
        <Toggle
          tone="danger"
          label="Fatal"
          value={question.fatal ?? false}
          onChange={(v) => update({ fatal: v })}
        />
        <Toggle
          tone="warning"
          label="Compliance"
          value={question.compliance ?? false}
          onChange={(v) => update({ compliance: v })}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  tone = "accent",
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  tone?: "accent" | "danger" | "warning";
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors",
        value
          ? tone === "danger"
            ? "border-danger/40 bg-danger/15 text-danger"
            : tone === "warning"
              ? "border-warning/40 bg-warning/15 text-warning"
              : "border-accent/40 bg-accent/15 text-accent"
          : "border-border bg-surface text-fg-muted hover:bg-bg-muted",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          value
            ? tone === "danger"
              ? "bg-danger"
              : tone === "warning"
                ? "bg-warning"
                : "bg-accent"
            : "bg-fg-subtle",
        )}
      />
      {label}
    </button>
  );
}

function OptionsEditor({
  value,
  onChange,
}: {
  value: { label: string; score: number }[];
  onChange: (next: { label: string; score: number }[]) => void;
}) {
  const update = (idx: number, patch: Partial<{ label: string; score: number }>) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };
  const add = () => onChange([...value, { label: "", score: 0 }]);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-2">
      {value.length === 0 && (
        <p className="text-[11px] text-fg-subtle">
          Add at least 2 options for a multiple-choice question.
        </p>
      )}
      {value.map((opt, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2"
        >
          <input
            value={opt.label}
            onChange={(e) => update(idx, { label: e.target.value })}
            placeholder={`Option ${idx + 1} label`}
            className={cn(fieldClass, "flex-1")}
          />
          <input
            type="number"
            value={opt.score}
            onChange={(e) =>
              update(idx, { score: Number(e.target.value) || 0 })
            }
            className={cn(fieldClass, "w-20")}
            placeholder="Score"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            aria-label="Remove option"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-elevated text-fg-muted hover:border-danger/30 hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex h-8 items-center gap-1.5 self-start rounded-md border border-border bg-bg-elevated px-2.5 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
      >
        + Add option
      </button>
    </div>
  );
}

export default QuestionEditor;
