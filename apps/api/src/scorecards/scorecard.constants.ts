/**
 * Centralized constants for the scorecards module.
 */

/** Min/max characters for the template name. */
export const SCORECARD_NAME_MIN = 2;
export const SCORECARD_NAME_MAX = 120;

/** Cap on description / help-text fields. */
export const SCORECARD_DESCRIPTION_MAX = 255;

/** Cap on a question prompt / help text. */
export const QUESTION_PROMPT_MAX = 500;
export const QUESTION_HELP_MAX = 500;

/** Cap on a section title. */
export const SECTION_TITLE_MAX = 160;

/** Cap on the number of sections allowed in a single scorecard. */
export const MAX_SECTIONS = 30;

/** Cap on the number of questions allowed in a single section. */
export const MAX_QUESTIONS_PER_SECTION = 50;

/** Default rating scale used when no scale is provided. */
export const DEFAULT_RATING_SCALE = 5;

/** Smallest allowed rating scale. */
export const MIN_RATING_SCALE = 2;
export const MAX_RATING_SCALE = 10;
