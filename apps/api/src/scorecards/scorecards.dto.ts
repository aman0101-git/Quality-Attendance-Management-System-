import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { AuditQuestionType } from "../audits/audit-status.enum";
import { ScorecardStatus } from "./scorecard-status.enum";
import {
  MAX_RATING_SCALE,
  MIN_RATING_SCALE,
  QUESTION_HELP_MAX,
  QUESTION_PROMPT_MAX,
  SCORECARD_DESCRIPTION_MAX,
  SCORECARD_NAME_MAX,
  SCORECARD_NAME_MIN,
  SECTION_TITLE_MAX,
} from "./scorecard.constants";

const QUESTION_TYPES = [
  AuditQuestionType.YES_NO,
  AuditQuestionType.MULTIPLE_CHOICE,
  AuditQuestionType.RATING,
  AuditQuestionType.FREE_TEXT,
] as const;

// =====================================================================
//  Shared structure DTOs (used by create + structure update)
// =====================================================================

export class ScorecardOptionInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  score!: number;
}

export class ScorecardQuestionInputDto {
  @IsString()
  @IsNotEmpty({ message: "Question prompt is required" })
  @MaxLength(QUESTION_PROMPT_MAX)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(QUESTION_HELP_MAX)
  helpText?: string;

  @IsIn(QUESTION_TYPES as unknown as string[], {
    message: "Invalid question type",
  })
  type!: AuditQuestionType;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  weight?: number;

  @IsOptional() @IsBoolean() scoring?: boolean;
  @IsOptional() @IsBoolean() fatal?: boolean;
  @IsOptional() @IsBoolean() compliance?: boolean;
  @IsOptional() @IsBoolean() required?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScorecardOptionInputDto)
  options?: ScorecardOptionInputDto[];

  /** Used only for RATING questions. */
  @IsOptional()
  @IsInt()
  @Min(MIN_RATING_SCALE)
  @Max(MAX_RATING_SCALE)
  ratingScale?: number;
}

export class ScorecardSectionInputDto {
  @IsString()
  @IsNotEmpty({ message: "Section title is required" })
  @MaxLength(SECTION_TITLE_MAX)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(SCORECARD_DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  weight?: number;

  @IsArray()
  @ArrayMinSize(1, { message: "Each section needs at least one question" })
  @ValidateNested({ each: true })
  @Type(() => ScorecardQuestionInputDto)
  questions!: ScorecardQuestionInputDto[];
}

// =====================================================================
//  Endpoint-specific DTOs
// =====================================================================

/**
 * Body for `POST /scorecards`. Creates a new template plus its initial
 * structure in one shot.
 */
export class CreateScorecardDto {
  @IsString()
  @IsNotEmpty({ message: "Name is required" })
  @MinLength(SCORECARD_NAME_MIN, {
    message: `Name must be at least ${SCORECARD_NAME_MIN} characters`,
  })
  @MaxLength(SCORECARD_NAME_MAX, {
    message: `Name is too long (max ${SCORECARD_NAME_MAX})`,
  })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(SCORECARD_DESCRIPTION_MAX)
  description?: string;

  @IsString()
  @IsNotEmpty({ message: "Group is required" })
  @MaxLength(100)
  groupName!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  projectId?: number;

  /**
   * Optional — admins can create the bare template first and add sections
   * via `PATCH /scorecards/:id/structure` later.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScorecardSectionInputDto)
  sections?: ScorecardSectionInputDto[];
}

/**
 * Body for `PATCH /scorecards/:id` — header-only edits.
 * Structure changes go through the dedicated structure endpoint so we
 * can track the version bump separately.
 */
export class UpdateScorecardHeaderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(SCORECARD_NAME_MIN)
  @MaxLength(SCORECARD_NAME_MAX)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SCORECARD_DESCRIPTION_MAX)
  description?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  groupName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  projectId?: number | null;
}

/**
 * Body for `PATCH /scorecards/:id/structure`. Replaces sections + questions
 * wholesale and bumps `version`. Old audit snapshots remain untouched.
 */
export class UpdateScorecardStructureDto {
  @IsArray()
  @ArrayMinSize(1, { message: "A scorecard needs at least one section" })
  @ValidateNested({ each: true })
  @Type(() => ScorecardSectionInputDto)
  sections!: ScorecardSectionInputDto[];
}

/**
 * Body for `PATCH /scorecards/:id/status`.
 */
export class UpdateScorecardStatusDto {
  @IsIn([ScorecardStatus.ACTIVE, ScorecardStatus.INACTIVE], {
    message: "Status must be ACTIVE or INACTIVE",
  })
  status!: ScorecardStatus;
}
