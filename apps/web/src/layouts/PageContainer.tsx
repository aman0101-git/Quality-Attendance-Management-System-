import type { HTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Constrains content width. Defaults to a comfortable enterprise width. */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  /** Page-level title rendered before children */
  title?: string;
  /** Subtitle / description rendered below the title */
  description?: string;
  /** Right-aligned slot, e.g. CTA buttons */
  actions?: ReactNode;
  /** Disable the route fade-in animation */
  noAnimation?: boolean;
}

const widthMap: Record<NonNullable<PageContainerProps["maxWidth"]>, string> = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

/**
 * Standard authenticated page wrapper. Provides consistent padding,
 * max-width, optional page header and a subtle route fade.
 */
export function PageContainer({
  maxWidth = "xl",
  title,
  description,
  actions,
  noAnimation = false,
  className,
  children,
  ...props
}: PageContainerProps) {
  const inner = (
    <div
      {...props}
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
        widthMap[maxWidth],
        className
      )}
    >
      {(title || actions) && (
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight text-fg">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1 text-sm text-fg-muted">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}

      {children}
    </div>
  );

  if (noAnimation) return inner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {inner}
    </motion.div>
  );
}

export default PageContainer;
