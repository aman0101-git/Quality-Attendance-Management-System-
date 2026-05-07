import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface StatTrend {
  /** Human-readable delta, e.g. "+12.4%" */
  value: string;
  /** Direction influences color and icon */
  direction: "up" | "down" | "flat";
  /** Optional helper text — e.g. "vs last week" */
  helper?: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: StatTrend;
  description?: string;
  className?: string;
  loading?: boolean;
}

/**
 * Compact KPI card. Used heavily on the dashboard overview rows.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  description,
  className,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-surface p-5",
          "shadow-elev-1",
          className
        )}
      >
        <div className="h-3 w-24 animate-shimmer rounded" />
        <div className="mt-4 h-7 w-32 animate-shimmer rounded" />
        <div className="mt-3 h-3 w-20 animate-shimmer rounded" />
      </div>
    );
  }

  const trendTone =
    trend?.direction === "up"
      ? "text-success bg-success/10"
      : trend?.direction === "down"
      ? "text-danger bg-danger/10"
      : "text-fg-subtle bg-bg-muted";

  const TrendIcon =
    trend?.direction === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-surface p-5",
        "shadow-elev-1 transition-all duration-200",
        "hover:border-border-strong hover:shadow-elev-2",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
          {label}
        </p>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg-muted text-accent">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight text-fg">{value}</p>

        {trend && trend.direction !== "flat" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              trendTone
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {trend.value}
          </span>
        )}
      </div>

      {(description || trend?.helper) && (
        <p className="mt-2 text-xs text-fg-subtle">
          {trend?.helper ?? description}
        </p>
      )}
    </motion.div>
  );
}

export default StatCard;
