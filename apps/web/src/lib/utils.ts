import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditionally join Tailwind classes and merge conflicting utilities.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Shared date-time formatter used across audit list rows, audit detail
 * headers, and history views.
 *
 * Renders an enterprise-friendly clean format like "09 May 2026, 12:07 PM".
 * Always returns "—" for null/empty inputs so callers don't have to guard.
 */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return "—";
    const datePart = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart}, ${timePart}`;
  } catch {
    return typeof iso === "string" ? iso : "—";
  }
}

/**
 * Date-only formatter — kept for cases where time isn't meaningful.
 */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return typeof iso === "string" ? iso : "—";
  }
}

// =====================================================================
//  Date range helpers — used by dashboard KPI time filters
// =====================================================================

/**
 * Preset windows recognised by the dashboard filter chips.
 *  - `all`      → no filter (everything)
 *  - `today`   → from start-of-today to start-of-tomorrow
 *  - `week`    → last 7 days inclusive
 *  - `month`   → last 30 days inclusive
 *  - `custom`  → caller supplies `from`/`to`
 */
export type DateRangePreset = "all" | "today" | "week" | "month" | "custom";

export interface DateRange {
  /** Inclusive lower bound. Null means "no lower bound". */
  from: Date | null;
  /** Exclusive upper bound. Null means "no upper bound". */
  to: Date | null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Resolve a preset to a concrete `[from, to)` window.
 *
 * The window uses local-time day boundaries — the dashboard runs in the
 * supervisor's browser, so "today" means today *for them*.
 */
export function dateRangeFor(
  preset: DateRangePreset,
  custom?: { from?: Date | null; to?: Date | null },
): DateRange {
  const now = new Date();
  const todayStart = startOfDay(now);

  switch (preset) {
    case "all":
      return { from: null, to: null };
    case "today":
      return { from: todayStart, to: addDays(todayStart, 1) };
    case "week":
      return { from: addDays(todayStart, -6), to: addDays(todayStart, 1) };
    case "month":
      return { from: addDays(todayStart, -29), to: addDays(todayStart, 1) };
    case "custom":
      return {
        from: custom?.from ? startOfDay(custom.from) : null,
        to: custom?.to ? addDays(startOfDay(custom.to), 1) : null,
      };
  }
}

/**
 * Test whether an ISO/date value falls inside a date range. Items with no
 * timestamp are excluded from any non-"all" range.
 */
export function isWithinRange(
  iso: string | Date | null | undefined,
  range: DateRange,
): boolean {
  if (range.from === null && range.to === null) return true;
  if (!iso) return false;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return false;
  if (range.from && d < range.from) return false;
  if (range.to && d >= range.to) return false;
  return true;
}

// =====================================================================
//  Quality label — operational categorization derived from final score
// =====================================================================

export type QualityLabel = "GOOD" | "AVERAGE" | "BAD" | null;

/**
 * Map a final score to a coarse operational label. This is purely a
 * presentation hint — the score engine and lifecycle ignore it.
 *
 *  - finalScore null            → null   (no answers yet)
 *  - fatalTriggered = true      → "BAD"  (final is forced to 0 anyway)
 *  - finalScore >= 80           → "GOOD"
 *  - finalScore >= 50           → "AVERAGE"
 *  - finalScore <  50           → "BAD"
 */
export function qualityLabel(
  finalScore: number | null | undefined,
  fatalTriggered = false,
): QualityLabel {
  if (finalScore === null || finalScore === undefined) return null;
  if (fatalTriggered) return "BAD";
  if (finalScore >= 80) return "GOOD";
  if (finalScore >= 50) return "AVERAGE";
  return "BAD";
}

/**
 * Format an audit score for display.
 *
 * New audits (applicablePoints is set):
 *   → "50 / 75 (66.7%)"   — earned / applicable (percentage)
 *
 * Legacy audits (applicablePoints is null) or when only the percentage
 * is available:
 *   → "50.0%"
 *
 * No answers yet (finalScore is null):
 *   → "—"
 */
export function formatAuditScore(
  finalScore: number | null | undefined,
  totalScore?: number | null,
  applicablePoints?: number | null,
): string {
  if (finalScore === null || finalScore === undefined) return "—";
  if (
    totalScore !== null &&
    totalScore !== undefined &&
    applicablePoints !== null &&
    applicablePoints !== undefined
  ) {
    return `${totalScore} / ${applicablePoints} (${finalScore.toFixed(1)}%)`;
  }
  return `${finalScore.toFixed(1)}%`;
}

/**
 * Render an integer second count as a compact HH:MM:SS / MM:SS string.
 * Used everywhere the Phase 1 `callDuration` field is displayed —
 * supervisor list, agent list, agent detail, wizard review — so the
 * format stays consistent across the app. Returns the empty string for
 * null / negative / non-finite inputs so callers can do `|| "—"`.
 */
export function formatDurationSeconds(
  seconds: number | null | undefined,
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "";
  }
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hh > 0) return `${hh}:${pad(mm)}:${pad(ss)}`;
  return `${mm}:${pad(ss)}`;
}
