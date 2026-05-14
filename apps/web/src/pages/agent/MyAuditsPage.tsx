import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ClipboardList,
  Eye,
  Inbox,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  cn,
  formatAuditScore,
  formatDateTime,
  formatDurationSeconds,
  qualityLabel,
} from "@/lib/utils";
import AuditStatusBadge from "@/features/audits/components/AuditStatusBadge";
import { AuditStatus } from "@/features/audits/types";
import { getMyAudits } from "@/features/agent-audits/api";
import type { AgentAuditListItem } from "@/features/agent-audits/types";

type StatusLens = "ALL" | "PENDING" | "REVIEWED";

const LENS_FILTERS: { label: string; value: StatusLens }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending review", value: "PENDING" },
  { label: "Reviewed", value: "REVIEWED" },
];

function scoreToneClass(value: number | null, fatal: boolean): string {
  if (fatal) return "text-danger";
  if (value === null) return "text-fg-muted";
  if (value >= 80) return "text-success";
  if (value >= 60) return "text-warning";
  return "text-danger";
}

/**
 * Lists the agent's own audits — only PUBLISHED + REVIEWED rows are
 * returned by the backend, never DRAFTs or SUBMITTED audits.
 *
 * Same component is reused for the "Audit History" sidebar entry by
 * passing `?lens=REVIEWED`. The architecture is filter-ready: search,
 * lens chips, and (later) pagination wire into the same fetch path.
 */
export default function MyAuditsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLens = (searchParams.get("lens") as StatusLens) ?? "ALL";

  const [audits, setAudits] = useState<AgentAuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lens, setLens] = useState<StatusLens>(
    LENS_FILTERS.some((l) => l.value === initialLens) ? initialLens : "ALL",
  );
  const [search, setSearch] = useState("");

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyAudits();
      setAudits(data);
    } catch (e) {
      console.error(e);
      setError("Could not load your audits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAudits();
  }, [fetchAudits]);

  // Keep ?lens= in the URL so deep links / "Audit history" sidebar work.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (lens === "ALL") next.delete("lens");
    else next.set("lens", lens);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return audits.filter((a) => {
      if (lens === "PENDING" && a.status !== AuditStatus.PUBLISHED) return false;
      if (lens === "REVIEWED" && a.status !== AuditStatus.REVIEWED) return false;
      if (!term) return true;
      return (
        a.auditCode.toLowerCase().includes(term) ||
        a.callReference.toLowerCase().includes(term) ||
        a.projectNameSnapshot.toLowerCase().includes(term) ||
        a.groupNameSnapshot.toLowerCase().includes(term) ||
        a.supervisor.name.toLowerCase().includes(term)
      );
    });
  }, [audits, lens, search]);

  const counts = useMemo(() => {
    const pending = audits.filter(
      (a) => a.status === AuditStatus.PUBLISHED,
    ).length;
    const reviewed = audits.filter(
      (a) => a.status === AuditStatus.REVIEWED,
    ).length;
    return { pending, reviewed, total: audits.length };
  }, [audits]);

  const columns: DataTableColumn<AgentAuditListItem>[] = useMemo(
    () => [
      {
        key: "audit",
        header: "Audit",
        cell: (row) => {
          const dateLabel =
            row.callDate
              ? new Date(row.callDate).toLocaleDateString()
              : null;
          const durationLabel = formatDurationSeconds(row.callDuration ?? null);
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-fg">{row.auditCode}</span>
              <span className="truncate text-xs text-fg-subtle">
                {row.callReference}
                {(dateLabel || durationLabel) && (
                  <>
                    {" · "}
                    {dateLabel ?? ""}
                    {dateLabel && durationLabel ? " · " : ""}
                    {durationLabel}
                  </>
                )}
              </span>
            </div>
          );
        },
      },
      {
        key: "context",
        header: "Project",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-fg">
              {row.projectNameSnapshot}
            </p>
            <p className="truncate text-[11px] text-fg-subtle">
              {row.groupNameSnapshot}
            </p>
          </div>
        ),
      },
      {
        key: "supervisor",
        header: "Supervisor",
        cell: (row) => (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
              {row.supervisor.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-fg">
                {row.supervisor.name}
              </p>
            </div>
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
                scoreToneClass(row.finalScore, row.fatalTriggered),
              )}
            >
              {formatAuditScore(row.finalScore, row.totalScore, row.applicablePoints)}
            </span>
            {row.fatalTriggered && (
              <span className="inline-flex items-center gap-1 text-[10px] text-danger">
                <ShieldAlert className="h-3 w-3" />
                Fatal
              </span>
            )}
          </div>
        ),
      },
      {
        key: "quality",
        header: "Quality",
        cell: (row) => {
          const q = qualityLabel(row.finalScore, row.fatalTriggered);
          if (q === null) {
            return <span className="text-[11px] text-fg-subtle">—</span>;
          }
          const tone =
            q === "GOOD"
              ? "border-success/40 bg-success/15 text-success"
              : q === "AVERAGE"
                ? "border-warning/40 bg-warning/15 text-warning"
                : "border-danger/40 bg-danger/15 text-danger";
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                tone,
              )}
            >
              {q}
            </span>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => (
          <div className="flex flex-col gap-0.5">
            <AuditStatusBadge status={row.status} />
            {row.status === AuditStatus.PUBLISHED && (
              <span className="text-[10px] text-warning">Awaiting review</span>
            )}
          </div>
        ),
      },
      {
        key: "published",
        header: "Published",
        align: "right",
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-fg-subtle">
            {formatDateTime(row.publishedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        cell: (row) => (
          <div
            className="flex items-center justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => navigate(`/agent/audits/${row.id}`)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <Eye className="h-3.5 w-3.5" />
              Open
            </button>
          </div>
        ),
      },
    ],
    [navigate],
  );

  return (
    <PageContainer
      maxWidth="xl"
      title="My audits"
      description="Audits your supervisors have published for you. Open any row to see the breakdown and acknowledge feedback."
      actions={
        <button
          onClick={() => void fetchAudits()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      }
    >
      <AppCard padding="sm" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {LENS_FILTERS.map((f) => {
              const active = lens === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setLens(f.value)}
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
                : `${counts.pending} pending · ${counts.reviewed} reviewed · ${counts.total} total`}
            </p>
            <div className="w-full max-w-xs">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder="Search by code, project, supervisor…"
              />
            </div>
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
        <DataTable<AgentAuditListItem>
          columns={columns}
          data={filtered}
          rowKey={(row) => row.id}
          loading={loading}
          loadingRows={5}
          onRowClick={(row) => navigate(`/agent/audits/${row.id}`)}
          emptyState={
            <EmptyState
              icon={Inbox}
              title={
                search
                  ? "No matching audits"
                  : lens === "PENDING"
                    ? "Nothing awaiting review"
                    : "No audits yet"
              }
              description={
                search
                  ? "Try a different search term."
                  : lens === "PENDING"
                    ? "Once a supervisor publishes an audit it will show up here."
                    : "Audits your supervisors publish will appear here."
              }
            />
          }
        />
      )}
    </PageContainer>
  );
}
