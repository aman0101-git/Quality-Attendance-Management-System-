import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Settings,
  ClipboardList,
  PhoneCall,
  BarChart3,
  Trophy,
  History,
} from "lucide-react";
import type { NavGroup, UserRole } from "@/types/navigation";

/**
 * Centralized, role-aware sidebar configuration.
 *
 * Add or reorder routes here. Layouts/sidebar components
 * read this map and render the correct group set per role.
 */
export const SIDEBAR_CONFIG: Record<UserRole, NavGroup[]> = {
  ADMIN: [
    {
      heading: "Overview",
      items: [
        { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
      ],
    },
    {
      heading: "Administration",
      items: [
        { label: "Users", path: "/admin/users", icon: Users },
        { label: "Roles", path: "/admin/roles", icon: ShieldCheck },
        { label: "Settings", path: "/admin/settings", icon: Settings },
      ],
    },
  ],

  SUPERVISOR: [
    {
      heading: "Overview",
      items: [
        { label: "Dashboard", path: "/supervisor", icon: LayoutDashboard },
      ],
    },
    {
      heading: "Operations",
      items: [
        { label: "Audits", path: "/supervisor/audits", icon: ClipboardList },
        { label: "Calls", path: "/supervisor/calls", icon: PhoneCall },
        { label: "Reports", path: "/supervisor/reports", icon: BarChart3 },
      ],
    },
  ],

  AGENT: [
    {
      heading: "Overview",
      items: [
        { label: "Dashboard", path: "/agent", icon: LayoutDashboard },
      ],
    },
    {
      heading: "Performance",
      items: [
        { label: "My Scores", path: "/agent/scores", icon: Trophy },
        { label: "Audit History", path: "/agent/audits", icon: History },
      ],
    },
  ],
};

/** Resolve the correct nav-group list for a given role (or empty if unknown). */
export function getSidebarGroups(role: UserRole | null | undefined): NavGroup[] {
  if (!role) return [];
  return SIDEBAR_CONFIG[role] ?? [];
}
