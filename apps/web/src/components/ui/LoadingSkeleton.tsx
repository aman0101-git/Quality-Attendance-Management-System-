import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Convenience: renders a shimmering rectangle */
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "full";
}

/**
 * Single shimmer block.
 */
export function Skeleton({
  className,
  width,
  height,
  rounded = "md",
  style,
  ...props
}: SkeletonProps) {
  const roundedClass =
    rounded === "full"
      ? "rounded-full"
      : rounded === "sm"
      ? "rounded"
      : "rounded-md";

  return (
    <div
      {...props}
      className={cn("animate-shimmer block", roundedClass, className)}
      style={{
        width,
        height: height ?? "0.75rem",
        ...style,
      }}
    />
  );
}

interface LoadingSkeletonProps {
  /** Number of stacked rows. */
  rows?: number;
  /** Optional inline label rendered above the skeleton */
  label?: string;
  className?: string;
}

/**
 * Stacked skeleton rows — convenient default for lists and panels.
 */
export function LoadingSkeleton({
  rows = 3,
  label,
  className,
}: LoadingSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-busy="true" aria-live="polite">
      {label && (
        <p className="text-xs font-medium text-fg-subtle">{label}</p>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          height="0.75rem"
          width={i === rows - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

export default LoadingSkeleton;
