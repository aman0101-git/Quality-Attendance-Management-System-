/**
 * Frontend mirror of the API audit types. Keeping them in lockstep with
 * `apps/api/src/audits/types.ts` so the supervisor UI stays decoupled
 * from any Prisma client.
 */

export const AuditStatus = {
  DRAFT: "DRAFT",
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  /** Visible to the agent and immutable for everyone. */
  PUBLISHED: "PUBLISHED",
  /** Agent has acknowledged the audit. Terminal. */
  REVIEWED: "REVIEWED",
  /** Legacy — never assigned by new code, but old rows may still carry it. */
  COMPLETED: "COMPLETED",
} as const;
export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];

/** Statuses the agent is allowed to see. */
export const AGENT_VISIBLE_STATUSES: AuditStatus[] = [
  AuditStatus.PUBLISHED,
  AuditStatus.REVIEWED,
];

/** Statuses in which the audit is locked / read-only for everyone. */
export const AUDIT_IMMUTABLE_STATUSES: AuditStatus[] = [
  AuditStatus.PUBLISHED,
  AuditStatus.REVIEWED,
  AuditStatus.COMPLETED,
];

export const AuditQuestionType = {
  YES_NO: "YES_NO",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  RATING: "RATING",
  FREE_TEXT: "FREE_TEXT",
} as const;
export type AuditQuestionType =
  (typeof AuditQuestionType)[keyof typeof AuditQuestionType];

export interface AuditUserRef {
  id: string;
  name: string;
  username: string;
}

export interface AuditProjectRef {
  id: number;
  projectName: string;
  groupName: string;
}

export interface AuditListItem {
  id: number;
  auditCode: string;
  status: AuditStatus;
  callReference: string;
  groupNameSnapshot: string;
  projectNameSnapshot: string;
  /**
   * Sum of weights for passing (YES) questions. Combine with
   * `applicablePoints` to show "earned / applicable (pct%)" in the UI.
   */
  totalScore: number | null;
  /**
   * Sum of weights for YES + NO questions (N/A excluded from denominator).
   * Null on legacy audits — fall back to displaying finalScore as a plain %.
   */
  applicablePoints: number | null;
  /**
   * Final percentage: (totalScore / applicablePoints) * 100, or 0 if fatal.
   * For legacy rows (applicablePoints = null) this is the old 0-100 value.
   */
  finalScore: number | null;
  fatalTriggered: boolean;
  acknowledged: boolean;
  /** "AGREED" | "DISAGREED" | null — null until agent acknowledges. */
  acknowledgmentMode: string | null;
  acknowledgmentRemark: string | null;
  agent: AuditUserRef;
  supervisor: AuditUserRef;
  project: AuditProjectRef;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
  reviewedAt: string | null;
  /** Legacy — null on all newly-created audits. */
  completedAt: string | null;

  // -----------------------------------------------------------------------
  //  ACPT — qualitative, non-scoring call notes.
  //  All three are null on legacy audits (pre-ACPT migration).
  // -----------------------------------------------------------------------
  /** One of: "Agent" | "Customer" | "Process" | "Technology". Null if not filled. */
  acptCategory: string | null;
  /** Free-text Level 2 observations. Null if not filled. */
  acptLevel2: string | null;
  /** Free-text Level 3 observations. Null if not filled. */
  acptLevel3: string | null;

  // -----------------------------------------------------------------------
  //  Audit-level qualitative notes (replaces old per-section remarks).
  //  Both are null on legacy audits (pre-notes migration).
  // -----------------------------------------------------------------------
  /** Supervisor's observation notes about the call. Null if not filled. */
  callObservation: string | null;
  /** Supervisor's improvement notes for the agent. Null if not filled. */
  areaOfImprovement: string | null;
}

export interface AuditQuestionOption {
  label: string;
  score: number;
}

export interface AuditAnswer {
  id: number;
  questionId: number;
  value: string | null;
  normalizedScore: number | null;
  fatalHit: boolean;
  remark: string | null;
}

export interface AuditQuestion {
  id: number;
  prompt: string;
  helpText: string | null;
  type: AuditQuestionType;
  weight: number;
  scoring: boolean;
  fatal: boolean;
  compliance: boolean;
  required: boolean;
  position: number;
  options: AuditQuestionOption[] | null;
  answer: AuditAnswer | null;
}

export interface AuditSection {
  id: number;
  title: string;
  weight: number;
  position: number;
  sectionScore: number | null;
  remark: string | null;
  questions: AuditQuestion[];
}

export interface AuditDetail extends AuditListItem {
  overallComment: string | null;
  scorecardTemplateId: number | null;
  sections: AuditSection[];
  /** Supervisor correction note added after publish. Append-only. */
  supervisorCorrectionNote: string | null;
}

export interface ScorecardSection {
  id: number;
  title: string;
  description: string | null;
  weight: number;
  position: number;
  questions: ScorecardQuestion[];
}

export interface ScorecardQuestion {
  id: number;
  prompt: string;
  helpText: string | null;
  type: AuditQuestionType;
  weight: number;
  scoring: boolean;
  fatal: boolean;
  compliance: boolean;
  required: boolean;
  position: number;
  optionsJson: unknown;
}

/**
 * Slim scorecard shape returned by `GET /audits/scorecards` for the
 * supervisor wizard. The full structure (sections + questions) is
 * materialized server-side onto the audit when the supervisor binds the
 * scorecard, so the wizard only needs identifying / display fields here.
 *
 * The full editor shape lives in `@/features/scorecards/types`.
 */
export interface ScorecardTemplate {
  id: number;
  name: string;
  description: string | null;
  groupName: string;
  projectId: number | null;
  /** ACTIVE / INACTIVE — supervisor list always returns ACTIVE only. */
  status: "ACTIVE" | "INACTIVE";
  version: number;
  sectionCount: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}
