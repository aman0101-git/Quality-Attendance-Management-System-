import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Optional right-aligned slot, e.g. action buttons or filters */
  actions?: ReactNode;
  /** Increases spacing for top-of-page hero use */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap: Record<NonNullable<SectionHeaderProps["size"]>, {
  title: string;
  description: string;
  margin: string;
}> = {
  sm: {
    title: "text-base font-semibold",
    description: "text-xs text-fg-subtle",
    margin: "mb-3",
  },
  md: {
    title: "text-lg font-semibold tracking-tight",
    description: "text-sm text-fg-muted",
    margin: "mb-4",
  },
  lg: {
    title: "text-2xl font-semibold tracking-tight",
    description: "text-sm text-fg-muted",
    margin: "mb-6",
  },
};

/**
 * Reusable section heading with title, supporting copy and an actions slot.
 */
export function SectionHeader({
  title,
  description,
  actions,
  size = "md",
  className,
}: SectionHeaderProps) {
  const s = sizeMap[size];
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        s.margin,
        className
      )}
    >
      <div className="min-w-0">
        <h2 className={cn(s.title, "text-fg")}>{title}</h2>
        {description && (
          <p className={cn("mt-1", s.description)}>{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export default SectionHeader;
