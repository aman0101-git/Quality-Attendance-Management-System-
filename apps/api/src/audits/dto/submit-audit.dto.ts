import { Type } from "class-transformer";
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { OVERALL_COMMENT_MAX } from "../audit.constants";
import { AnswerInputDto, SectionRemarkInputDto } from "./update-audit.dto";

/**
 * Body for `PATCH /audits/:id/submit`. Optionally accepts the final
 * answer set & comment in the same call so the wizard can submit
 * without an extra autosave round-trip.
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
