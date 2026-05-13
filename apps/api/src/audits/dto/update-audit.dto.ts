import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  ACPT_CATEGORIES,
  ACPT_LEVEL_MAX,
  AUDIT_NOTE_MAX,
  OVERALL_COMMENT_MAX,
  REMARK_MAX,
} from "../audit.constants";
import {
  CALL_REFERENCE_ERROR,
  CALL_REFERENCE_REGEX,
} from "./create-audit.dto";

/**
 * One answer being saved by the supervisor while filling the audit.
 * The score engine on the server will recompute everything -- clients
 * never set `normalizedScore` directly.
 */
export class AnswerInputDto {
  @IsInt()
  @Min(1)
  questionId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  value?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(REMARK_MAX)
  remark?: string | null;
}

/**
 * Optional per-section remark, saved alongside the answers.
 */
export class SectionRemarkInputDto {
  @IsInt()
  @Min(1)
  sectionId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(REMARK_MAX)
  remark?: string | null;
}

/**
 * Body for `PATCH /audits/:id`. Used for autosave and final review edits.
 *
 * Anything omitted is left untouched; the autosave can therefore send
 * just the answer that was edited.
 */
export class UpdateAuditDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Matches(CALL_REFERENCE_REGEX, { message: CALL_REFERENCE_ERROR })
  callReference?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  scorecardTemplateId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(OVERALL_COMMENT_MAX)
  overallComment?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  answers?: AnswerInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionRemarkInputDto)
  sectionRemarks?: SectionRemarkInputDto[];

  /**
   * Marks the audit as "started" -- moves status from DRAFT to IN_PROGRESS.
   * The wizard sends this as soon as the user reaches the scorecard step.
   */
  @IsOptional()
  @IsBoolean()
  start?: boolean;

  // -----------------------------------------------------------------------
  //  ACPT -- qualitative, non-scoring call notes
  //  All three fields are optional and independent; the frontend may send
  //  any combination. ACPT fields never feed into the scoring engine.
  // -----------------------------------------------------------------------

  /** One of: Agent | Customer | Process | Technology. Null to clear. */
  @IsOptional()
  @IsString()
  @IsIn([...ACPT_CATEGORIES, null], { message: "Invalid ACPT category" })
  acptCategory?: string | null;

  /** Free-text Level 2 observations. Null to clear. */
  @IsOptional()
  @IsString()
  @MaxLength(ACPT_LEVEL_MAX)
  acptLevel2?: string | null;

  /** Free-text Level 3 observations. Null to clear. */
  @IsOptional()
  @IsString()
  @MaxLength(ACPT_LEVEL_MAX)
  acptLevel3?: string | null;

  // -----------------------------------------------------------------------
  //  Audit-level qualitative notes (replaces per-section remarks).
  //  Using a generous max-length so autosave never rejects a long note
  //  mid-typing -- the old 500-char section remark caused a 400 loop.
  // -----------------------------------------------------------------------

  /** Supervisor's observation about the call. Null to clear. */
  @IsOptional()
  @IsString()
  @MaxLength(AUDIT_NOTE_MAX)
  callObservation?: string | null;

  /** Supervisor's improvement notes. Null to clear. */
  @IsOptional()
  @IsString()
  @MaxLength(AUDIT_NOTE_MAX)
  areaOfImprovement?: string | null;
}
