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
  totalScore: number | null;
  finalScore: number | null;
  fatalTriggered: boolean;
  agent: { id: string; name: string; username: string };
  supervisor: { id: string; name: string; username: string };
  project: { id: number; projectName: string; groupName: string };
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
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
}

export interface AuditScoreSummary {
  totalScore: number | null;
  finalScore: number | null;
  fatalTriggered: boolean;
  sectionScores: { sectionId: number; score: number | null }[];
}
