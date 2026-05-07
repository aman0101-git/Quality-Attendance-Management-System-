import { History, Sparkles } from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { WelcomeHeader } from "@/features/dashboard/components/WelcomeHeader";
import { StatGrid } from "@/features/dashboard/components/StatGrid";
import { RecentActivityCard } from "@/features/dashboard/components/RecentActivityCard";
import { PerformancePlaceholder } from "@/features/dashboard/components/PerformancePlaceholder";
import { AGENT_STATS, RECENT_ACTIVITY } from "@/features/dashboard/mock";
import { AppCard } from "@/components/ui/AppCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

const COACHING_TIPS = [
  { id: 1, title: "Active listening", tone: "purple" as const },
  { id: 2, title: "Empathy phrasing", tone: "info" as const },
  { id: 3, title: "Quicker resolutions", tone: "success" as const },
];

export default function AgentDashboard() {
  return (
    <PageContainer maxWidth="xl">
      <WelcomeHeader
        eyebrow="Your performance"
        description="See how you're tracking against your goals and recent feedback."
        actions={
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg">
            <History className="h-4 w-4" /> Audit history
          </button>
        }
      />

      <StatGrid stats={AGENT_STATS} />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformancePlaceholder
            title="Your quality score"
            description="Your quality score and trend will be plotted here in upcoming releases."
          />
        </div>

        <AppCard
          header={
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Focus areas
              </h3>
            </div>
          }
        >
          <ul className="flex flex-col gap-2.5">
            {COACHING_TIPS.map((tip) => (
              <li
                key={tip.id}
                className="flex items-center justify-between rounded-md border border-border bg-bg-muted/40 px-3 py-2"
              >
                <span className="text-sm text-fg">{tip.title}</span>
                <StatusBadge tone={tip.tone}>Suggested</StatusBadge>
              </li>
            ))}
          </ul>
        </AppCard>
      </div>

      <div className="mt-6">
        <RecentActivityCard rows={RECENT_ACTIVITY} />
      </div>
    </PageContainer>
  );
}
