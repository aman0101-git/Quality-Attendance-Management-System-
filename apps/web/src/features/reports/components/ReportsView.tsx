import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { TimeFilterChips } from "@/features/dashboard/components/TimeFilterChips";
import { listAudits } from "@/features/audits/api";
import {
  AuditStatus,
  type AuditListItem,
} from "@/features/audits/types";
import {
  cn,
  dateRangeFor,
  isWithinRange,
  qualityLabel,
  type DateRangePreset,
  type QualityLabel,
} from "@/lib/utils";
import {
  DrillDownModal,
  type DrillDownAgentRow,
} from "./DrillDownModal";

/**
 * Phase 2 — performance tier thresholds.  Anyone whose average final
 * score is at least this value is a Top Performer; everyone else is
 * flagged as Need Attention.  Centralised so the tier logic is
 * trivial to tweak later without hunting through the file.
 */
const TOP_PERFORMER_THRESHOLD = 85;

interface AggRow {
  key: string;
  label: string;
  sublabel?: string;
  total: number;
  scored: number;
  averageScore: number | null;
  fatalCount: number;
  good: number;
  average: number;
  bad: number;
  pending: number;
  reviewed: number;
}

function emptyAgg(key: string, label: string, sublabel?: string): AggRow {
  return {
    key,
    label,
    sublabel,
    total: 0,
    scored: 0,
    averageScore: null,
    fatalCount: 0,
    good: 0,
    average: 0,
    bad: 0,
    pending: 0,
    reviewed: 0,
  };
}

interface ReportsViewProps {
  /**
   * Title shown at the top of the page. The reports view itself is
   * unaware of who's looking — supervisor scoping is enforced server-
   * side by the audit list endpoint.
   */
  title: string;
  description?: string;
  /** Pages with broader scope (admin) want a different empty-state copy. */
  scope: "supervisor" | "admin";
}

const QUALITY_TONE: Record<NonNullable<QualityLabel>, string> = {
  GOOD: "border-success/40 bg-success/15 text-success",
  AVERAGE: "border-warning/40 bg-warning/15 text-warning",
  BAD: "border-danger/40 bg-danger/15 text-danger",
};

/**
 * Real-data quality / performance overview. Reuses the existing audit
 * list endpoint (which is already correctly scoped per role) so this
 * page works for both supervisor and admin without a separate API.
 *
 * The single source of truth is `audits`: every KPI, breakdown, and
 * leaderboard is computed off the time-filtered slice client-side.
 */
/**
 * Drill-down identifier. The reports view drives a single shared
 * DrillDownModal — we just flip `drill` to one of these strings to
 * pick which slice of audits / agents to show. `null` means closed.
 *
 * Adding a new drill-down is a two-step change: add a branch in
 * `drillDown` below, then wire a click handler on the corresponding
 * KPI tile.
 */
type DrillId =
  | "all"
  | "fatal"
  | "pending"
  | "submitted"
  | "inProgress"
  | "published"
  | "reviewed"
  | "good"
  | "average"
  | "bad"
  | "topPerformers"
  | "needAttention"
  | null;

export function ReportsView({ title, description, scope }: ReportsViewProps) {
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangePreset>("month");
  /** Which drill-down modal is currently open, if any. */
  const [drill, setDrill] = useState<DrillId>(null);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAudits();
      setAudits(data);
    } catch (e) {
      console.error(e);
      setError("Could not load report data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAudits();
  }, [fetchAudits]);

  const filtered = useMemo(() => {
    const r = dateRangeFor(range);
    return audits.filter((a) => isWithinRange(a.createdAt, r));
  }, [audits, range]);

  const overall = useMemo(() => {
    const total = filtered.length;
    const scored = filtered.filter((a) => a.finalScore !== null);
    const avg =
      scored.length > 0
        ? Math.round(
            (scored.reduce((acc, a) => acc + (a.finalScore ?? 0), 0) /
              scored.length) *
              10,
          ) / 10
        : null;
    const fatal = filtered.filter((a) => a.fatalTriggered).length;
    const published = filtered.filter(
      (a) =>
        a.status === AuditStatus.PUBLISHED ||
        a.status === AuditStatus.REVIEWED,
    ).length;
    const reviewed = filtered.filter(
      (a) => a.status === AuditStatus.REVIEWED,
    ).length;
    const submitted = filtered.filter(
      (a) => a.status === AuditStatus.SUBMITTED,
    ).length;
    const inProgress = filtered.filter(
      (a) =>
        a.status === AuditStatus.DRAFT ||
        a.status === AuditStatus.IN_PROGRESS,
    ).length;

    let good = 0;
    let average = 0;
    let bad = 0;
    for (const a of filtered) {
      const q = qualityLabel(a.finalScore, a.fatalTriggered);
      if (q === "GOOD") good += 1;
      else if (q === "AVERAGE") average += 1;
      else if (q === "BAD") bad += 1;
    }

    return {
      total,
      avg,
      fatal,
      published,
      reviewed,
      submitted,
      inProgress,
      good,
      average,
      bad,
    };
  }, [filtered]);

  /** Aggregate by a row's `keyOf(row)` — used to build agent / project tables. */
  function aggregate(
    keyOf: (row: AuditListItem) => { key: string; label: string; sublabel?: string },
  ): AggRow[] {
    const map = new Map<string, AggRow>();
    for (const a of filtered) {
      const { key, label, sublabel } = keyOf(a);
      const row = map.get(key) ?? emptyAgg(key, label, sublabel);
      row.total += 1;
      if (a.finalScore !== null) {
        row.scored += 1;
        // running mean
        row.averageScore =
          row.averageScore === null
            ? a.finalScore
            : row.averageScore + (a.finalScore - row.averageScore) / row.scored;
      }
      if (a.fatalTriggered) row.fatalCount += 1;
      if (a.status === AuditStatus.PUBLISHED) row.pending += 1;
      if (a.status === AuditStatus.REVIEWED) row.reviewed += 1;
      const q = qualityLabel(a.finalScore, a.fatalTriggered);
      if (q === "GOOD") row.good += 1;
      else if (q === "AVERAGE") row.average += 1;
      else if (q === "BAD") row.bad += 1;
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => {
      // Sort by average score desc, then by total audits desc.
      const aa = a.averageScore ?? -1;
      const bb = b.averageScore ?? -1;
      if (bb !== aa) return bb - aa;
      return b.total - a.total;
    });
  }

  const byAgent = useMemo(
    () =>
      aggregate((a) => ({
        key: a.agent.id,
        label: a.agent.name,
        sublabel: `@${a.agent.username}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  );

  const byProject = useMemo(
    () =>
      aggregate((a) => ({
        key: `${a.projectNameSnapshot}::${a.groupNameSnapshot}`,
        label: a.projectNameSnapshot,
        sublabel: a.groupNameSnapshot,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  );

  /**
   * Phase 2 — classify every scored agent into one of two tiers.
   *
   *   Top performer   → average final score ≥ 85
   *   Need attention  → scored at least once AND average final < 85
   *
   * Unscored agents (no published audits yet) are intentionally
   * excluded from both tiers so the classification can't fire on
   * nothing.  The tiers are always clickable and drive a drill-down
   * modal that lists the actual users behind each metric.
   */
  const topPerformers = useMemo<DrillDownAgentRow[]>(
    () =>
      [...byAgent]
        .filter(
          (r) =>
            r.scored >= 1 &&
            r.averageScore !== null &&
            r.averageScore >= TOP_PERFORMER_THRESHOLD,
        )
        .sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1))
        .map(toDrillAgentRow),
    [byAgent],
  );

  const needAttention = useMemo<DrillDownAgentRow[]>(
    () =>
      [...byAgent]
        .filter(
          (r) =>
            r.scored >= 1 &&
            r.averageScore !== null &&
            r.averageScore < TOP_PERFORMER_THRESHOLD,
        )
        .sort((a, b) => (a.averageScore ?? Infinity) - (b.averageScore ?? Infinity))
        .map(toDrillAgentRow),
    [byAgent],
  );

  /**
   * Resolve a drill-down id into the records that back it. Caller-side
   * filtering keeps the permission boundary identical to the rest of
   * the page — `filtered` is already supervisor- or admin-scoped via
   * `listAudits`.
   */
  const drillDown = useMemo(() => {
    if (drill === null) return null;
    if (drill === "all") {
      return {
        kind: "audits" as const,
        title: "Audits in range",
        audits: filtered,
      };
    }
    if (drill === "fatal") {
      return {
        kind: "audits" as const,
        title: "Audits with fatal triggers",
        description:
          "Every audit in the current range where at least one parameter was scored FATAL.",
        audits: filtered.filter((a) => a.fatalTriggered),
      };
    }
    if (drill === "pending") {
      return {
        kind: "audits" as const,
        title: "Pending review",
        description:
          "Audits published to the agent but not yet acknowledged.",
        audits: filtered.filter((a) => a.status === AuditStatus.PUBLISHED),
      };
    }
    if (drill === "submitted") {
      return {
        kind: "audits" as const,
        title: "Submitted (awaiting publish)",
        audits: filtered.filter((a) => a.status === AuditStatus.SUBMITTED),
      };
    }
    if (drill === "inProgress") {
      return {
        kind: "audits" as const,
        title: "In progress",
        audits: filtered.filter(
          (a) =>
            a.status === AuditStatus.DRAFT ||
            a.status === AuditStatus.IN_PROGRESS,
        ),
      };
    }
    if (drill === "published") {
      return {
        kind: "audits" as const,
        title: "Published audits",
        audits: filtered.filter(
          (a) =>
            a.status === AuditStatus.PUBLISHED ||
            a.status === AuditStatus.REVIEWED,
        ),
      };
    }
    if (drill === "reviewed") {
      return {
        kind: "audits" as const,
        title: "Reviewed by agent",
        audits: filtered.filter((a) => a.status === AuditStatus.REVIEWED),
      };
    }
    if (drill === "good" || drill === "average" || drill === "bad") {
      const target = drill.toUpperCase() as NonNullable<QualityLabel>;
      return {
        kind: "audits" as const,
        title: `Quality · ${target}`,
        audits: filtered.filter(
          (a) => qualityLabel(a.finalScore, a.fatalTriggered) === target,
        ),
      };
    }
    if (drill === "topPerformers") {
      return {
        kind: "agents" as const,
        title: "Top performers",
        description: `Agents whose average final score is ≥ ${TOP_PERFORMER_THRESHOLD}%.`,
        agents: topPerformers,
      };
    }
    if (drill === "needAttention") {
      return {
        kind: "agents" as const,
        title: "Needs attention",
        description: `Agents whose average final score is below ${TOP_PERFORMER_THRESHOLD}%.`,
        agents: needAttention,
      };
    }
    return null;
  }, [drill, filtered, topPerformers, needAttention]);

  return (
    <PageContainer
      maxWidth="xl"
      title={title}
      description={
        description ??
        (scope === "admin"
          ? "Workspace-wide quality, performance and pipeline metrics."
          : "Quality and performance for your scope of audits.")
      }
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TimeFilterChips value={range} onChange={setRange} />
        <p className="text-xs text-fg-subtle">
          {loading
            ? "Loading…"
            : `${overall.total} audit${overall.total === 1 ? "" : "s"} in range`}
        </p>
      </div>

      {/* Overall quality KPIs — every tile drills down to the records
          behind the number. Average score is non-interactive: there's
          no single "set of audits behind an average" beyond all
          scored audits, which the "Audits in range" tile already
          covers. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DrillTrigger
          disabled={loading || overall.total === 0}
          onActivate={() => setDrill("all")}
        >
          <StatCard
            label="Audits in range"
            value={loading ? "—" : overall.total}
            icon={ClipboardList}
            loading={loading}
            description={overall.total > 0 ? "Click to drill down" : undefined}
          />
        </DrillTrigger>
        <StatCard
          label="Average score"
          value={
            loading
              ? "—"
              : overall.avg === null
                ? "—"
                : `${overall.avg.toFixed(1)}%`
          }
          icon={Star}
          description="Across published + reviewed"
          loading={loading}
        />
        <DrillTrigger
          disabled={loading || overall.fatal === 0}
          onActivate={() => setDrill("fatal")}
        >
          <StatCard
            label="Fatal triggers"
            value={loading ? "—" : overall.fatal}
            icon={ShieldAlert}
            description={
              overall.fatal > 0
                ? "Click to see which audits"
                : "No fatal audits in this range"
            }
            loading={loading}
          />
        </DrillTrigger>
        <DrillTrigger
          disabled={loading || pendingCount(filtered) === 0}
          onActivate={() => setDrill("pending")}
        >
          <StatCard
            label="Pending review"
            value={loading ? "—" : pendingCount(filtered)}
            icon={ClipboardCheck}
            description={`${overall.reviewed} reviewed by agents`}
            loading={loading}
          />
        </DrillTrigger>
      </div>

      {/* Quality distribution + funnel */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <AppCard
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Quality distribution
              </h3>
              <p className="text-xs text-fg-subtle">
                GOOD ≥ 80, AVERAGE 50–79, BAD &lt; 50 (or fatal-triggered)
              </p>
            </div>
          }
        >
          <QualityBars
            good={overall.good}
            average={overall.average}
            bad={overall.bad}
            total={overall.total}
            onDrill={(tier) => setDrill(tier.toLowerCase() as DrillId)}
          />
        </AppCard>

        <AppCard
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Audit funnel
              </h3>
              <p className="text-xs text-fg-subtle">By current status</p>
            </div>
          }
          className="lg:col-span-2"
        >
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <FunnelTile
              label="In progress"
              value={overall.inProgress}
              tone="info"
              onClick={() => setDrill("inProgress")}
            />
            <FunnelTile
              label="Submitted"
              value={overall.submitted}
              tone="accent"
              onClick={() => setDrill("submitted")}
            />
            <FunnelTile
              label="Published"
              value={overall.published - overall.reviewed}
              tone="success"
              onClick={() => setDrill("pending")}
            />
            <FunnelTile
              label="Reviewed"
              value={overall.reviewed}
              tone="success"
              onClick={() => setDrill("reviewed")}
            />
          </ul>
        </AppCard>
      </div>

      {/* Top performer / Need attention tiers.
          Phase 2 swaps the old "top 5 / bottom 5" list for a clean
          ≥ 85% vs < 85% split.  Each card surfaces a count + the
          top few names, and the whole card is clickable — opening a
          drill-down modal that lists every agent in that tier so
          supervisors / admins can act on the real underlying users. */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <PerformerTierCard
          title="Top performers"
          subtitle={`Average score ≥ ${TOP_PERFORMER_THRESHOLD}%`}
          icon={TrendingUp}
          tone="success"
          agents={topPerformers}
          empty="No agents have cleared the threshold in this range."
          onDrill={() => setDrill("topPerformers")}
        />
        <PerformerTierCard
          title="Needs attention"
          subtitle={`Average score < ${TOP_PERFORMER_THRESHOLD}%`}
          icon={TrendingDown}
          tone="danger"
          agents={needAttention}
          empty="All scored agents are above the threshold — nice."
          onDrill={() => setDrill("needAttention")}
        />
      </div>

      {/* Agent breakdown */}
      <div className="mt-5">
        <AppCard
          padding="none"
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Agent breakdown
              </h3>
              <p className="text-xs text-fg-subtle">
                Quality and pipeline split by agent
              </p>
            </div>
          }
        >
          <BreakdownTable
            rows={byAgent}
            loading={loading}
            firstColumnLabel="Agent"
            firstColumnIcon={Users}
            empty={
              error ?? (scope === "admin"
                ? "No agent activity in this range."
                : "No audits for your agents in this range.")
            }
          />
        </AppCard>
      </div>

      {/* Project breakdown */}
      <div className="mt-5">
        <AppCard
          padding="none"
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Project breakdown
              </h3>
              <p className="text-xs text-fg-subtle">
                Quality and pipeline split by project
              </p>
            </div>
          }
        >
          <BreakdownTable
            rows={byProject}
            loading={loading}
            firstColumnLabel="Project"
            firstColumnIcon={ClipboardList}
            empty={error ?? "No project activity in this range."}
          />
        </AppCard>
      </div>

      {/* Shared drill-down modal — `drillDown` selects which slice
          of audits or agents to render. Closing the modal resets
          `drill` to null so the next open is fresh. */}
      {drillDown !== null && drillDown.kind === "audits" && (
        <DrillDownModal
          variant="audits"
          open={drill !== null}
          onOpenChange={(o) => !o && setDrill(null)}
          title={drillDown.title}
          description={drillDown.description}
          audits={drillDown.audits}
        />
      )}
      {drillDown !== null && drillDown.kind === "agents" && (
        <DrillDownModal
          variant="agents"
          open={drill !== null}
          onOpenChange={(o) => !o && setDrill(null)}
          title={drillDown.title}
          description={drillDown.description}
          agents={drillDown.agents}
        />
      )}
    </PageContainer>
  );
}

/**
 * Convert the report's internal `AggRow` into the slimmer agent shape
 * the drill-down modal expects. Keeps the modal decoupled from this
 * file's data structures so it can be reused on the dashboards too.
 */
function toDrillAgentRow(r: AggRow): DrillDownAgentRow {
  return {
    agentId: r.key,
    name: r.label,
    username: (r.sublabel ?? "").replace(/^@/, ""),
    totalAudits: r.total,
    scoredAudits: r.scored,
    averageScore: r.averageScore,
    fatalCount: r.fatalCount,
  };
}

/** Number of PUBLISHED-but-not-yet-reviewed audits in the slice. */
function pendingCount(rows: AuditListItem[]): number {
  return rows.filter((a) => a.status === AuditStatus.PUBLISHED).length;
}

/**
 * Wraps any element in a button so a non-interactive KPI tile becomes
 * a clickable drill-down trigger. Falls back to a plain div when
 * disabled, so empty states (e.g. 0 fatal triggers) don't lure users
 * into an empty modal.
 */
function DrillTrigger({
  children,
  onActivate,
  disabled,
}: {
  children: React.ReactNode;
  onActivate: () => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return <div>{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onActivate}
      className="block w-full text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {children}
    </button>
  );
}

function QualityBars({
  good,
  average,
  bad,
  total,
  onDrill,
}: {
  good: number;
  average: number;
  bad: number;
  total: number;
  /** Click handler for each row — opens the matching audit drill-down. */
  onDrill?: (tier: NonNullable<QualityLabel>) => void;
}) {
  if (total === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No data in this range"
        description="Pick a wider time window to see the quality split."
        className="border-none bg-transparent"
      />
    );
  }
  const pct = (n: number) => Math.round((n / total) * 100);
  const rows: { label: NonNullable<QualityLabel>; count: number; tone: string }[] = [
    {
      label: "GOOD",
      count: good,
      tone: "bg-success/30 text-success",
    },
    {
      label: "AVERAGE",
      count: average,
      tone: "bg-warning/30 text-warning",
    },
    { label: "BAD", count: bad, tone: "bg-danger/30 text-danger" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const clickable = onDrill && r.count > 0;
        const content = (
          <div className="flex items-center gap-3">
            <span className="w-20 text-xs font-medium uppercase tracking-wide text-fg-muted">
              {r.label}
            </span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className={cn("h-full rounded-full", r.tone)}
                style={{ width: `${pct(r.count)}%` }}
              />
            </div>
            <span className="w-20 text-right text-xs tabular-nums text-fg-muted">
              {r.count} ({pct(r.count)}%)
            </span>
          </div>
        );
        return clickable ? (
          <button
            key={r.label}
            type="button"
            onClick={() => onDrill?.(r.label)}
            className="rounded-md p-1 text-left transition-colors hover:bg-bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {content}
          </button>
        ) : (
          <div key={r.label} className="p-1">
            {content}
          </div>
        );
      })}
    </div>
  );
}

function FunnelTile({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "info" | "accent" | "success";
  /** When supplied and the tile is non-zero, the whole card becomes clickable. */
  onClick?: () => void;
}) {
  const toneClass =
    tone === "info"
      ? "border-info/30 bg-info/10 text-info"
      : tone === "accent"
        ? "border-accent/30 bg-accent/10 text-accent"
        : "border-success/30 bg-success/10 text-success";
  const interactive = onClick !== undefined && value > 0;
  const inner = (
    <>
      <span className="text-[11px] font-medium uppercase tracking-wider opacity-80">
        {label}
      </span>
      <span className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-fg">
        {value}
      </span>
    </>
  );
  return (
    <li
      className={cn(
        "flex flex-col rounded-md border bg-bg-elevated px-3 py-2",
        toneClass,
        interactive && "transition-transform hover:-translate-y-0.5",
      )}
    >
      {interactive ? (
        <button
          type="button"
          onClick={onClick}
          className="flex flex-col items-stretch text-left focus-visible:outline-none"
        >
          {inner}
        </button>
      ) : (
        inner
      )}
    </li>
  );
}

/**
 * Phase 2 — performance tier card.
 *
 * Replaces the old fixed "top 5 / bottom 5" leaderboard with an
 * operationally useful classification: either an agent is at or
 * above the threshold (Top performer) or below it (Needs attention).
 *
 * The card shows a headline count, a preview of the first few
 * names, and the whole tile is clickable — opening a drill-down
 * modal with the full list and inline search.
 */
function PerformerTierCard({
  title,
  subtitle,
  icon: Icon,
  tone,
  agents,
  empty,
  onDrill,
}: {
  title: string;
  subtitle: string;
  icon: typeof TrendingUp;
  tone: "success" | "danger";
  agents: DrillDownAgentRow[];
  empty: string;
  onDrill: () => void;
}) {
  const toneText = tone === "success" ? "text-success" : "text-danger";
  const toneCount = tone === "success" ? "text-success" : "text-danger";
  const preview = agents.slice(0, 5);
  return (
    <AppCard
      header={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", toneText)} />
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                {title}
              </h3>
              <p className="text-[11px] text-fg-subtle">{subtitle}</p>
            </div>
          </div>
          <span className={cn("text-2xl font-semibold tabular-nums", toneCount)}>
            {agents.length}
          </span>
        </div>
      }
    >
      {preview.length === 0 ? (
        <EmptyState
          title="—"
          description={empty}
          className="border-none bg-transparent"
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {preview.map((r, i) => (
              <li
                key={r.agentId}
                className="flex items-center gap-3 rounded-md border border-border bg-bg-elevated px-3 py-1.5"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg-muted text-[11px] font-semibold tabular-nums text-fg-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{r.name}</p>
                  <p className="truncate text-[11px] text-fg-subtle">
                    @{r.username} · {r.totalAudits} audit
                    {r.totalAudits === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={cn("text-sm font-semibold tabular-nums", toneText)}
                >
                  {r.averageScore === null
                    ? "—"
                    : `${r.averageScore.toFixed(1)}%`}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onDrill}
            className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-border bg-bg-elevated text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            View all {agents.length} agent{agents.length === 1 ? "" : "s"}
          </button>
        </>
      )}
    </AppCard>
  );
}

function BreakdownTable({
  rows,
  loading,
  firstColumnLabel,
  firstColumnIcon: Icon,
  empty,
}: {
  rows: AggRow[];
  loading: boolean;
  firstColumnLabel: string;
  firstColumnIcon: typeof Users;
  empty: string;
}) {
  const columns: DataTableColumn<AggRow>[] = useMemo(
    () => [
      {
        key: "label",
        header: firstColumnLabel,
        cell: (r) => (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-muted text-fg-muted">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{r.label}</p>
              {r.sublabel && (
                <p className="truncate text-[11px] text-fg-subtle">{r.sublabel}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "total",
        header: "Audits",
        align: "right",
        numeric: true,
        cell: (r) => <span className="tabular-nums text-sm text-fg">{r.total}</span>,
      },
      {
        key: "avg",
        header: "Avg",
        align: "right",
        numeric: true,
        cell: (r) => (
          <span className="text-sm font-semibold tabular-nums text-fg">
            {r.averageScore === null ? "—" : `${r.averageScore.toFixed(1)}%`}
          </span>
        ),
      },
      {
        key: "quality",
        header: "Quality split",
        cell: (r) => (
          <div className="flex items-center gap-1.5">
            <QualityChip count={r.good} tone="GOOD" />
            <QualityChip count={r.average} tone="AVERAGE" />
            <QualityChip count={r.bad} tone="BAD" />
          </div>
        ),
      },
      {
        key: "fatal",
        header: "Fatal",
        align: "right",
        numeric: true,
        cell: (r) => (
          <span
            className={cn(
              "tabular-nums text-sm",
              r.fatalCount > 0 ? "text-danger" : "text-fg-muted",
            )}
          >
            {r.fatalCount}
          </span>
        ),
      },
      {
        key: "pipe",
        header: "Pending / Reviewed",
        align: "right",
        cell: (r) => (
          <span className="whitespace-nowrap text-xs text-fg-subtle">
            {r.pending} / {r.reviewed}
          </span>
        ),
      },
    ],
    [firstColumnLabel, Icon],
  );

  return (
    <DataTable<AggRow>
      columns={columns}
      data={rows}
      rowKey={(r) => r.key}
      loading={loading}
      loadingRows={5}
      emptyState={
        <EmptyState
          icon={Icon}
          title="No data"
          description={empty}
          className="border-none bg-transparent"
        />
      }
    />
  );
}

function QualityChip({
  count,
  tone,
}: {
  count: number;
  tone: NonNullable<QualityLabel>;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        QUALITY_TONE[tone],
      )}
    >
      {tone} · {count}
    </span>
  );
}

export default ReportsView;
