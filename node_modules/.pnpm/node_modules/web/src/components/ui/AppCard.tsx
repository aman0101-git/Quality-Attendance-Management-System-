import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type AppCardVariant = "solid" | "glass" | "outline";
type AppCardPadding = "none" | "sm" | "md" | "lg";

interface AppCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AppCardVariant;
  padding?: AppCardPadding;
  interactive?: boolean;
  /** Wraps children in a fade-in motion effect */
  animate?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}

const paddingMap: Record<AppCardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-7",
};

const variantMap: Record<AppCardVariant, string> = {
  solid: "bg-surface border border-border shadow-elev-1",
  glass: "glass-panel",
  outline: "bg-transparent border border-border",
};

/**
 * Foundational card surface used across dashboards. Supports glass,
 * solid and outline variants with optional header/footer slots.
 */
export const AppCard = forwardRef<HTMLDivElement, AppCardProps>(
  (
    {
      variant = "solid",
      padding = "md",
      interactive = false,
      animate = false,
      header,
      footer,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const content = (
      <div
        ref={ref}
        {...props}
        className={cn(
          "rounded-lg",
          variantMap[variant],
          interactive &&
            "transition-all duration-200 hover:border-border-strong hover:shadow-elev-2",
          className
        )}
      >
        {header && (
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            {header}
          </div>
        )}

        <div className={cn(header || footer ? paddingMap[padding] : paddingMap[padding])}>
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-fg-muted">
            {footer}
          </div>
        )}
      </div>
    );

    if (!animate) return content;

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {content}
      </motion.div>
    );
  }
);
AppCard.displayName = "AppCard";

export default AppCard;
