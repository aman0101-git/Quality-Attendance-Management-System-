import { ClipboardList, Filter } from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { WelcomeHeader } from "@/features/dashboard/components/WelcomeHeader";
import { StatGrid } from "@/features/dashboard/components/StatGrid";
import { RecentActivityCard } from "@/features/dashboard/components/RecentActivityCard";
import { PerformancePlaceholder } from "@/features/dashboard/components/PerformancePlaceholder";
import { SUPERVISOR_STATS, RECENT_ACTIVITY } from "@/features/dashboard/mock";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SupervisorDashboard() {
  return (
    <PageContainer maxWidth="xl">
      <WelcomeHeader
        eyebrow="Operations"
        description="Track audits, calls and your team's quality scores in real time."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg">
              <Filter className="h-4 w-4" /> Filters
            </button>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90">
              <ClipboardList className="h-4 w-4" /> New audit
            </button>
          </>
        }
      />

      <StatGrid stats={SUPERVISOR_STATS} />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformancePlaceholder
            title="Team quality trend"
            description="Once audits start flowing in, average team score will be plotted here."
          />
        </div>

        <AppCard
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Top performers
              </h3>
              <p className="text-xs text-fg-subtle">This week</p>
            </div>
          }
        >
          <EmptyState
            title="No leaderboard yet"
            description="As your team racks up audits, top performers will appear here."
          />
        </AppCard>
      </div>

      <div className="mt-6">
        <RecentActivityCard rows={RECENT_ACTIVITY} />
      </div>
    </PageContainer>
  );
}
