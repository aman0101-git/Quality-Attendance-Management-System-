import { LineChart } from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";

interface PerformancePlaceholderProps {
  title?: string;
  description?: string;
}

/**
 * Visual placeholder for charts that will be wired up in later phases.
 * Renders a subtle grid + empty state to convey "coming soon" UI.
 */
export function PerformancePlaceholder({
  title = "Performance trend",
  description = "Charts will surface here once feature modules are wired up.",
}: PerformancePlaceholderProps) {
  return (
    <AppCard
      padding="none"
      header={
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-fg">
            {title}
          </h3>
          <p className="text-xs text-fg-subtle">Last 14 days · placeholder</p>
        </div>
      }
    >
      <div className="relative h-64 w-full overflow-hidden">
        {/* subtle grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--border)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--border)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            backgroundPosition: "-1px -1px",
          }}
        />
        {/* fake area sweep */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-32"
          style={{
            background:
              "linear-gradient(180deg, rgb(var(--accent) / 0.18) 0%, transparent 100%)",
            clipPath:
              "polygon(0% 80%, 8% 65%, 18% 70%, 30% 45%, 42% 52%, 55% 30%, 68% 38%, 82% 22%, 100% 30%, 100% 100%, 0% 100%)",
          }}
        />

        <div className="relative z-10 flex h-full items-center justify-center p-6">
          <EmptyState
            icon={LineChart}
            title="Charts coming soon"
            description={description}
            className="border-none bg-transparent"
          />
        </div>
      </div>
    </AppCard>
  );
}

export default PerformancePlaceholder;
