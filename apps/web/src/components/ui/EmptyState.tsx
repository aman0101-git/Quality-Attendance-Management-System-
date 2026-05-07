import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

/**
 * Empty / no-data placeholder. Used inside cards and tables.
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md",
        "border border-dashed border-border bg-bg-muted/40 px-6 py-10 text-center",
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-fg">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-fg-subtle">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
