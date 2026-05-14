import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  FolderKanban,
  ShieldAlert,
  Star,
  TimerReset,
  UserSquare2,
} from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { WelcomeHeader } from "@/features/dashboard/components/WelcomeHeader";
import { TimeFilterChips } from "@/features/dashboard/components/TimeFilterChips";
import { StatCard } from "@/components/ui/StatCard";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import AuditStatusBadge from "@/features/audits/components/AuditStatusBadge";
import { listAudits } from "@/features/audits/api";
import {
  AuditStatus,
  type AuditListItem,
} from "@/features/audits/types";
import {
  cn,
  dateRangeFor,
  formatAuditScore,
  formatDateTime,
  isWithinRange,
  type DateRangePreset,
} from "@/lib/utils";
import { DrillDownModal } from "@/features/reports/components/DrillDownModal";

/** Drill-down identifier for the supervisor dashboard KPIs. */
type DashboardDrill =
  | "all"
  | "inProgress"
  | "awaitingPublish"
  | "published"
  | null;

function scoreToneClass(value: number | null, fatal: boolean): string {
  if (fatal) return "text-danger";
  if (value === null) return "text-fg-muted";
  if (value >= 80) return "text-success";
  if (value >= 60) return "text-warning";
  return "text-danger";
}

/**
 * Supervisor dashboard — pulls the supervisor's own audit data and
 * exposes a Today / Week / Month / All-time filter that drives every
 * KPI card and list on the page. Filtering is client-side over the
 * (already supervisor-scoped) audit list to keep the implementation
 * lightweight.
 */
export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangePreset>("all");
  const [drill, setDrill] = useState<DashboardDrill>(null);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAudits();
      setAudits(data);
    } catch (e) {
      console.error(e);
      setError("Could not load audits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAudits();
  }, [fetchAudits]);

  // Apply the time filter against `createdAt` — the audit's birth date
  // is the most natural anchor for "audits created today / this week".
  const filtered = useMemo(() => {
    const r = dateRangeFor(range);
    return audits.filter((a) => isWithinRange(a.createdAt, r));
  }, [audits, range]);

  const stats = useMemo(() => {
    const inProgress = filtered.filter(
      (a) =>
        a.status === AuditStatus.DRAFT ||
        a.status === AuditStatus.IN_PROGRESS,
    ).length;
    const awaitingPublish = filtered.filter(
      (a) => a.status === AuditStatus.SUBMITTED,
    ).length;
    const published = filtered.filter(
      (a) =>
        a.status === AuditStatus.PUBLISHED ||
        a.status === AuditStatus.REVIEWED,
    );

    const scored = published.filter(
      (a) => a.finalScore !== null && !a.fatalTriggered,
    );
    const avg =
      scored.length > 0
        ? scored.reduce((acc, a) => acc + (a.finalScore ?? 0), 0) /
          scored.length
        : null;

    return {
      total: filtered.length,
      inProgress,
      awaitingPublish,
      published: published.length,
      averageScore: avg,
    };
  }, [filtered]);

  const recent = useMemo(
    () =>
      [...filtered]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 6),
    [filtered],
  );

  return (
    <PageContainer maxWidth="xl">
      <WelcomeHeader
        eyebrow="Operations"
        description="Track your audit pipeline — drafts, submissions, and what's been published to your agents."
        actions={
          <>
            <button
              onClick={() => navigate("/supervisor/agents")}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <UserSquare2 className="h-4 w-4" /> Agents
            </button>
            <button
              onClick={() => navigate("/supervisor/projects")}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <FolderKanban className="h-4 w-4" /> Projects
            </button>
            <button
              onClick={() => navigate("/supervisor/audits")}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
            >
              <ClipboardPlus className="h-4 w-4" /> Start audit
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TimeFilterChips value={range} onChange={setRange} />
        <p className="text-xs text-fg-subtle">
          {loading
            ? "Loading…"
            : `${stats.total} audit${stats.total === 1 ? "" : "s"} in range`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiButton
          disabled={loading || stats.total === 0}
          onClick={() => setDrill("all")}
        >
          <StatCard
            label="Total audits"
            value={loading ? "—" : stats.total}
            icon={ClipboardList}
            loading={loading}
            description={stats.total > 0 ? "Click to drill down" : undefined}
          />
        </KpiButton>
        <KpiButton
          disabled={loading || stats.inProgress === 0}
          onClick={() => setDrill("inProgress")}
        >
          <StatCard
            label="In progress"
            value={loading ? "—" : stats.inProgress}
            icon={TimerReset}
            description="Drafts + ongoing"
            loading={loading}
          />
        </KpiButton>
        <KpiButton
          disabled={loading || stats.awaitingPublish === 0}
          onClick={() => setDrill("awaitingPublish")}
        >
          <StatCard
            label="Awaiting publish"
            value={loading ? "—" : stats.awaitingPublish}
            icon={ClipboardCheck}
            description="Submitted, not yet sent to agent"
            loading={loading}
          />
        </KpiButton>
        <KpiButton
          disabled={loading || stats.published === 0}
          onClick={() => setDrill("published")}
        >
          <StatCard
            label="Avg score"
            value={
              loading
                ? "—"
                : stats.averageScore === null
                  ? "—"
                  : `${stats.averageScore.toFixed(1)}%`
            }
            icon={Star}
            description={`across ${stats.published} published`}
            loading={loading}
          />
        </KpiButton>
      </div>

      {/* Drill-down modal — opens whichever slice the supervisor clicked.
          Filtering happens locally over the already supervisor-scoped
          `filtered` array so permissions are preserved by construction. */}
      <DrillDownModal
        variant="audits"
        open={drill !== null}
        onOpenChange={(o) => !o && setDrill(null)}
        title={
          drill === "inProgress"
            ? "In progress audits"
            : drill === "awaitingPublish"
              ? "Submitted (awaiting publish)"
              : drill === "published"
                ? "Published audits"
                : "Audits in range"
        }
        audits={
          drill === "inProgress"
            ? filtered.filter(
                (a) =>
                  a.status === AuditStatus.DRAFT ||
                  a.status === AuditStatus.IN_PROGRESS,
              )
            : drill === "awaitingPublish"
              ? filtered.filter((a) => a.status === AuditStatus.SUBMITTED)
              : drill === "published"
                ? filtered.filter(
                    (a) =>
                      a.status === AuditStatus.PUBLISHED ||
                      a.status === AuditStatus.REVIEWED,
                  )
                : filtered
        }
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <AppCard
          padding="none"
          className="lg:col-span-2"
          header={
            <>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-fg">
                  Recent audits
                </h3>
                <p className="text-xs text-fg-subtle">
                  Sorted by last update — open one to resume or review
                </p>
              </div>
              <Link
                to="/supervisor/audits"
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </>
          }
        >
          {loading ? (
            <div className="p-5">
              <LoadingSkeleton rows={5} />
            </div>
          ) : error ? (
            <EmptyState
              title="Couldn't load audits"
              description={error}
              className="border-none bg-transparent"
            />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={range === "all" ? "No audits yet" : "Nothing in this range"}
              description={
                range === "all"
                  ? "Start your first audit from the Audits page."
                  : "Try widening the time filter."
              }
              action={
                range === "all" ? (
                  <button
                    onClick={() => navigate("/supervisor/audits")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
                  >
                    <ClipboardPlus className="h-4 w-4" /> Start audit
                  </button>
                ) : undefined
              }
              className="border-none bg-transparent"
            />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-fg">
                        {row.auditCode}
                      </span>
                      <AuditStatusBadge status={row.status} />
                      {row.fatalTriggered && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger">
                          <ShieldAlert className="h-3 w-3" />
                          Fatal
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-fg-subtle">
                      {row.agent.name} · {row.projectNameSnapshot}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      scoreToneClass(row.finalScore, row.fatalTriggered),
                    )}
                  >
                    {formatAuditScore(row.finalScore, row.totalScore, row.applicablePoints)}
                  </span>
                  <span className="hidden whitespace-nowrap text-xs text-fg-subtle sm:inline">
                    {formatDateTime(row.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AppCard>

        <AppCard
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Pipeline
              </h3>
              <p className="text-xs text-fg-subtle">By status</p>
            </div>
          }
        >
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              <PipelineRow
                label="Drafts & in progress"
                count={stats.inProgress}
                tone="bg-info/15 text-info"
              />
              <PipelineRow
                label="Submitted"
                count={stats.awaitingPublish}
                tone="bg-accent/15 text-accent"
              />
              <PipelineRow
                label="Published"
                count={
                  filtered.filter((a) => a.status === AuditStatus.PUBLISHED)
                    .length
                }
                tone="bg-success/15 text-success"
              />
              <PipelineRow
                label="Reviewed"
                count={
                  filtered.filter((a) => a.status === AuditStatus.REVIEWED)
                    .length
                }
                tone="bg-success/15 text-success"
              />
            </ul>
          )}
        </AppCard>
      </div>
    </PageContainer>
  );
}

/**
 * Wraps a StatCard so the whole tile becomes a click target for a
 * drill-down. When `disabled` (loading or zero matching audits) it
 * falls back to a plain wrapper so the user doesn't get lured into
 * an empty modal.
 */
function KpiButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return <div>{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {children}
    </button>
  );
}

function PipelineRow({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-elevated px-3 py-1.5">
      <span className="text-sm text-fg-muted">{label}</span>
      <span
        className={cn(
          "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums",
          tone,
        )}
      >
        {count}
      </span>
    </li>
  );
}
