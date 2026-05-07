import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, ShieldCheck, LogOut } from "lucide-react";
import { useAuthStore } from "@/features/auth/store/authStore";
import { getSidebarGroups } from "@/components/navigation/sidebar.config";
import { SidebarGroup } from "@/components/navigation/SidebarGroup";
import type { UserRole } from "@/types/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * Desktop sidebar. Width animates between collapsed and expanded states.
 */
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const role = (user?.role as UserRole | undefined) ?? null;
  const groups = getSidebarGroups(role);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 lg:flex",
        "flex-col border-r border-border bg-bg-elevated"
      )}
      aria-label="Primary"
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-[60px] items-center border-b border-border px-4",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-accent to-info text-accent-fg shadow-elev-1">
            <ShieldCheck className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-fg">
                QAMS
              </p>
              <p className="text-[10px] uppercase tracking-wider text-fg-subtle">
                Quality &amp; Attendance
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-4">
          {groups.map((group, i) => (
            <SidebarGroup key={group.heading ?? i} group={group} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        {!collapsed && user && (
          <div className="mb-3 flex items-center gap-3 rounded-md border border-border bg-surface p-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
              {user.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{user.name}</p>
              <p className="truncate text-xs text-fg-subtle">{user.role}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border border-border",
              "text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              "transition-colors"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                Collapse
              </>
            )}
          </button>

          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border",
              "text-fg-muted hover:bg-danger/10 hover:text-danger hover:border-danger/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              "transition-colors"
            )}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}

export default Sidebar;
