import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderPlus, Layers, RefreshCw } from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { cn } from "@/lib/utils";
import {
  getGroupedProjects,
  type ListGroupedParams,
} from "@/features/projects/api";
import {
  ProjectStatus,
  type Project,
  type ProjectGroup,
} from "@/features/projects/types";
import AddProjectDialog from "@/features/projects/components/AddProjectDialog";
import ProjectGroupSection from "@/features/projects/components/ProjectGroupSection";

type StatusFilter = "ALL" | ProjectStatus;

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "Active", value: ProjectStatus.ACTIVE },
  { label: "Inactive", value: ProjectStatus.INACTIVE },
];

export default function ProjectsPage() {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [addOpen, setAddOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params: ListGroupedParams = {
      includeInactive: true,
      ...(filter !== "ALL" ? { status: filter } : {}),
    };

    try {
      const data = await getGroupedProjects(params);
      setGroups(data);
    } catch (err) {
      console.error(err);
      setError("Could not load projects.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const totalProjects = useMemo(
    () => groups.reduce((acc, g) => acc + g.count, 0),
    [groups],
  );

  const handleProjectUpdated = (next: Project) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.groupName === next.groupName
          ? {
              ...group,
              projects: group.projects.map((p) =>
                p.id === next.id ? next : p,
              ),
            }
          : group,
      ),
    );
  };

  return (
    <PageContainer
      maxWidth="xl"
      title="Projects"
      description="Organize campaigns into groups so they can be selected during call audits."
      actions={
        <>
          <button
            onClick={() => void fetchProjects()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
          >
            <FolderPlus className="h-4 w-4" /> Add project
          </button>
        </>
      }
    >
      <AppCard padding="sm" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors",
                    active
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : "border-border bg-bg-elevated text-fg-muted hover:bg-bg-muted hover:text-fg",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-fg-subtle">
            {loading
              ? "Loading…"
              : `${totalProjects} project${totalProjects === 1 ? "" : "s"} across ${groups.length} group${groups.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </AppCard>

      {loading && groups.length === 0 ? (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <AppCard key={i} padding="md">
              <LoadingSkeleton rows={3} />
            </AppCard>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={Layers}
          title="Couldn't load projects"
          description={error}
          action={
            <button
              onClick={() => void fetchProjects()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
            >
              Try again
            </button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No projects yet"
          description="Create your first project to start organizing campaigns by group."
          action={
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
            >
              <FolderPlus className="h-4 w-4" /> Add project
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <ProjectGroupSection
              key={group.groupName}
              group={group}
              onProjectUpdated={handleProjectUpdated}
            />
          ))}
        </div>
      )}

      <AddProjectDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => void fetchProjects()}
      />
    </PageContainer>
  );
}
