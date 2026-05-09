import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface DefaultBadgeProps {
  className?: string;
}

/**
 * Marker shown on the single global default QA template — the one the
 * audit wizard auto-attaches to every audit.
 */
export function DefaultBadge({ className }: DefaultBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-1.5 py-0.5",
        "text-[10px] font-medium uppercase tracking-wider text-accent",
        className,
      )}
    >
      <Star className="h-3 w-3 fill-current" />
      Default
    </span>
  );
}

export default DefaultBadge;
