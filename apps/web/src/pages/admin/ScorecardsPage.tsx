import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  ClipboardPlus,
  Pencil,
  Power,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/utils";
import {
  listScorecards,
  setScorecardStatus,
} from "@/features/scorecards/api";
import {
  ScorecardStatus,
  type ScorecardListItem,
} from "@/features/scorecards/types";
import AddScorecardDialog from "@/features/scorecards/components/AddScorecardDialog";
import EditScorecardDialog from "@/features/scorecards/components/EditScorecardDialog";
import ScorecardStatusBadge from "@/features/scorecards/components/ScorecardStatusBadge";
import VersionBadge from "@/features/scorecards/components/VersionBadge";
import DefaultBadge from "@/features/scorecards/components/DefaultBadge";

type StatusFilter = "ALL" | ScorecardStatus;

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "Active", value: ScorecardStatus.ACTIVE },
  { label: "Inactive", value: ScorecardStatus.INACTIVE },
];

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

export default function ScorecardsPage() {
  const [scorecards, setScorecards] = useState<ScorecardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<number | null>(null);

  const fetchScorecards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listScorecards({ includeInactive: true });
      setScorecards(data);
    } catch (e) {
      console.error(e);
      setError("Could not load scorecards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchScorecards();
  }, [fetchScorecards]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scorecards.filter((s) => {
      if (filter !== "ALL" && s.status !== filter) return false;
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.groupName.toLowerCase().includes(term) ||
        (s.description?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [scorecards, filter, search]);

  const counts = useMemo(() => {
    const active = scorecards.filter(
      (s) => s.status === ScorecardStatus.ACTIVE,
    ).length;
    return { active, total: scorecards.length };
  }, [scorecards]);

  const defaultTemplate = useMemo(
    () => scorecards.find((s) => s.isDefault) ?? null,
    [scorecards],
  );

  const handleToggleStatus = async (row: ScorecardListItem) => {
    const next =
      row.status === ScorecardStatus.ACTIVE
        ? ScorecardStatus.INACTIVE
        : ScorecardStatus.ACTIVE;
    try {
      await setScorecardStatus(row.id, next);
      toast.success(
        next === ScorecardStatus.ACTIVE
          ? `Activated "${row.name}"`
          : `Deactivated "${row.name}"`,
      );
      void fetchScorecards();
    } catch (e) {
      const axiosErr = e as AxiosError<{ message?: string | string[] }>;
      const raw = axiosErr.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not change status");
    }
  };

  const columns: DataTableColumn<ScorecardListItem>[] = useMemo(
    () => [
      {
        key: "template",
        header: "Template",
        cell: (row) => (
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-fg">{row.name}</span>
              {row.isDefault && <DefaultBadge />}
              <VersionBadge version={row.version} />
            </div>
            {row.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-fg-subtle">
                {row.description}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "group",
        header: "Group",
        cell: (row) => (
          <span className="text-sm text-fg-muted">{row.groupName}</span>
        ),
      },
      {
        key: "structure",
        header: "Structure",
        cell: (row) => (
          <div className="flex flex-col">
            <span className="text-sm text-fg">
              {row.sectionCount} section{row.sectionCount === 1 ? "" : "s"}
            </span>
            <span className="text-[11px] text-fg-subtle">
              {row.questionCount} question{row.questionCount === 1 ? "" : "s"}
            </span>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => <ScorecardStatusBadge status={row.status} />,
      },
      {
        key: "createdBy",
        header: "Created by",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-fg">{row.createdBy.name}</p>
            <p className="truncate text-[11px] text-fg-subtle">
              @{row.createdBy.username}
            </p>
          </div>
        ),
      },
      {
        key: "updated",
        header: "Updated",
        align: "right",
        cell: (row) => (
          <span className="text-xs text-fg-subtle">
            {formatDate(row.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        cell: (row) => {
          const cannotDeactivate =
            row.isDefault && row.status === ScorecardStatus.ACTIVE;
          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setEditTargetId(row.id)}
                aria-label="Edit scorecard"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                disabled={cannotDeactivate}
                onClick={() => void handleToggleStatus(row)}
                aria-label={
                  row.status === ScorecardStatus.ACTIVE
                    ? "Deactivate scorecard"
                    : "Activate scorecard"
                }
                title={
                  cannotDeactivate
                    ? "The default QA template cannot be deactivated"
                    : undefined
                }
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium",
                  row.status === ScorecardStatus.ACTIVE
                    ? "border-border bg-bg-elevated text-fg-muted hover:border-warning/30 hover:bg-warning/10 hover:text-warning"
                    : "border-border bg-bg-elevated text-fg-muted hover:border-success/30 hover:bg-success/10 hover:text-success",
                  cannotDeactivate &&
                    "cursor-not-allowed opacity-50 hover:bg-bg-elevated hover:text-fg-muted hover:border-border",
                )}
              >
                <Power className="h-3.5 w-3.5" />
                {row.status === ScorecardStatus.ACTIVE
                  ? "Deactivate"
                  : "Activate"}
              </button>
            </div>
          );
        },
      },
    ],
    // handleToggleStatus is stable enough — depends only on fetchScorecards
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <PageContainer
      maxWidth="xl"
      title="Scorecards"
      description="Build and maintain the scorecard templates supervisors use during call audits."
      actions={
        <>
          <button
            onClick={() => void fetchScorecards()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
          >
            <ClipboardPlus className="h-4 w-4" /> New scorecard
          </button>
        </>
      }
    >
      <AppCard padding="sm" className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <DefaultBadge />
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">
                {defaultTemplate
                  ? defaultTemplate.name
                  : "No default QA template configured"}
              </p>
              <p className="text-[11px] text-fg-subtle">
                {defaultTemplate
                  ? `v${defaultTemplate.version} · ${defaultTemplate.sectionCount} section${defaultTemplate.sectionCount === 1 ? "" : "s"} · ${defaultTemplate.questionCount} parameter${defaultTemplate.questionCount === 1 ? "" : "s"} · auto-attached to every audit`
                  : "Run the QA seed or create a template, then promote it to default."}
              </p>
            </div>
          </div>
        </div>
      </AppCard>

      <AppCard padding="sm" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((f) => {
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

          <div className="flex items-center gap-3">
            <p className="text-xs text-fg-subtle">
              {loading
                ? "Loading…"
                : `${counts.active} active · ${counts.total} total`}
            </p>
            <div className="w-full max-w-xs">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder="Search by name, group…"
              />
            </div>
          </div>
        </div>
      </AppCard>

      {error ? (
        <EmptyState
          icon={ClipboardList}
          title="Couldn't load scorecards"
          description={error}
          action={
            <button
              onClick={() => void fetchScorecards()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
            >
              Try again
            </button>
          }
        />
      ) : (
        <DataTable<ScorecardListItem>
          columns={columns}
          data={filtered}
          rowKey={(row) => row.id}
          loading={loading}
          loadingRows={5}
          onRowClick={(row) => setEditTargetId(row.id)}
          emptyState={
            <EmptyState
              icon={ClipboardList}
              title={search ? "No matching scorecards" : "No scorecards yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Create your first template to get supervisors auditing."
              }
              action={
                !search ? (
                  <button
                    onClick={() => setAddOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
                  >
                    <ClipboardPlus className="h-4 w-4" /> New scorecard
                  </button>
                ) : undefined
              }
            />
          }
        />
      )}

      <AddScorecardDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(created) => {
          void fetchScorecards();
          // Open the editor straight after creation so the admin can fill
          // sections + questions in one continuous flow.
          setEditTargetId(created.id);
        }}
      />

      <EditScorecardDialog
        open={editTargetId !== null}
        scorecardId={editTargetId}
        onOpenChange={(open) => {
          if (!open) setEditTargetId(null);
        }}
        onSaved={() => void fetchScorecards()}
      />
    </PageContainer>
  );
}
