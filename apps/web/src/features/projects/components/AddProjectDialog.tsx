import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import {
  createProject,
  type CreateProjectPayload,
} from "../api";
import { ProjectStatus, type Project } from "../types";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the newly created project so the page can refresh. */
  onCreated?: (project: Project) => void;
}

type FormValues = {
  projectName: string;
  groupName: string;
  description: string;
  status: ProjectStatus;
};

const fieldClass = cn(
  "h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg",
  "placeholder:text-fg-subtle transition-colors",
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
);

const labelClass = "text-xs font-medium text-fg-muted";
const errorClass = "text-xs text-danger";

export function AddProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: AddProjectDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<FormValues>({
    defaultValues: {
      projectName: "",
      groupName: "",
      description: "",
      status: ProjectStatus.ACTIVE,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        projectName: "",
        groupName: "",
        description: "",
        status: ProjectStatus.ACTIVE,
      });
    }
  }, [open, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload: CreateProjectPayload = {
      projectName: values.projectName.trim(),
      groupName: values.groupName.trim(),
      description: values.description.trim() || undefined,
      status: values.status,
    };

    try {
      const created = await createProject(payload);
      toast.success(`Project "${created.projectName}" created`);
      onOpenChange(false);
      onCreated?.(created);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string | string[] }>;
      const status = axiosErr.response?.status;
      const raw = axiosErr.response?.data?.message;
      const apiMessage = Array.isArray(raw) ? raw.join(", ") : raw;

      if (status === 409) {
        setError("projectName", {
          type: "server",
          message: apiMessage ?? "Project already exists in this group",
        });
        toast.error("Project already exists in this group");
        return;
      }

      if (status === 403) {
        toast.error(apiMessage ?? "You don't have permission to create projects");
        return;
      }

      if (status === 400) {
        toast.error(apiMessage ?? "Please check the form for errors");
        return;
      }

      toast.error("Could not create project. Please try again.");
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
      form="add-project-form"
      disabled={isSubmitting}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg",
        "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60",
      )}
    >
      {isSubmitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FolderPlus className="h-4 w-4" />
      )}
      {isSubmitting ? "Creating…" : "Create project"}
    </button>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add project"
      description="Projects are grouped (e.g. by line of business) and selected during call audits."
      size="lg"
      footer={
        <>
          {cancelBtn}
          {submitBtn}
        </>
      }
    >
      <form
        id="add-project-form"
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="projectName" className={labelClass}>
            Project name
          </label>
          <input
            id="projectName"
            placeholder="e.g. Auto Renewals"
            className={fieldClass}
            {...register("projectName", {
              required: "Project name is required",
              minLength: { value: 2, message: "At least 2 characters" },
              maxLength: { value: 100, message: "Too long (max 100)" },
            })}
          />
          {errors.projectName && (
            <p className={errorClass}>{errors.projectName.message}</p>
          )}
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
              required: "Group name is required",
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
            placeholder="Short note about the campaign, scope, or audit focus."
            className={cn(
              fieldClass,
              "h-auto resize-none py-2 leading-relaxed",
            )}
            {...register("description", {
              maxLength: { value: 255, message: "Too long (max 255)" },
            })}
          />
          {errors.description && (
            <p className={errorClass}>{errors.description.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            className={cn(fieldClass, "appearance-none pr-8")}
            {...register("status", { required: true })}
          >
            <option value={ProjectStatus.ACTIVE}>Active</option>
            <option value={ProjectStatus.INACTIVE}>Inactive</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}

export default AddProjectDialog;
