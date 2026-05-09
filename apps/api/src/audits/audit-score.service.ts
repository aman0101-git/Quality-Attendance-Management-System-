import { Injectable } from "@nestjs/common";
import { AuditQuestionType } from "./audit-status.enum";
import {
  DEFAULT_RATING_SCALE,
  type YesNoValue,
} from "./audit.constants";

/**
 * Inputs to the score engine — kept independent of the Prisma row shape
 * so this stays a pure function and is easy to unit-test.
 */
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
  /**
   * Normalized 0..1 score for storage / analysis.
   *  - 1 → answer is a PASS (contributed `weight` points)
   *  - 0 → answer is a FAIL (or N/A or unanswered)
   *  - null → question was non-scoring (free-text etc.)
   */
  normalizedScore: number | null;
  /** True when this is a fatal question that did not pass. */
  fatalHit: boolean;
  /** Points actually contributed to the call total (0 or `weight`). */
  earnedPoints: number;
}

export interface ScoredSection {
  sectionId: number;
  /**
   * Section completion percentage shown for display only:
   *   `pointsEarned / pointsPossible * 100`
   * Independent of the call's overall total. Null when there are no
   * scoring questions in the section yet.
   */
  score: number | null;
  /** True if any fatal question in this section did not pass. */
  fatalHit: boolean;
  /** Sum of weights for questions that passed. */
  pointsEarned: number;
  /** Sum of weights for all scoring questions in the section. */
  pointsPossible: number;
}

export interface AuditScoreResult {
  /**
   * Raw call score: sum of weights for every passing parameter (0..100).
   * Null while no scoring question has an answer yet.
   */
  totalScore: number | null;
  /**
   * Final call score after applying the fatal rule:
   *   - if any fatal parameter failed → 0
   *   - otherwise == totalScore
   */
  finalScore: number | null;
  fatalTriggered: boolean;
  sections: ScoredSection[];
  answers: ScoredAnswer[];
}

/**
 * Pure scoring engine — implements the binary QA model:
 *
 *   - Each question has a fixed numeric `weight`.
 *   - Each answer is binary: PASS (yes) → earns `weight` points;
 *     FAIL / N/A / unanswered → earns 0.
 *   - The call's `totalScore` is the sum of earned points.
 *     The default QA template's weights sum to 100, so total is in 0..100.
 *   - If ANY fatal parameter fails (or is N/A / unanswered), the
 *     call's `finalScore` is forced to 0, regardless of `totalScore`.
 *   - Section scores are display-only: `earned / possible * 100`.
 *
 * The previous section-weighted normalization model is gone; section
 * weight no longer affects the call total. The schema's `weight` column
 * on sections is preserved (still appears in snapshots) but unused by
 * the math.
 */
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
    let total = 0;
    let scoringQuestionsSeen = 0;
    let answeredScoringQuestions = 0;

    for (const section of sections) {
      let sectionEarned = 0;
      let sectionPossible = 0;
      let sectionFatal = false;

      for (const q of section.questions) {
        const a = answerByQuestion.get(q.id);
        const value = a?.value ?? null;

        // Non-scoring questions (free-text, "for the record" notes) are
        // recorded but never contribute to any score.
        if (!q.scoring) {
          scoredAnswers.push({
            questionId: q.id,
            normalizedScore: null,
            fatalHit: false,
            earnedPoints: 0,
          });
          continue;
        }

        scoringQuestionsSeen += 1;
        if (value !== null && value !== "") answeredScoringQuestions += 1;

        const passed = isQuestionPassed(q, value);
        const earned = passed ? q.weight : 0;

        const isFatalMiss = q.fatal && !passed;
        if (isFatalMiss) {
          fatalTriggered = true;
          sectionFatal = true;
        }

        sectionEarned += earned;
        sectionPossible += q.weight;
        total += earned;

        scoredAnswers.push({
          questionId: q.id,
          normalizedScore: passed ? 1 : 0,
          fatalHit: isFatalMiss,
          earnedPoints: earned,
        });
      }

      scoredSections.push({
        sectionId: section.id,
        score:
          sectionPossible > 0
            ? round((sectionEarned / sectionPossible) * 100, 2)
            : null,
        fatalHit: sectionFatal,
        pointsEarned: sectionEarned,
        pointsPossible: sectionPossible,
      });
    }

    // Until at least one scoring question has been answered, leave the
    // running total as null so the UI can show "—" rather than "0%".
    const totalScore =
      scoringQuestionsSeen === 0 || answeredScoringQuestions === 0
        ? null
        : round(total, 2);

    const finalScore =
      totalScore === null ? null : fatalTriggered ? 0 : totalScore;

    return {
      totalScore,
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

/**
 * Binary PASS / FAIL evaluator for a single question + answer.
 *
 *   - YES_NO          → "yes" only is PASS; "no" / "na" / blank → FAIL
 *   - RATING          → top of the scale only is PASS (anything below
 *                       the max is FAIL — keeps the model strictly binary)
 *   - MULTIPLE_CHOICE → the option whose `score` equals the maximum
 *                       option score is PASS; anything else FAIL
 *   - FREE_TEXT       → never PASS (handled by `scoring=false` upstream)
 *
 * The default QA template only uses YES_NO; the other branches keep the
 * engine usable if an admin later edits the template to mix types.
 */
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
  return optionsJson.flatMap((row) => {
    if (
      row &&
      typeof row === "object" &&
      typeof (row as { label?: unknown }).label === "string" &&
      typeof (row as { score?: unknown }).score === "number"
    ) {
      return [
        {
          label: (row as { label: string }).label,
          score: (row as { score: number }).score,
        },
      ];
    }
    return [];
  });
}
