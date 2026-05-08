import { useState } from "react";
import { Calendar, Loader2, MoreVertical, User2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { updateProjectStatus } from "../api";
import { ProjectStatus, type Project } from "../types";

interface ProjectCardProps {
  project: Project;
  onUpdated?: (next: Project) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function ProjectCard({ project, onUpdated }: ProjectCardProps) {
  const [pending, setPending] = useState(false);

  const isActive = project.status === ProjectStatus.ACTIVE;

  const toggleStatus = async () => {
    const next: ProjectStatus = isActive
      ? ProjectStatus.INACTIVE
      : ProjectStatus.ACTIVE;
    setPending(true);
    try {
      const updated = await updateProjectStatus(project.id, next);
      toast.success(
        `"${updated.projectName}" marked ${updated.status.toLowerCase()}`,
      );
      onUpdated?.(updated);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string | string[] }>;
      const raw = axiosErr.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not update project status");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4",
        "shadow-elev-1 transition-all duration-200",
        "hover:border-border-strong hover:shadow-elev-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight text-fg">
            {project.projectName}
          </h3>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-fg-subtle">
            {project.groupName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge tone={isActive ? "success" : "neutral"}>
            {isActive ? "Active" : "Inactive"}
          </StatusBadge>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Project actions"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-muted hover:text-fg"
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-[180px] rounded-md border border-border bg-surface p-1.5 shadow-elev-3"
              >
                <DropdownMenu.Item
                  disabled={pending}
                  onSelect={() => void toggleStatus()}
                  className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm text-fg-muted outline-none data-[highlighted]:bg-bg-muted data-[highlighted]:text-fg"
                >
                  {isActive ? "Mark inactive" : "Mark active"}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <p
        className={cn(
          "text-sm leading-relaxed text-fg-muted",
          !project.description && "italic text-fg-subtle",
        )}
      >
        {project.description || "No description provided"}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-[11px] text-fg-subtle">
        <span className="inline-flex items-center gap-1.5">
          <User2 className="h-3 w-3" />
          {project.createdBy.name}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          {formatDate(project.createdAt)}
        </span>
      </div>
    </div>
  );
}

export default ProjectCard;
