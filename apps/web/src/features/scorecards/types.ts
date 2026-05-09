/**
 * Frontend mirror of the API scorecard types.
 *
 * Kept in lockstep with `apps/api/src/scorecards/types.ts` so the admin UI
 * stays decoupled from any Prisma client.
 */

import { AuditQuestionType } from "@/features/audits/types";

export const ScorecardStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type ScorecardStatus =
  (typeof ScorecardStatus)[keyof typeof ScorecardStatus];

export interface ScorecardCreator {
  id: string;
  name: string;
  username: string;
}

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
  sectionCount: number;
  questionCount: number;
  createdBy: ScorecardCreator;
  createdAt: string;
  updatedAt: string;
}

export interface ScorecardOption {
  label: string;
  score: number;
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
  options: ScorecardOption[] | null;
  ratingScale: number | null;
}

export interface ScorecardSection {
  id: number;
  title: string;
  description: string | null;
  weight: number;
  position: number;
  questions: ScorecardQuestion[];
}

export interface ScorecardDetail extends ScorecardListItem {
  sections: ScorecardSection[];
}

// =====================================================================
//  Input shapes used by the editor
// =====================================================================

export interface QuestionInput {
  prompt: string;
  helpText?: string;
  type: AuditQuestionType;
  weight?: number;
  scoring?: boolean;
  fatal?: boolean;
  compliance?: boolean;
  required?: boolean;
  options?: ScorecardOption[];
  ratingScale?: number;
}

export interface SectionInput {
  title: string;
  description?: string;
  weight?: number;
  questions: QuestionInput[];
}
