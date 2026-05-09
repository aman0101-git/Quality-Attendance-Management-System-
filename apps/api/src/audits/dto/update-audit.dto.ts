import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { OVERALL_COMMENT_MAX, REMARK_MAX } from "../audit.constants";

/**
 * One answer being saved by the supervisor while filling the audit.
 * The score engine on the server will recompute everything — clients
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
  @IsString()
  @MaxLength(120)
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
   * Marks the audit as "started" — moves status from DRAFT to IN_PROGRESS.
   * The wizard sends this as soon as the user reaches the scorecard step.
   */
  @IsOptional()
  @IsBoolean()
  start?: boolean;
}
