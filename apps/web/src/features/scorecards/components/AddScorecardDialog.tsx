import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { ClipboardPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { createScorecard } from "../api";
import type { ScorecardDetail } from "../types";

interface AddScorecardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new scorecard so the page can open the editor next. */
  onCreated?: (scorecard: ScorecardDetail) => void;
}

type FormValues = {
  name: string;
  groupName: string;
  description: string;
};

const fieldClass = cn(
  "h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg",
  "placeholder:text-fg-subtle transition-colors",
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
);

const labelClass = "text-xs font-medium text-fg-muted";
const errorClass = "text-xs text-danger";

export function AddScorecardDialog({
  open,
  onOpenChange,
  onCreated,
}: AddScorecardDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<FormValues>({
    defaultValues: { name: "", groupName: "", description: "" },
  });

  useEffect(() => {
    if (open) reset({ name: "", groupName: "", description: "" });
  }, [open, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      const created = await createScorecard({
        name: values.name.trim(),
        groupName: values.groupName.trim(),
        description: values.description.trim() || undefined,
      });
      toast.success(`Scorecard "${created.name}" created`);
      onOpenChange(false);
      onCreated?.(created);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string | string[] }>;
      const status = axiosErr.response?.status;
      const raw = axiosErr.response?.data?.message;
      const apiMessage = Array.isArray(raw) ? raw.join(", ") : raw;

      if (status === 409) {
        setError("name", {
          type: "server",
          message: apiMessage ?? "Scorecard with this name already exists in the group",
        });
        toast.error("Scorecard name already exists in this group");
        return;
      }
      if (status === 403) {
        toast.error(apiMessage ?? "Only ADMIN can create scorecards");
        return;
      }
      if (status === 400) {
        toast.error(apiMessage ?? "Please check the form for errors");
        return;
      }
      toast.error("Could not create scorecard. Please try again.");
    }
  };

  const cancelBtn = (
    <button
      type="button"
      onClick={() => onOpenChange(false)}
      className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
    >
      Cancel
    </button>
  );

  const submitBtn = (
    <button
      type="submit"
      form="add-scorecard-form"
      disabled={isSubmitting}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg",
        "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60",
      )}
    >
      {isSubmitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ClipboardPlus className="h-4 w-4" />
      )}
      {isSubmitting ? "Creating…" : "Create scorecard"}
    </button>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New scorecard"
      description="Create a template — sections and questions are added in the editor next."
      size="lg"
      footer={
        <>
          {cancelBtn}
          {submitBtn}
        </>
      }
    >
      <form
        id="add-scorecard-form"
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={labelClass}>
            Scorecard name
          </label>
          <input
            id="name"
            placeholder="e.g. Insurance — Inbound Sales QA"
            className={fieldClass}
            {...register("name", {
              required: "Name is required",
              minLength: { value: 2, message: "At least 2 characters" },
              maxLength: { value: 120, message: "Too long (max 120)" },
            })}
          />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="groupName" className={labelClass}>
            Group
          </label>
          <input
            id="groupName"
            placeholder="e.g. Insurance"
            className={fieldClass}
            {...register("groupName", {
              required: "Group is required",
              minLength: { value: 2, message: "At least 2 characters" },
              maxLength: { value: 100, message: "Too long (max 100)" },
            })}
          />
          {errors.groupName && (
            <p className={errorClass}>{errors.groupName.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="description" className={labelClass}>
            Description <span className="text-fg-subtle">(optional)</span>
          </label>
          <textarea
            id="description"
            rows={3}
            placeholder="Short note about scope, intent, or change history."
            className={cn(fieldClass, "h-auto resize-none py-2 leading-relaxed")}
            {...register("description", {
              maxLength: { value: 255, message: "Too long (max 255)" },
            })}
          />
          {errors.description && (
            <p className={errorClass}>{errors.description.message}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default AddScorecardDialog;
