import { AuditQuestionType } from "../audits/audit-status.enum";
import { ScorecardStatus } from "./scorecard-status.enum";

/**
 * Public-safe shape returned by the scorecards API. The DB row is mapped
 * onto this so the frontend never depends on Prisma types.
 */
export interface ScorecardListItem {
  id: number;
  name: string;
  description: string | null;
  groupName: string;
  projectId: number | null;
  status: ScorecardStatus;
  /** True for the single global QA template that audits auto-attach. */
  isDefault: boolean;
  version: number;
  /** Flat counts shown in the table without loading the full structure. */
  sectionCount: number;
  questionCount: number;
  createdBy: { id: string; name: string; username: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface ScorecardQuestionResponse {
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
  /** Multiple choice → list of {label,score}. Rating → null (use ratingScale). */
  options: { label: string; score: number }[] | null;
  ratingScale: number | null;
}

export interface ScorecardSectionResponse {
  id: number;
  title: string;
  description: string | null;
  weight: number;
  position: number;
  questions: ScorecardQuestionResponse[];
}

export interface ScorecardDetailResponse extends ScorecardListItem {
  sections: ScorecardSectionResponse[];
}
