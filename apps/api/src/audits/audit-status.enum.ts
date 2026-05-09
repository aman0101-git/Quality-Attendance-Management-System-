/**
 * App-side mirror of the Prisma `AuditStatus` enum so the rest of the
 * codebase (DTOs, services, types, frontend types) can stay decoupled
 * from `@prisma/client`.
 */
export const AuditStatus = {
  DRAFT: "DRAFT",
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  COMPLETED: "COMPLETED",
} as const;

export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];

/**
 * Allowed transitions, enforced by the service layer. Anything not in
 * this map is rejected with a 400.
 */
export const AUDIT_STATUS_TRANSITIONS: Record<AuditStatus, AuditStatus[]> = {
  [AuditStatus.DRAFT]: [AuditStatus.IN_PROGRESS, AuditStatus.SUBMITTED],
  [AuditStatus.IN_PROGRESS]: [AuditStatus.SUBMITTED, AuditStatus.DRAFT],
  [AuditStatus.SUBMITTED]: [AuditStatus.COMPLETED, AuditStatus.IN_PROGRESS],
  [AuditStatus.COMPLETED]: [],
};

/**
 * App-side mirror of `AuditQuestionType`.
 */
export const AuditQuestionType = {
  YES_NO: "YES_NO",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  RATING: "RATING",
  FREE_TEXT: "FREE_TEXT",
} as const;

export type AuditQuestionType =
  (typeof AuditQuestionType)[keyof typeof AuditQuestionType];
