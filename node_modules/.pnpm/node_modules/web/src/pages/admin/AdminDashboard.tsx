import { Download, Plus } from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { WelcomeHeader } from "@/features/dashboard/components/WelcomeHeader";
import { StatGrid } from "@/features/dashboard/components/StatGrid";
import { RecentActivityCard } from "@/features/dashboard/components/RecentActivityCard";
import { PerformancePlaceholder } from "@/features/dashboard/components/PerformancePlaceholder";
import { ADMIN_STATS, RECENT_ACTIVITY } from "@/features/dashboard/mock";
import { AppCard } from "@/components/ui/AppCard";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export default function AdminDashboard() {
  return (
    <PageContainer maxWidth="xl">
      <WelcomeHeader
        eyebrow="Admin overview"
        description="Monitor system health, audit progress and user activity at a glance."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg">
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90">
              <Plus className="h-4 w-4" /> Invite user
            </button>
          </>
        }
      />

      <StatGrid stats={ADMIN_STATS} />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformancePlaceholder
            title="Workspace activity"
            description="Workspace KPI charts will appear here once feature modules begin shipping."
          />
        </div>

        <AppCard
          header={
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                System status
              </h3>
              <p className="text-xs text-fg-subtle">Live placeholder</p>
            </div>
          }
        >
          <LoadingSkeleton rows={4} />
        </AppCard>
      </div>

      <div className="mt-6">
        <RecentActivityCard rows={RECENT_ACTIVITY} />
      </div>
    </PageContainer>
  );
}
