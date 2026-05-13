/**
 * Centralized constants for the audit module. Anything that's a "magic"
 * number / string in the service or controller belongs here so it can be
 * tuned in one place.
 */

/** Prefix used for the human-readable `auditCode`. */
export const AUDIT_CODE_PREFIX = "AUD";

/** Length of the random suffix appended to `auditCode`. */
export const AUDIT_CODE_SUFFIX_LENGTH = 4;

/** Allowed `value` strings for YES_NO questions. */
export const YES_NO_VALUES = ["yes", "no", "na"] as const;
export type YesNoValue = (typeof YES_NO_VALUES)[number];

/** Default rating scale for RATING questions. */
export const DEFAULT_RATING_SCALE = 5;

/**
 * Score returned (0..1) for a YES_NO answer.
 *  - "yes" → full credit
 *  - "no"  → no credit
 *  - "na"  → ignored: question is treated as non-scoring for this audit
 */
export const YES_NO_SCORE: Record<YesNoValue, number | null> = {
  yes: 1,
  no: 0,
  na: null,
};

/** Max length we allow for free-text answers. */
export const FREE_TEXT_MAX = 4000;

/** Max length for an `overallComment`. */
export const OVERALL_COMMENT_MAX = 2000;

/** Max length for any `remark`. */
export const REMARK_MAX = 500;

/**
 * Max length for the two audit-level qualitative note fields
 * (`callObservation` and `areaOfImprovement`). Generous so that
 * supervisors are never rejected by the validator mid-sentence, which
 * was the root cause of the autosave 400 loop with the old 500-char
 * section-remark limit.
 */
export const AUDIT_NOTE_MAX = 5000;

/**
 * Valid ACPT category values. ACPT is a qualitative, non-scoring section
 * where the supervisor categorises and describes call observations.
 *
 * Categories are intentionally stored as plain strings so they can be
 * surfaced by the frontend without a DB enum migration.
 */
export const ACPT_CATEGORIES = [
  "Agent",
  "Customer",
  "Process",
  "Technology",
] as const;
export type AcptCategory = (typeof ACPT_CATEGORIES)[number];

/** Max length for an ACPT level-2 or level-3 free-text entry. */
export const ACPT_LEVEL_MAX = 4000;
