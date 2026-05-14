import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  ClipboardPlus,
  Eye,
  FileEdit,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import Modal from "@/components/ui/Modal";
import {
  cn,
  formatAuditScore,
  formatDateTime,
  formatDurationSeconds,
  qualityLabel,
} from "@/lib/utils";
import {
  discardAudit,
  listAudits,
  publishAudit,
} from "@/features/audits/api";
import {
  AUDIT_IMMUTABLE_STATUSES,
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
  { label: "Published", value: AuditStatus.PUBLISHED },
  { label: "Reviewed", value: AuditStatus.REVIEWED },
];

// formatScore is replaced by the shared formatAuditScore utility from utils.ts

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

  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [discardTarget, setDiscardTarget] = useState<AuditListItem | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const handleStartNew = () => {
    setResumingId(undefined);
    setWizardOpen(true);
  };

  const handleDiscardConfirm = async () => {
    if (!discardTarget) return;
    setDiscarding(true);
    try {
      await discardAudit(discardTarget.id);
      toast.success(`Audit ${discardTarget.auditCode} discarded`);
      setDiscardTarget(null);
      void fetchAudits();
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not discard audit");
    } finally {
      setDiscarding(false);
    }
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

  const handlePublish = async (row: AuditListItem) => {
    setPublishingId(row.id);
    try {
      const published = await publishAudit(row.id);
      toast.success(
        `Audit ${published.auditCode} published — agent can now see it`,
      );
      void fetchAudits();
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not publish audit");
    } finally {
      setPublishingId(null);
    }
  };

  const columns: DataTableColumn<AuditListItem>[] = useMemo(
    () => [
      {
        key: "code",
        header: "Audit",
        cell: (row) => {
          // Date/duration are Phase 1 additions; both null on legacy
          // rows. Surface them subtly under the recording id so the
          // list stays compact but operational metadata is visible at
          // a glance.
          const dateLabel =
            row.callDate
              ? new Date(row.callDate).toLocaleDateString()
              : null;
          const durationLabel = formatDurationSeconds(row.callDuration ?? null);
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-fg">{row.auditCode}</span>
              <span className="text-xs text-fg-subtle">
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
        cell: (row) => {
          const rawPct =
            row.totalScore !== null && row.applicablePoints !== null && row.applicablePoints > 0
              ? (row.totalScore / row.applicablePoints) * 100
              : row.totalScore; // legacy fallback
          return (
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  row.fatalTriggered ? "text-danger" : "text-fg",
                )}
              >
                {formatAuditScore(row.finalScore, row.totalScore, row.applicablePoints)}
              </span>
              {row.fatalTriggered && rawPct !== null && (
                <span className="text-[10px] text-fg-subtle">
                  raw {typeof rawPct === "number" ? `${rawPct.toFixed(1)}%` : "—"}
                </span>
              )}
            </div>
          );
        },
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
        cell: (row) => <AuditStatusBadge status={row.status} />,
      },
      {
        key: "updated",
        header: "Updated",
        align: "right",
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-fg-subtle">
            {formatDateTime(row.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        cell: (row) => {
          const locked = AUDIT_IMMUTABLE_STATUSES.includes(row.status);
          const canPublish = row.status === AuditStatus.SUBMITTED;
          const canDiscard =
            row.status === AuditStatus.DRAFT ||
            row.status === AuditStatus.IN_PROGRESS;
          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {canPublish ? (
                <button
                  type="button"
                  onClick={() => void handlePublish(row)}
                  disabled={publishingId === row.id}
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-2.5 text-xs font-medium text-accent",
                    "hover:bg-accent/25 disabled:opacity-60",
                  )}
                >
                  {publishingId === row.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Publish
                </button>
              ) : null}
              {locked ? (
                <button
                  type="button"
                  onClick={() => handleResume(row.id)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleResume(row.id)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
                >
                  <FileEdit className="h-3.5 w-3.5" />
                  Open
                </button>
              )}
              {canDiscard && (
                <button
                  type="button"
                  onClick={() => setDiscardTarget(row)}
                  title="Discard draft"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    // handlePublish closes over publishingId; safe to leave inert here
    // because we re-derive on every render and only the active row's
    // spinner state matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [publishingId],
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
              <div
                key={d.id}
                className="flex flex-col gap-1 rounded-md border border-border bg-bg-elevated p-3 transition-colors"
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
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleResume(d.id)}
                    className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-accent px-2 text-[11px] font-medium text-accent-fg hover:opacity-90"
                  >
                    <FileEdit className="h-3 w-3" />
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscardTarget(d)}
                    title="Discard draft"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
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
          onRowClick={(row) => handleResume(row.id)}
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

      <Modal
        open={discardTarget !== null}
        onOpenChange={(open) => !discarding && !open && setDiscardTarget(null)}
        title="Discard this draft?"
        description="The audit will be hidden from your active list. Published audits are never affected by this action."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDiscardTarget(null)}
              disabled={discarding}
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDiscardConfirm()}
              disabled={discarding}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md bg-danger px-3 text-sm font-medium text-white",
                "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60",
              )}
            >
              {discarding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Discard
            </button>
          </>
        }
      >
        {discardTarget ? (
          <div className="text-sm text-fg-muted">
            <p>
              <span className="font-medium text-fg">
                {discardTarget.auditCode}
              </span>
              {" — "}
              {discardTarget.agent.name} · {discardTarget.projectNameSnapshot}
            </p>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
