import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { ACPT_CATEGORIES, ACPT_LEVEL_MAX, AUDIT_NOTE_MAX, OVERALL_COMMENT_MAX } from "../audit.constants";
import { AnswerInputDto, SectionRemarkInputDto } from "./update-audit.dto";

/**
 * Body for `PATCH /audits/:id/submit`. Optionally accepts the final
 * answer set, comment, and ACPT notes in the same call so the wizard
 * can submit without an extra autosave round-trip.
 */
export class SubmitAuditDto {
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

  /** ACPT category -- one of: Agent | Customer | Process | Technology. */
  @IsOptional()
  @IsString()
  @IsIn([...ACPT_CATEGORIES, null], { message: "Invalid ACPT category" })
  acptCategory?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(ACPT_LEVEL_MAX)
  acptLevel2?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(ACPT_LEVEL_MAX)
  acptLevel3?: string | null;

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

/**
 * Body for `PATCH /audits/:id/reopen`. Lightweight reason field for
 * the audit-history trail.
 */
export class ReopenAuditDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
