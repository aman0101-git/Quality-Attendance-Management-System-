import type { LucideIcon } from "lucide-react";

export type UserRole = "ADMIN" | "SUPERVISOR" | "AGENT";

export interface NavItem {
  /** Display label */
  label: string;
  /** Absolute route path */
  path: string;
  /** lucide-react icon component */
  icon: LucideIcon;
  /** Optional badge text */
  badge?: string;
  /** Hide on small screens */
  desktopOnly?: boolean;
}

export interface NavGroup {
  /** Optional heading */
  heading?: string;
  items: NavItem[];
}
