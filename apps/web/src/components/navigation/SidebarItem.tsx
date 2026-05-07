import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { NavItem } from "@/types/navigation";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  item: NavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
}

/**
 * Single sidebar entry. Highlights active route, supports collapsed mode
 * (icon + tooltip) and an optional badge.
 */
export function SidebarItem({ item, collapsed = false, onNavigate }: SidebarItemProps) {
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.path}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
          "text-fg-muted transition-colors duration-150",
          "hover:bg-bg-muted hover:text-fg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          isActive && "text-fg",
          collapsed && "justify-center px-2"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active-pill"
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="absolute inset-0 -z-10 rounded-md border border-accent/30 bg-accent/10"
            />
          )}

          <Icon
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-colors",
              isActive ? "text-accent" : "text-fg-subtle group-hover:text-fg"
            )}
          />

          {!collapsed && (
            <span className="flex-1 truncate">{item.label}</span>
          )}

          {!collapsed && item.badge && (
            <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={10}
            className="z-50 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-fg shadow-elev-2"
          >
            {item.label}
            {item.badge && (
              <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">
                {item.badge}
              </span>
            )}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export default SidebarItem;
