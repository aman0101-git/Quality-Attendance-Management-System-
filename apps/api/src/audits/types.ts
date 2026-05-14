import { AuditQuestionType, AuditStatus } from "./audit-status.enum";

/**
 * Public-safe shape returned by the API. Mirrors the Prisma row but with
 * relations flattened to the minimum needed by the supervisor UI.
 */
export interface AuditListItem {
  id: number;
  auditCode: string;
  status: AuditStatus;
  callReference: string;
  groupNameSnapshot: string;
  projectNameSnapshot: string;
  /**
   * Sum of weights for passing (YES) questions. Use with `applicablePoints`
   * to display "earned / applicable (percentage%)" in the UI.
   */
  totalScore: number | null;
  /**
   * Sum of weights for YES + NO questions (N/A excluded).
   * Null on legacy audits created before this scoring model was introduced.
   */
  applicablePoints: number | null;
  /**
   * Final percentage score: (totalScore / applicablePoints) * 100, forced to
   * 0 if any fatal parameter failed. Null while unanswered.
   */
  finalScore: number | null;
  fatalTriggered: boolean;
  agent: { id: string; name: string; username: string };
  supervisor: { id: string; name: string; username: string };
  project: { id: number; projectName: string; groupName: string };
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  publishedAt: Date | null;
  reviewedAt: Date | null;
  acknowledged: boolean;
  /**
   * Agent's stance on the published audit. Null until the agent
   * acknowledges. "AGREED" | "DISAGREED".
   */
  acknowledgmentMode: string | null;
  /** Optional remark left by the agent (mandatory for DISAGREED). */
  acknowledgmentRemark: string | null;
  /** Legacy column -- null on all newly-created audits. */
  completedAt: Date | null;

  // -----------------------------------------------------------------------
  //  ACPT -- qualitative, non-scoring call notes captured by the supervisor.
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

  // -----------------------------------------------------------------------
  //  Phase 1 — call metadata.  Both are null on legacy audits and on
  //  audits where the supervisor hasn't filled them in.  They never
  //  influence the score; they are informational only.
  // -----------------------------------------------------------------------
  /** Date the audited call took place. Null if not filled. */
  callDate: Date | null;
  /** Duration of the audited call in seconds. Null if not filled. */
  callDuration: number | null;
}

export interface AuditQuestionOption {
  label: string;
  score: number;
}

export interface AuditAnswerResponse {
  id: number;
  questionId: number;
  value: string | null;
  normalizedScore: number | null;
  fatalHit: boolean;
  remark: string | null;
}

export interface AuditQuestionResponse {
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
  /** Pre-loaded answer for resume/review. */
  answer: AuditAnswerResponse | null;
}

export interface AuditSectionResponse {
  id: number;
  title: string;
  weight: number;
  position: number;
  sectionScore: number | null;
  remark: string | null;
  questions: AuditQuestionResponse[];
}

export interface AuditDetailResponse extends AuditListItem {
  overallComment: string | null;
  scorecardTemplateId: number | null;
  sections: AuditSectionResponse[];
  /**
   * Supervisor correction note added after publish. Null while the
   * supervisor hasn't appended one. The note never mutates score or
   * answers -- it's a separate, append-only field surfaced alongside.
   */
  supervisorCorrectionNote: string | null;
  // callObservation and areaOfImprovement are inherited from AuditListItem
  // but explicitly documented here for clarity since the detail response
  // is the primary surface where supervisors read and write them.
}

export interface AuditScoreSummary {
  totalScore: number | null;
  applicablePoints: number | null;
  finalScore: number | null;
  fatalTriggered: boolean;
  sectionScores: { sectionId: number; score: number | null }[];
}
