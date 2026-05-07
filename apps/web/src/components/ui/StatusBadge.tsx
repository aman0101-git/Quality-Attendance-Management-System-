import type { ReactNode } from "react";
import type { StatusTone } from "@/types/common";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  tone?: StatusTone;
  children: ReactNode;
  /** Render with a soft dot indicator */
  withDot?: boolean;
  className?: string;
}

const toneClasses: Record<StatusTone, { wrap: string; dot: string }> = {
  neutral: {
    wrap: "bg-bg-muted text-fg-muted border-border",
    dot: "bg-fg-subtle",
  },
  success: {
    wrap: "bg-success/10 text-success border-success/20",
    dot: "bg-success",
  },
  warning: {
    wrap: "bg-warning/10 text-warning border-warning/20",
    dot: "bg-warning",
  },
  danger: {
    wrap: "bg-danger/10 text-danger border-danger/20",
    dot: "bg-danger",
  },
  info: {
    wrap: "bg-info/10 text-info border-info/20",
    dot: "bg-info",
  },
  purple: {
    wrap: "bg-accent/10 text-accent border-accent/25",
    dot: "bg-accent",
  },
};

/**
 * Pill badge used for statuses, severity, scoring, etc.
 */
export function StatusBadge({
  tone = "neutral",
  children,
  withDot = true,
  className,
}: StatusBadgeProps) {
  const classes = toneClasses[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-xs font-medium",
        classes.wrap,
        className
      )}
    >
      {withDot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", classes.dot)}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

export default StatusBadge;
