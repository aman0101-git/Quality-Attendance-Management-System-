import { GitCommit } from "lucide-react";
import { cn } from "@/lib/utils";

interface VersionBadgeProps {
  version: number;
  className?: string;
}

/**
 * Compact version pill — shown next to scorecard names in the list and
 * editor header. Bumps whenever the structure is replaced.
 */
export function VersionBadge({ version, className }: VersionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-bg-muted px-1.5 py-0.5",
        "text-[10px] font-medium uppercase tracking-wider text-fg-muted",
        className,
      )}
    >
      <GitCommit className="h-3 w-3" />
      v{version}
    </span>
  );
}

export default VersionBadge;
