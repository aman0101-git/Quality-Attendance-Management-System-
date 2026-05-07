import { StatCard } from "@/components/ui/StatCard";
import type { DashboardStat } from "../mock";

interface StatGridProps {
  stats: DashboardStat[];
  loading?: boolean;
}

/**
 * Responsive 1/2/4-column stat grid used at the top of every dashboard.
 */
export function StatGrid({ stats, loading = false }: StatGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <StatCard
          key={s.label}
          label={s.label}
          value={s.value}
          icon={s.icon}
          trend={s.trend}
          loading={loading}
        />
      ))}
    </div>
  );
}

export default StatGrid;
