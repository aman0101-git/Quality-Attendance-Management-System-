import type { NavGroup } from "@/types/navigation";
import { cn } from "@/lib/utils";
import { SidebarItem } from "./SidebarItem";

interface SidebarGroupProps {
  group: NavGroup;
  collapsed?: boolean;
  onNavigate?: () => void;
}

/**
 * Renders a heading (when expanded) followed by its nav items.
 */
export function SidebarGroup({ group, collapsed = false, onNavigate }: SidebarGroupProps) {
  return (
    <div className="flex flex-col gap-1">
      {group.heading && !collapsed && (
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          {group.heading}
        </p>
      )}

      {group.heading && collapsed && (
        <div
          className={cn(
            "mx-3 my-2 h-px bg-border",
            "first:hidden"
          )}
          aria-hidden
        />
      )}

      <div className="flex flex-col gap-0.5">
        {group.items.map((item) => (
          <SidebarItem
            key={item.path}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

export default SidebarGroup;
