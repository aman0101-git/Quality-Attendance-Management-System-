import { Injectable } from "@nestjs/common";
import { AuditQuestionType } from "./audit-status.enum";
import {
  DEFAULT_RATING_SCALE,
  type YesNoValue,
} from "./audit.constants";

export interface ScoreEngineQuestion {
  id: number;
  type: AuditQuestionType;
  weight: number;
  scoring: boolean;
  fatal: boolean;
  optionsJson: unknown;
}

export interface ScoreEngineSection {
  id: number;
  weight: number;
  questions: ScoreEngineQuestion[];
}

export interface ScoreEngineAnswer {
  questionId: number;
  value: string | null;
}

export interface ScoredAnswer {
  questionId: number;
  normalizedScore: number | null;
  fatalHit: boolean;
  earnedPoints: number;
  isNA: boolean;
}

export interface ScoredSection {
  sectionId: number;
  score: number | null;
  fatalHit: boolean;
  pointsEarned: number;
  pointsPossible: number;
  excludedPoints: number;
}

export interface AuditScoreResult {
  totalScore: number | null;
  applicablePoints: number | null;
  excludedPoints: number;
  finalScore: number | null;
  fatalTriggered: boolean;
  sections: ScoredSection[];
  answers: ScoredAnswer[];
}

@Injectable()
export class AuditScoreService {
  computeAudit(
    sections: ScoreEngineSection[],
    answers: ScoreEngineAnswer[],
  ): AuditScoreResult {
    const answerByQuestion = new Map<number, ScoreEngineAnswer>();
    for (const a of answers) answerByQuestion.set(a.questionId, a);

    const scoredAnswers: ScoredAnswer[] = [];
    const scoredSections: ScoredSection[] = [];

    let fatalTriggered = false;
    let totalEarned = 0;
    let totalApplicable = 0;
    let totalExcluded = 0;
    let applicableAnsweredCount = 0;

    for (const section of sections) {
      let sectionEarned = 0;
      let sectionApplicable = 0;
      let sectionExcluded = 0;
      let sectionFatal = false;

      for (const q of section.questions) {
        const a = answerByQuestion.get(q.id);
        const value = a?.value ?? null;

        if (!q.scoring) {
          scoredAnswers.push({
            questionId: q.id,
            normalizedScore: null,
            fatalHit: false,
            earnedPoints: 0,
            isNA: false,
          });
          continue;
        }

        const isAnswered = value !== null && value !== "";
        const isNA = isAnswered && isQuestionNA(q, value);

        if (isNA) {
          sectionExcluded += q.weight;
          totalExcluded += q.weight;
          scoredAnswers.push({
            questionId: q.id,
            normalizedScore: null,
            fatalHit: false,
            earnedPoints: 0,
            isNA: true,
          });
          continue;
        }

        if (isAnswered) {
          applicableAnsweredCount += 1;
          sectionApplicable += q.weight;
          totalApplicable += q.weight;
        }

        const passed = isAnswered && isQuestionPassed(q, value);
        const earned = passed ? q.weight : 0;

        // Phase 2: fatal is now ANSWER-DRIVEN.
        //
        // A question triggers a fatal miss ONLY when the supervisor
        // explicitly picked the FATAL chip. A plain NO is just a zero
        // — it no longer flips the audit-wide override. The legacy
        // `question.fatal` template flag still controls which
        // questions are tagged as "fatal-capable" in the UI (a `Fatal`
        // pill on the question row, distinct chip ordering, etc.) but
        // it is no longer consulted here; the verdict is purely a
        // function of the answer string.
        const isFatalAnswer = isAnswered && isFatalValue(q, value);

        if (isFatalAnswer) {
          fatalTriggered = true;
          sectionFatal = true;
        }

        sectionEarned += earned;
        totalEarned += earned;

        scoredAnswers.push({
          questionId: q.id,
          normalizedScore: isAnswered ? (passed ? 1 : 0) : null,
          fatalHit: isFatalAnswer,
          earnedPoints: earned,
          isNA: false,
        });
      }

      scoredSections.push({
        sectionId: section.id,
        score:
          sectionApplicable > 0
            ? round((sectionEarned / sectionApplicable) * 100, 2)
            : null,
        fatalHit: sectionFatal,
        pointsEarned: sectionEarned,
        pointsPossible: sectionApplicable,
        excludedPoints: sectionExcluded,
      });
    }

    if (applicableAnsweredCount === 0) {
      return {
        totalScore: null,
        applicablePoints: null,
        excludedPoints: totalExcluded,
        finalScore: null,
        fatalTriggered,
        sections: scoredSections,
        answers: scoredAnswers,
      };
    }

    const totalScore = round(totalEarned, 2);
    const applicablePoints = round(totalApplicable, 2);
    const rawPct = round((totalEarned / totalApplicable) * 100, 2);
    const finalScore = fatalTriggered ? 0 : rawPct;

    return {
      totalScore,
      applicablePoints,
      excludedPoints: totalExcluded,
      finalScore,
      fatalTriggered,
      sections: scoredSections,
      answers: scoredAnswers,
    };
  }
}

// =====================================================================
//  Helpers
// =====================================================================

function round(num: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(num * f) / f;
}

function isQuestionNA(
  question: ScoreEngineQuestion,
  rawValue: string | null,
): boolean {
  if (!rawValue) return false;
  if (question.type === AuditQuestionType.YES_NO) {
    return rawValue.toLowerCase() === "na";
  }
  return false;
}

/**
 * Phase 2 helper. The fatal verdict is now driven by an explicit
 * `fatal` answer on a YES_NO question. Returns false for any other
 * question type — fatal is not a meaningful answer for ratings or
 * multiple-choice values, only for the YES/NO/N/A/FATAL chip group.
 */
function isFatalValue(
  question: ScoreEngineQuestion,
  rawValue: string | null,
): boolean {
  if (!rawValue) return false;
  if (question.type !== AuditQuestionType.YES_NO) return false;
  return rawValue.toLowerCase() === "fatal";
}

function isQuestionPassed(
  question: ScoreEngineQuestion,
  rawValue: string | null,
): boolean {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return false;
  }

  switch (question.type) {
    case AuditQuestionType.YES_NO: {
      const v = rawValue.toLowerCase() as YesNoValue | string;
      // Only YES is a pass. NO / N/A / FATAL never earn credit.
      return v === "yes";
    }

    case AuditQuestionType.RATING: {
      const scale = readRatingScale(question.optionsJson);
      const n = Number(rawValue);
      if (!Number.isFinite(n)) return false;
      return n >= scale;
    }

    case AuditQuestionType.MULTIPLE_CHOICE: {
      const options = readOptions(question.optionsJson);
      if (!options.length) return false;
      const match = options.find(
        (o) =>
          o.label.trim().toLowerCase() === rawValue.trim().toLowerCase(),
      );
      if (!match) return false;
      const max = Math.max(...options.map((o) => o.score));
      if (max <= 0) return false;
      return match.score >= max;
    }

    case AuditQuestionType.FREE_TEXT:
    default:
      return false;
  }
}

function readRatingScale(optionsJson: unknown): number {
  if (
    optionsJson &&
    typeof optionsJson === "object" &&
    "scale" in optionsJson &&
    typeof (optionsJson as { scale: unknown }).scale === "number"
  ) {
    const n = (optionsJson as { scale: number }).scale;
    return Number.isFinite(n) && n >= 2 ? n : DEFAULT_RATING_SCALE;
  }
  return DEFAULT_RATING_SCALE;
}

function readOptions(
  optionsJson: unknown,
): { label: string; score: number }[] {
  if (!Array.isArray(optionsJson)) return [];
  return optionsJson.flatMap((item) => {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { label?: unknown }).label === "string" &&
      typeof (item as { score?: unknown }).score === "number"
    ) {
      return [
        {
          label: (item as { label: string; score: number }).label,
          score: (item as { label: string; score: number }).score,
        },
      ];
    }
    return [];
  });
}
