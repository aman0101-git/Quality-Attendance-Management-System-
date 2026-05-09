import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  ClipboardPlus,
  FileEdit,
  RefreshCw,
} from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/utils";
import { listAudits } from "@/features/audits/api";
import {
  AuditStatus,
  type AuditDetail,
  type AuditListItem,
} from "@/features/audits/types";
import AuditStatusBadge from "@/features/audits/components/AuditStatusBadge";
import NewAuditWizard from "@/features/audits/components/NewAuditWizard";

type StatusFilter = "ALL" | AuditStatus;

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "Drafts", value: AuditStatus.DRAFT },
  { label: "In progress", value: AuditStatus.IN_PROGRESS },
  { label: "Submitted", value: AuditStatus.SUBMITTED },
  { label: "Completed", value: AuditStatus.COMPLETED },
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

function formatScore(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

export default function AuditsPage() {
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [resumingId, setResumingId] = useState<number | undefined>();

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAudits({
        status: filter === "ALL" ? undefined : filter,
      });
      setAudits(data);
    } catch (e) {
      console.error(e);
      setError("Could not load audits.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchAudits();
  }, [fetchAudits]);

  const drafts = useMemo(
    () =>
      audits.filter(
        (a) =>
          a.status === AuditStatus.DRAFT || a.status === AuditStatus.IN_PROGRESS,
      ),
    [audits],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return audits;
    return audits.filter((a) => {
      return (
        a.auditCode.toLowerCase().includes(term) ||
        a.callReference.toLowerCase().includes(term) ||
        a.agent.name.toLowerCase().includes(term) ||
        a.projectNameSnapshot.toLowerCase().includes(term) ||
        a.groupNameSnapshot.toLowerCase().includes(term)
      );
    });
  }, [audits, search]);

  const handleStartNew = () => {
    setResumingId(undefined);
    setWizardOpen(true);
  };

  const handleResume = (id: number) => {
    setResumingId(id);
    setWizardOpen(true);
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
    setResumingId(undefined);
  };

  const handleWizardSubmitted = (_audit: AuditDetail) => {
    setWizardOpen(false);
    setResumingId(undefined);
    void fetchAudits();
  };

  const columns: DataTableColumn<AuditListItem>[] = useMemo(
    () => [
      {
        key: "code",
        header: "Audit",
        cell: (row) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-fg">{row.auditCode}</span>
            <span className="text-xs text-fg-subtle">
              {row.callReference}
            </span>
          </div>
        ),
      },
      {
        key: "agent",
        header: "Agent",
        cell: (row) => (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
              {row.agent.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-fg">{row.agent.name}</p>
              <p className="truncate text-[11px] text-fg-subtle">
                @{row.agent.username}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "context",
        header: "Project",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-fg">{row.projectNameSnapshot}</p>
            <p className="truncate text-[11px] text-fg-subtle">
              {row.groupNameSnapshot}
            </p>
          </div>
        ),
      },
      {
        key: "score",
        header: "Score",
        align: "right",
        numeric: true,
        cell: (row) => (
          <div className="flex flex-col items-end">
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                row.fatalTriggered ? "text-danger" : "text-fg",
              )}
            >
              {formatScore(row.finalScore)}
            </span>
            {row.totalScore !== null && row.fatalTriggered && (
              <span className="text-[10px] text-fg-subtle">
                raw {row.totalScore.toFixed(1)}%
              </span>
            )}
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => <AuditStatusBadge status={row.status} />,
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
    ],
    [],
  );

  if (wizardOpen) {
    return (
      <PageContainer maxWidth="xl">
        <NewAuditWizard
          initialAuditId={resumingId}
          onCancel={handleWizardClose}
          onSubmitted={handleWizardSubmitted}
          onSavedDraft={() => void fetchAudits()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      maxWidth="xl"
      title="Audits"
      description="Score calls against your group's scorecard, save drafts and submit when ready."
      actions={
        <>
          <button
            onClick={() => void fetchAudits()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={handleStartNew}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
          >
            <ClipboardPlus className="h-4 w-4" /> Start audit
          </button>
        </>
      }
    >
      {drafts.length > 0 && (
        <AppCard padding="sm" className="mb-6">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            Resume drafts
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.slice(0, 6).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleResume(d.id)}
                className="group flex flex-col gap-1 rounded-md border border-border bg-bg-elevated p-3 text-left transition-colors hover:bg-bg-muted"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-fg">
                    {d.auditCode}
                  </span>
                  <AuditStatusBadge status={d.status} />
                </div>
                <p className="truncate text-sm text-fg">{d.agent.name}</p>
                <p className="truncate text-xs text-fg-subtle">
                  {d.projectNameSnapshot} · {d.callReference}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-accent">
                  <FileEdit className="h-3 w-3" />
                  Continue
                </span>
              </button>
            ))}
          </div>
        </AppCard>
      )}

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

          <div className="w-full max-w-sm">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search by code, agent, project…"
            />
          </div>
        </div>
      </AppCard>

      {error ? (
        <EmptyState
          icon={ClipboardList}
          title="Couldn't load audits"
          description={error}
          action={
            <button
              onClick={() => void fetchAudits()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
            >
              Try again
            </button>
          }
        />
      ) : (
        <DataTable<AuditListItem>
          columns={columns}
          data={filtered}
          rowKey={(row) => row.id}
          loading={loading}
          loadingRows={5}
          onRowClick={(row) => {
            if (
              row.status === AuditStatus.DRAFT ||
              row.status === AuditStatus.IN_PROGRESS
            ) {
              handleResume(row.id);
            }
          }}
          emptyState={
            <EmptyState
              icon={ClipboardList}
              title={search ? "No matching audits" : "No audits yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Click Start audit to score your first call."
              }
              action={
                !search ? (
                  <button
                    onClick={handleStartNew}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
                  >
                    <ClipboardPlus className="h-4 w-4" /> Start audit
                  </button>
                ) : undefined
              }
            />
          }
        />
      )}
    </PageContainer>
  );
}
