import { Transform } from "class-transformer";
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";

/** Exactly 10 numeric digits, nothing else. */
export const CALL_REFERENCE_REGEX = /^\d{10}$/;
export const CALL_REFERENCE_ERROR =
  "Call reference must be exactly 10 digits (numeric only).";

/**
 * Body for `POST /audits`.
 *
 * Creates a draft audit bound to a single agent + call reference.
 * The audit is automatically attached to the global default QA template
 * — supervisors do NOT pick a scorecard per audit. Any
 * `scorecardTemplateId` previously sent by older clients is rejected by
 * the strict ValidationPipe (`forbidNonWhitelisted`) so we surface the
 * change rather than ignoring it silently.
 */
export class CreateAuditDto {
  @IsString()
  @IsNotEmpty({ message: "Agent is required" })
  agentId!: string;

  @IsInt({ message: "Project must be a valid ID" })
  @Min(1)
  projectId!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: "Call reference is required" })
  @Matches(CALL_REFERENCE_REGEX, { message: CALL_REFERENCE_ERROR })
  callReference!: string;

  /**
   * Optional — ISO date/time string for when the audited call took
   * place. Accepts either a YYYY-MM-DD date (which the client builds
   * into a midnight ISO timestamp) or a full ISO timestamp.
   */
  @IsOptional()
  @IsISO8601({}, { message: "Call date must be an ISO date or timestamp" })
  callDate?: string | null;

  /**
   * Optional — duration of the audited call in seconds. Capped at 24h
   * defensively so a typo can't blow the column out.
   */
  @IsOptional()
  @IsInt({ message: "Call duration must be an integer (seconds)" })
  @Min(0)
  @Max(60 * 60 * 24)
  callDuration?: number | null;
}
