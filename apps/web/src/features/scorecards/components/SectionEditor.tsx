import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AuditQuestionType } from "@/features/audits/types";
import type { QuestionInput, SectionInput } from "../types";
import QuestionEditor from "./QuestionEditor";

interface SectionEditorProps {
  section: SectionInput;
  index: number;
  total: number;
  onChange: (next: SectionInput) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

const fieldClass = cn(
  "h-9 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg",
  "placeholder:text-fg-subtle transition-colors",
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
);

const labelClass = "text-[11px] font-medium text-fg-muted";

function emptyQuestion(): QuestionInput {
  return {
    prompt: "",
    helpText: "",
    type: AuditQuestionType.YES_NO,
    weight: 1,
    scoring: true,
    fatal: false,
    compliance: false,
    required: true,
  };
}

export function SectionEditor({
  section,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: SectionEditorProps) {
  const [collapsed, setCollapsed] = useState(false);

  const update = (patch: Partial<SectionInput>) =>
    onChange({ ...section, ...patch });

  const updateQuestion = (qIdx: number, next: QuestionInput) => {
    const questions = section.questions.slice();
    questions[qIdx] = next;
    onChange({ ...section, questions });
  };

  const moveQuestion = (qIdx: number, direction: -1 | 1) => {
    const target = qIdx + direction;
    if (target < 0 || target >= section.questions.length) return;
    const questions = section.questions.slice();
    [questions[qIdx], questions[target]] = [questions[target], questions[qIdx]];
    onChange({ ...section, questions });
  };

  const removeQuestion = (qIdx: number) => {
    const questions = section.questions.slice();
    questions.splice(qIdx, 1);
    onChange({ ...section, questions });
  };

  const addQuestion = () =>
    onChange({ ...section, questions: [...section.questions, emptyQuestion()] });

  return (
    <section className="rounded-lg border border-border bg-surface shadow-elev-1">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">
              {section.title || `Section ${index + 1}`}
            </p>
            <p className="text-[11px] text-fg-subtle">
              {section.questions.length} question
              {section.questions.length === 1 ? "" : "s"} · weight{" "}
              {section.weight ?? 1}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move section up"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-elevated text-fg-muted hover:bg-bg-muted hover:text-fg disabled:opacity-40"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move section down"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-elevated text-fg-muted hover:bg-bg-muted hover:text-fg disabled:opacity-40"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove section"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-elevated text-fg-muted hover:border-danger/30 hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Title</label>
              <input
                value={section.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="e.g. Greeting & Identification"
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Weight</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={section.weight ?? 1}
                onChange={(e) =>
                  update({ weight: Number(e.target.value) || 0 })
                }
                className={fieldClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelClass}>
              Description / instructions{" "}
              <span className="text-fg-subtle">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={section.description ?? ""}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Anything the supervisor should keep in mind for this section."
              className={cn(fieldClass, "h-auto resize-none py-2 leading-relaxed")}
            />
          </div>

          <div className="flex flex-col gap-3">
            {section.questions.map((q, qIdx) => (
              <QuestionEditor
                key={qIdx}
                question={q}
                index={qIdx}
                total={section.questions.length}
                onChange={(next) => updateQuestion(qIdx, next)}
                onMove={(dir) => moveQuestion(qIdx, dir)}
                onRemove={() => removeQuestion(qIdx)}
              />
            ))}

            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex h-9 items-center gap-1.5 self-start rounded-md border border-border bg-bg-elevated px-3 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <Plus className="h-3.5 w-3.5" /> Add question
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default SectionEditor;
