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
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { AuditQuestionType } from "../audit-status.enum";

const QUESTION_TYPES = [
  AuditQuestionType.YES_NO,
  AuditQuestionType.MULTIPLE_CHOICE,
  AuditQuestionType.RATING,
  AuditQuestionType.FREE_TEXT,
] as const;

export class ScorecardOptionInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsNumber()
  score!: number;
}

export class ScorecardQuestionInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  helpText?: string;

  @IsIn(QUESTION_TYPES as unknown as string[])
  type!: AuditQuestionType;

  @IsOptional()
  @IsNumber()
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

  /** Used only for RATING questions — defaults to 5. */
  @IsOptional()
  @IsInt()
  @Min(2)
  ratingScale?: number;
}

export class ScorecardSectionInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScorecardQuestionInputDto)
  questions!: ScorecardQuestionInputDto[];
}

/**
 * Body for `POST /audits/scorecards`. Lets a supervisor create a new
 * group-aware scorecard template. Project-level binding (`projectId`)
 * is optional and reserved for future per-project overrides.
 */
export class CreateScorecardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  groupName!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  projectId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScorecardSectionInputDto)
  sections!: ScorecardSectionInputDto[];
}
