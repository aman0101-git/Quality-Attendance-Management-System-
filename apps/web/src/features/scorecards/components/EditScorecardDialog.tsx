import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { AuditQuestionType } from "@/features/audits/types";
import VersionBadge from "./VersionBadge";
import DefaultBadge from "./DefaultBadge";
import SectionEditor from "./SectionEditor";
import {
  getScorecard,
  updateScorecardHeader,
  updateScorecardStructure,
} from "../api";
import type {
  QuestionInput,
  ScorecardDetail,
  SectionInput,
} from "../types";

interface EditScorecardDialogProps {
  open: boolean;
  scorecardId: number | null;
  onOpenChange: (open: boolean) => void;
  /** Called when changes are saved so the list can refresh. */
  onSaved?: (scorecard: ScorecardDetail) => void;
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

function emptySection(index: number): SectionInput {
  return {
    title: `Section ${index + 1}`,
    description: "",
    weight: 1,
    questions: [emptyQuestion()],
  };
}

function detailToInput(detail: ScorecardDetail): SectionInput[] {
  return detail.sections.map((s) => ({
    title: s.title,
    description: s.description ?? "",
    weight: s.weight,
    questions: s.questions.map((q) => ({
      prompt: q.prompt,
      helpText: q.helpText ?? "",
      type: q.type,
      weight: q.weight,
      scoring: q.scoring,
      fatal: q.fatal,
      compliance: q.compliance,
      required: q.required,
      options: q.options ?? undefined,
      ratingScale: q.ratingScale ?? undefined,
    })),
  }));
}

function describeApiError(err: unknown): string | null {
  const axiosErr = err as AxiosError<{ message?: string | string[] }>;
  const raw = axiosErr.response?.data?.message;
  if (Array.isArray(raw)) return raw.join(", ");
  return raw ?? null;
}

/**
 * Two-pane editor modal:
 *   - Header form (name, description, group) — saved via PATCH /scorecards/:id
 *   - Sections + questions — saved via PATCH /scorecards/:id/structure
 *     (this bumps the template version; old audits keep their snapshot).
 *
 * The header and structure save independently so the admin doesn't lose
 * work mid-edit.
 */
export function EditScorecardDialog({
  open,
  scorecardId,
  onOpenChange,
  onSaved,
}: EditScorecardDialogProps) {
  const [loading, setLoading] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);

  const [detail, setDetail] = useState<ScorecardDetail | null>(null);

  // Header form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupName, setGroupName] = useState("");

  // Structure (sections + questions)
  const [sections, setSections] = useState<SectionInput[]>([]);

  useEffect(() => {
    if (!open || !scorecardId) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await getScorecard(scorecardId);
        setDetail(data);
        setName(data.name);
        setDescription(data.description ?? "");
        setGroupName(data.groupName);
        setSections(detailToInput(data));
      } catch (e) {
        console.error(e);
        toast.error("Could not load scorecard");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, scorecardId]);

  const headerDirty = useMemo(() => {
    if (!detail) return false;
    return (
      name.trim() !== detail.name ||
      (description.trim() || null) !== (detail.description ?? null) ||
      groupName.trim() !== detail.groupName
    );
  }, [detail, name, description, groupName]);

  const structureDirty = useMemo(() => {
    if (!detail) return false;
    return JSON.stringify(detailToInput(detail)) !== JSON.stringify(sections);
  }, [detail, sections]);

  // ------------------------------------------------------------
  //  Section ops
  // ------------------------------------------------------------

  const addSection = () =>
    setSections((prev) => [...prev, emptySection(prev.length)]);

  const updateSection = (idx: number, next: SectionInput) =>
    setSections((prev) => {
      const out = prev.slice();
      out[idx] = next;
      return out;
    });

  const moveSection = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    setSections((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const out = prev.slice();
      [out[idx], out[target]] = [out[target], out[idx]];
      return out;
    });
  };

  const removeSection = (idx: number) =>
    setSections((prev) => {
      const out = prev.slice();
      out.splice(idx, 1);
      return out;
    });

  // ------------------------------------------------------------
  //  Save
  // ------------------------------------------------------------

  const saveHeader = async () => {
    if (!detail) return;
    setSavingHeader(true);
    try {
      const updated = await updateScorecardHeader(detail.id, {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        groupName: groupName.trim(),
      });
      setDetail(updated);
      toast.success("Scorecard details saved");
      onSaved?.(updated);
    } catch (e) {
      const msg = describeApiError(e);
      toast.error(msg ?? "Could not save details");
    } finally {
      setSavingHeader(false);
    }
  };

  const saveStructure = async () => {
    if (!detail) return;

    if (sections.length === 0) {
      toast.error("Add at least one section before saving");
      return;
    }
    for (const s of sections) {
      if (!s.title.trim()) {
        toast.error("Every section needs a title");
        return;
      }
      if (s.questions.length === 0) {
        toast.error(`Section "${s.title}" needs at least one question`);
        return;
      }
      for (const q of s.questions) {
        if (!q.prompt.trim()) {
          toast.error(`A question in "${s.title}" is missing its prompt`);
          return;
        }
        if (
          q.type === AuditQuestionType.MULTIPLE_CHOICE &&
          (!q.options || q.options.length < 2)
        ) {
          toast.error(
            `Multiple-choice question "${q.prompt}" needs at least 2 options`,
          );
          return;
        }
      }
    }

    setSavingStructure(true);
    try {
      const updated = await updateScorecardStructure(
        detail.id,
        sections.map((s) => ({
          title: s.title.trim(),
          description: s.description?.trim() || undefined,
          weight: s.weight ?? 1,
          questions: s.questions.map((q) => ({
            prompt: q.prompt.trim(),
            helpText: q.helpText?.trim() || undefined,
            type: q.type,
            weight: q.weight ?? 1,
            scoring: q.scoring ?? true,
            fatal: q.fatal ?? false,
            compliance: q.compliance ?? false,
            required: q.required ?? true,
            options: q.options,
            ratingScale: q.ratingScale,
          })),
        })),
      );
      setDetail(updated);
      setSections(detailToInput(updated));
      toast.success(`Structure saved · v${updated.version}`);
      onSaved?.(updated);
    } catch (e) {
      const msg = describeApiError(e);
      toast.error(msg ?? "Could not save structure");
    } finally {
      setSavingStructure(false);
    }
  };

  // ------------------------------------------------------------
  //  Render
  // ------------------------------------------------------------

  const cancelBtn = (
    <button
      type="button"
      onClick={() => onOpenChange(false)}
      className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
    >
      Close
    </button>
  );

  const saveStructureBtn = (
    <button
      type="button"
      onClick={() => void saveStructure()}
      disabled={!structureDirty || savingStructure}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg",
        "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60",
      )}
    >
      {savingStructure ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      Save structure
    </button>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={detail ? `Edit ${detail.name}` : "Edit scorecard"}
      description={
        detail
          ? `Group ${detail.groupName} · ${detail.sectionCount} section${detail.sectionCount === 1 ? "" : "s"} · ${detail.questionCount} question${detail.questionCount === 1 ? "" : "s"}`
          : "Loading template…"
      }
      size="lg"
      footer={
        <>
          {cancelBtn}
          {saveStructureBtn}
        </>
      }
    >
      {loading || !detail ? (
        <div className="flex items-center justify-center py-10 text-sm text-fg-subtle">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading scorecard…
        </div>
      ) : (
        <div
          className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1"
        >
          {/* Header form */}
          <section className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                Template details
              </p>
              <div className="flex items-center gap-2">
                {detail.isDefault && <DefaultBadge />}
                <VersionBadge version={detail.version} />
                <button
                  type="button"
                  onClick={() => void saveHeader()}
                  disabled={!headerDirty || savingHeader}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium",
                    headerDirty
                      ? "text-fg-muted hover:bg-bg-muted hover:text-fg"
                      : "text-fg-subtle",
                  )}
                >
                  {savingHeader ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save details
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className={labelClass}>Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Group</label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short note about scope, intent, or change history."
                  className={cn(fieldClass, "h-auto resize-none py-2 leading-relaxed")}
                />
              </div>
            </div>
          </section>

          {/* Structure editor */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                Sections & questions
              </p>
              <button
                type="button"
                onClick={addSection}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
              >
                <Plus className="h-3.5 w-3.5" /> Add section
              </button>
            </div>

            {structureDirty && (
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5" />
                Unsaved structure changes. Saving will bump the template
                version. Existing audits keep their original scorecard snapshot.
              </div>
            )}

            {sections.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-bg-muted/40 px-4 py-6 text-center text-xs text-fg-subtle">
                No sections yet. Add your first section to start building this
                scorecard.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sections.map((section, idx) => (
                  <SectionEditor
                    key={idx}
                    section={section}
                    index={idx}
                    total={sections.length}
                    onChange={(next) => updateSection(idx, next)}
                    onMove={(dir) => moveSection(idx, dir)}
                    onRemove={() => removeSection(idx)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

export default EditScorecardDialog;
