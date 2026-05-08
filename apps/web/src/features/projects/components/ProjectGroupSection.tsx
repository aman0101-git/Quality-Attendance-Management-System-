import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Project, ProjectGroup } from "../types";
import ProjectCard from "./ProjectCard";

interface ProjectGroupSectionProps {
  group: ProjectGroup;
  defaultOpen?: boolean;
  onProjectUpdated?: (project: Project) => void;
}

/**
 * Collapsible "group" container — header shows the group name + project count,
 * body renders a responsive grid of ProjectCard.
 */
export function ProjectGroupSection({
  group,
  defaultOpen = true,
  onProjectUpdated,
}: ProjectGroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-border bg-surface/60 shadow-elev-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3",
          "text-left transition-colors hover:bg-bg-muted/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          open ? "rounded-t-lg" : "rounded-lg",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            Group
          </span>
          <h2 className="truncate text-sm font-semibold tracking-tight text-fg">
            {group.groupName}
          </h2>
          <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-medium text-fg-subtle">
            {group.count}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-border"
          >
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onUpdated={onProjectUpdated}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default ProjectGroupSection;
