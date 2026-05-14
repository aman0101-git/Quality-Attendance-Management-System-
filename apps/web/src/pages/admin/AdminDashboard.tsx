import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ClipboardCheck,
  ClipboardList,
  ShieldCheck,
  Star,
  UserPlus,
  UserSquare2,
  Users,
} from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { WelcomeHeader } from "@/features/dashboard/components/WelcomeHeader";
import { TimeFilterChips } from "@/features/dashboard/components/TimeFilterChips";
import { StatCard } from "@/components/ui/StatCard";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddUserDialog } from "@/features/users/components/AddUserDialog";
import { listUsers, type ManagedUser } from "@/features/users/api";
import { listAudits } from "@/features/audits/api";
import {
  AuditStatus,
  type AuditListItem,
} from "@/features/audits/types";
import {
  dateRangeFor,
  formatDate,
  isWithinRange,
  type DateRangePreset,
} from "@/lib/utils";
import { DrillDownModal } from "@/features/reports/components/DrillDownModal";

/** Drill-down identifier for the admin dashboard KPIs. */
type DashboardDrill =
  | "all"
  | "submitted"
  | "published"
  | "reviewed"
  | null;

/**
 * Admin dashboard — workspace-wide directory + audit KPIs. The time
 * filter applies to the audit metrics; user counts are static (a user
 * is created once and persists, so range-filtering them produces a
 * misleading "no users" empty state).
 */
export default function AdminDashboard() {
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangePreset>("all");
  const [drill, setDrill] = useState<DashboardDrill>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, a] = await Promise.all([listUsers(), listAudits()]);
      setUsers(u);
      setAudits(a);
    } catch (e) {
      console.error(e);
      setError("Could not load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const filteredAudits = useMemo(() => {
    const r = dateRangeFor(range);
    return audits.filter((a) => isWithinRange(a.createdAt, r));
  }, [audits, range]);

  const userStats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const supervisors = users.filter((u) => u.role === "SUPERVISOR").length;
    const agents = users.filter((u) => u.role === "AGENT").length;
    return { total, active, supervisors, agents };
  }, [users]);

  const auditStats = useMemo(() => {
    const total = filteredAudits.length;
    const submitted = filteredAudits.filter(
      (a) => a.status === AuditStatus.SUBMITTED,
    ).length;
    const published = filteredAudits.filter(
      (a) =>
        a.status === AuditStatus.PUBLISHED ||
        a.status === AuditStatus.REVIEWED,
    );
    const reviewed = filteredAudits.filter(
      (a) => a.status === AuditStatus.REVIEWED,
    ).length;

    const scored = published.filter(
      (a) => a.finalScore !== null && !a.fatalTriggered,
    );
    const avgScore =
      scored.length > 0
        ? scored.reduce((acc, a) => acc + (a.finalScore ?? 0), 0) /
          scored.length
        : null;

    return {
      total,
      submitted,
      published: published.length,
      reviewed,
      avgScore,
    };
  }, [filteredAudits]);

  const recentUsers = useMemo(() => {
    return [...users]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 6);
  }, [users]);

  return (
    <PageContainer maxWidth="xl">
      <WelcomeHeader
        eyebrow="Admin overview"
        description="Workspace-wide users, audits, and the global QA template."
        actions={
          <>
            <Link
              to="/admin/users"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <Users className="h-4 w-4" /> View users
            </Link>
            <button
              onClick={() => setAddUserOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
            >
              <UserPlus className="h-4 w-4" /> Add user
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TimeFilterChips value={range} onChange={setRange} />
        <p className="text-xs text-fg-subtle">
          Audit KPIs honour the selected range — user counts are workspace-wide.
        </p>
      </div>

      {/* Audit KPIs — driven by the time filter. Every tile drills
          down to the records behind the number; the modal lists are
          workspace-wide (admin scope is enforced server-side by
          `listAudits`). */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiButton
          disabled={loading || auditStats.total === 0}
          onClick={() => setDrill("all")}
        >
          <StatCard
            label="Audits in range"
            value={loading ? "—" : auditStats.total}
            icon={ClipboardList}
            loading={loading}
            description={
              auditStats.total > 0 ? "Click to drill down" : undefined
            }
          />
        </KpiButton>
        <KpiButton
          disabled={loading || auditStats.submitted === 0}
          onClick={() => setDrill("submitted")}
        >
          <StatCard
            label="Submitted"
            value={loading ? "—" : auditStats.submitted}
            icon={ClipboardCheck}
            description="Awaiting publish"
            loading={loading}
          />
        </KpiButton>
        <KpiButton
          disabled={loading || auditStats.published === 0}
          onClick={() => setDrill("published")}
        >
          <StatCard
            label="Published"
            value={loading ? "—" : auditStats.published}
            icon={ClipboardCheck}
            description={`${auditStats.reviewed} reviewed`}
            loading={loading}
          />
        </KpiButton>
        <KpiButton
          disabled={loading || auditStats.published === 0}
          onClick={() => setDrill("published")}
        >
          <StatCard
            label="Avg score"
            value={
              loading
                ? "—"
                : auditStats.avgScore === null
                  ? "—"
                  : `${auditStats.avgScore.toFixed(1)}%`
            }
            icon={Star}
            description={`across ${auditStats.published} published`}
            loading={loading}
          />
        </KpiButton>
      </div>

      {/* Drill-down modal — picks a slice from the already admin-
          scoped `filteredAudits`. Admin sees workspace-wide data,
          which matches the existing audit list permission rules. */}
      <DrillDownModal
        variant="audits"
        open={drill !== null}
        onOpenChange={(o) => !o && setDrill(null)}
        title={
          drill === "submitted"
            ? "Submitted (awaiting publish)"
            : drill === "published"
              ? "Published audits"
              : drill === "reviewed"
                ? "Reviewed by agent"
                : "Audits in range"
        }
        audits={
          drill === "submitted"
            ? filteredAudits.filter((a) => a.status === AuditStatus.SUBMITTED)
            : drill === "published"
              ? filteredAudits.filter(
                  (a) =>
                    a.status === AuditStatus.PUBLISHED ||
                    a.status === AuditStatus.REVIEWED,
                )
              : drill === "reviewed"
                ? filteredAudits.filter(
                    (a) => a.status === AuditStatus.REVIEWED,
                  )
                : filteredAudits
        }
      />

      {/* Workspace directory snapshot */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={loading ? "—" : userStats.total}
          icon={Users}
          description={`${userStats.active} active`}
          loading={loading}
        />
        <StatCard
          label="Supervisors"
          value={loading ? "—" : userStats.supervisors}
          icon={ShieldCheck}
          loading={loading}
        />
        <StatCard
          label="Agents"
          value={loading ? "—" : userStats.agents}
          icon={UserSquare2}
          loading={loading}
        />
        <StatCard
          label="QA template"
          value="Global"
          icon={ClipboardList}
          description="Shared across all audits"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <AppCard
          padding="none"
          className="lg:col-span-2"
          header={
            <>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-fg">
                  Recently added users
                </h3>
                <p className="text-xs text-fg-subtle">
                  Latest entries in the directory
                </p>
              </div>
              <Link
                to="/admin/users"
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
              title="Couldn't load dashboard"
              description={error}
              className="border-none bg-transparent"
            />
          ) : recentUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Add your first supervisor or agent to get started."
              className="border-none bg-transparent"
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 px-5 py-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">
                      {u.name}
                    </p>
                    <p className="truncate text-xs text-fg-subtle">
                      @{u.username}
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      u.role === "ADMIN"
                        ? "info"
                        : u.role === "SUPERVISOR"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                  </StatusBadge>
                  <span className="hidden whitespace-nowrap text-xs text-fg-subtle sm:inline">
                    {formatDate(u.createdAt)}
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
                Quick actions
              </h3>
              <p className="text-xs text-fg-subtle">Most common admin tasks</p>
            </div>
          }
        >
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setAddUserOpen(true)}
              className="inline-flex h-10 items-center justify-between gap-2 rounded-md border border-border bg-bg-elevated px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-accent" />
                Add user
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-fg-subtle" />
            </button>
            <Link
              to="/admin/users"
              className="inline-flex h-10 items-center justify-between gap-2 rounded-md border border-border bg-bg-elevated px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                Manage users
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-fg-subtle" />
            </Link>
            <Link
              to="/admin/scorecards"
              className="inline-flex h-10 items-center justify-between gap-2 rounded-md border border-border bg-bg-elevated px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <span className="inline-flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-accent" />
                Edit QA template
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-fg-subtle" />
            </Link>
          </div>
        </AppCard>
      </div>

      <AddUserDialog
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        actorRole="ADMIN"
        onCreated={() => void fetchAll()}
      />
    </PageContainer>
  );
}

/**
 * Wraps a StatCard so the whole tile becomes a click target for a
 * drill-down. When `disabled` (loading or zero matching audits) the
 * wrapper degrades to a plain div so users don't get lured into an
 * empty modal.
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
