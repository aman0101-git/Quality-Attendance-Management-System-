import { AuditQuestionType } from "../audits/audit-status.enum";

/**
 * The single global default QA template — exact 20 parameters that the
 * audit wizard auto-attaches to every new audit.
 *
 * Editable: the admin can later add / remove / reorder questions through
 * the existing Scorecards admin UI; this file is just the seed fixture.
 *
 * Scoring rules (see `audit-score.service.ts`):
 *   - PASS  →  question's `weight` points
 *   - FAIL  →  0
 *   - NA / unanswered  →  0
 *   - any FAIL on a `fatal: true` question forces the call's final score to 0
 *
 * Question weights sum to exactly 100 so total/final stays out of 100.
 */

export const DEFAULT_QA_TEMPLATE = {
  name: "Default QA Template",
  description:
    "Global QA scorecard applied to every audit across all groups, customers and projects. Editable by the admin.",
  /**
   * `groupName` is required by the scorecard schema. Using a sentinel
   * value keeps the template separable from per-group scorecards in
   * future extensions; the audit wizard ignores group binding for the
   * default template anyway.
   */
  groupName: "GLOBAL",
  isActive: true,
  isDefault: true,
  sections: [
    {
      title: "Opening & Communication",
      description:
        "Connection quality, confidence, and the rapport built in the first minute of the call.",
      weight: 1,
      questions: [
        {
          prompt:
            "Call opening / Energetic / Confidence / Opening within 5 seconds / Greetings",
          weight: 4,
          fatal: false,
        },
        { prompt: "RPC confirmation", weight: 3, fatal: false },
        { prompt: "Purpose of call", weight: 2, fatal: false },
        {
          prompt: "Active listening / Interruption / 2-way communication",
          weight: 7,
          fatal: false,
        },
        {
          prompt: "Tone / Energy / ROS / Voice modulation / MTI issue",
          weight: 5,
          fatal: false,
        },
        { prompt: "Self introduction", weight: 2, fatal: false },
        { prompt: "Sympathy / Empathy", weight: 4, fatal: false },
        {
          prompt: "Rapport building and personalization",
          weight: 8,
          fatal: false,
        },
      ],
    },
    {
      title: "Call Control & Follow-up",
      description: "Operational handling: holds, follow-ups and product depth.",
      weight: 1,
      questions: [
        { prompt: "Mute / Hold / Call transfer", weight: 3, fatal: false },
        { prompt: "Follow up", weight: 3, fatal: false },
        { prompt: "Probing and questioning", weight: 6, fatal: false },
        {
          prompt: "Product knowledge and USP and benefits",
          weight: 7,
          fatal: false,
        },
        { prompt: "Customer query / Service", weight: 4, fatal: false },
      ],
    },
    {
      title: "Conversion & Compliance",
      description:
        "Closing behaviour and compliance — fatal flags live here. Any fatal failure zeros the call.",
      weight: 1,
      questions: [
        {
          prompt: "Objection Handling and Urgency creation",
          weight: 6,
          fatal: true,
        },
        { prompt: "Rebuttals and Need creation", weight: 7, fatal: true },
        {
          prompt: "Rude behaviour / abusive language / high tone",
          weight: 6,
          fatal: true,
        },
        {
          prompt: "Mis-selling / Wrong information / Misguide",
          weight: 8,
          fatal: true,
        },
        { prompt: "Call Disposition", weight: 6, fatal: true },
        {
          prompt: "Mandate checklist / confirm all the lead details",
          weight: 6,
          fatal: true,
        },
        {
          prompt: "Call closing with company full name",
          weight: 3,
          fatal: false,
        },
      ],
    },
  ],
} as const;

export type DefaultQuestionFixture = {
  prompt: string;
  weight: number;
  fatal: boolean;
};

/**
 * Internal helper: convert a fixture question into the shape Prisma's
 * `scorecardQuestion.create` data accepts. Every parameter is a binary
 * Pass/Fail/NA evaluation — modelled as a YES_NO question type.
 */
export function questionFixtureToCreate(
  q: DefaultQuestionFixture,
  position: number,
) {
  return {
    prompt: q.prompt,
    helpText: null as string | null,
    type: AuditQuestionType.YES_NO,
    weight: q.weight,
    scoring: true,
    fatal: q.fatal,
    compliance: q.fatal,
    required: true,
    position,
  };
}

/**
 * Sanity check: weights must sum to 100. Catches typos at startup.
 */
export function assertWeightsSumTo100(): void {
  let sum = 0;
  for (const section of DEFAULT_QA_TEMPLATE.sections) {
    for (const q of section.questions) sum += q.weight;
  }
  if (sum !== 100) {
    throw new Error(
      `Default QA template weights must sum to 100 — got ${sum}. Fix DEFAULT_QA_TEMPLATE.`,
    );
  }
}
