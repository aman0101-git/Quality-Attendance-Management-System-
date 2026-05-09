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
