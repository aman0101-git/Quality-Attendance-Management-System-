import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ClipboardCheck,
  PhoneCall,
  Star,
  Users,
  TimerReset,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import type { StatusTone } from "@/types/common";

/**
 * UI-foundation mock data only. No business logic — these are placeholders
 * that will be replaced with real backend data once feature modules begin.
 */

export interface DashboardStat {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: string; direction: "up" | "down" | "flat"; helper?: string };
}

export const ADMIN_STATS: DashboardStat[] = [
  {
    label: "Total Users",
    value: "1,284",
    icon: Users,
    trend: { value: "+3.4%", direction: "up", helper: "vs last week" },
  },
  {
    label: "Active Audits",
    value: "73",
    icon: ClipboardCheck,
    trend: { value: "+12", direction: "up", helper: "in progress" },
  },
  {
    label: "System Uptime",
    value: "99.98%",
    icon: Activity,
    trend: { value: "0.0%", direction: "flat", helper: "30-day avg" },
  },
  {
    label: "Open Incidents",
    value: "2",
    icon: AlertTriangle,
    trend: { value: "-1", direction: "down", helper: "since yesterday" },
  },
];

export const SUPERVISOR_STATS: DashboardStat[] = [
  {
    label: "Audits Today",
    value: "42",
    icon: ClipboardCheck,
    trend: { value: "+8", direction: "up", helper: "vs yesterday" },
  },
  {
    label: "Calls Reviewed",
    value: "186",
    icon: PhoneCall,
    trend: { value: "+5.2%", direction: "up", helper: "this week" },
  },
  {
    label: "Avg Quality Score",
    value: "87.4",
    icon: Star,
    trend: { value: "+1.1", direction: "up", helper: "vs last week" },
  },
  {
    label: "Pending Reviews",
    value: "9",
    icon: TimerReset,
    trend: { value: "-3", direction: "down", helper: "since morning" },
  },
];

export const AGENT_STATS: DashboardStat[] = [
  {
    label: "Quality Score",
    value: "91.2",
    icon: Star,
    trend: { value: "+2.4", direction: "up", helper: "vs last week" },
  },
  {
    label: "Calls Handled",
    value: "47",
    icon: PhoneCall,
    trend: { value: "+6", direction: "up", helper: "today" },
  },
  {
    label: "Audits Passed",
    value: "12 / 14",
    icon: ClipboardCheck,
    trend: { value: "85.7%", direction: "up", helper: "this month" },
  },
  {
    label: "Rank",
    value: "#4",
    icon: Trophy,
    trend: { value: "+2", direction: "up", helper: "team rank" },
  },
];

export interface ActivityRow {
  id: string;
  actor: string;
  action: string;
  target: string;
  status: { label: string; tone: StatusTone };
  timestamp: string;
}

export const RECENT_ACTIVITY: ActivityRow[] = [
  {
    id: "act-1",
    actor: "Priya R.",
    action: "scored",
    target: "Call #89231",
    status: { label: "Passed", tone: "success" },
    timestamp: "2 min ago",
  },
  {
    id: "act-2",
    actor: "Daniel S.",
    action: "flagged",
    target: "Call #89218",
    status: { label: "Needs Review", tone: "warning" },
    timestamp: "11 min ago",
  },
  {
    id: "act-3",
    actor: "QA Bot",
    action: "auto-audited",
    target: "Batch #2104",
    status: { label: "Completed", tone: "info" },
    timestamp: "26 min ago",
  },
  {
    id: "act-4",
    actor: "Mira K.",
    action: "rejected",
    target: "Call #89110",
    status: { label: "Failed", tone: "danger" },
    timestamp: "1 hr ago",
  },
  {
    id: "act-5",
    actor: "Aisha N.",
    action: "submitted",
    target: "Audit Form A1",
    status: { label: "Pending", tone: "neutral" },
    timestamp: "2 hr ago",
  },
];
