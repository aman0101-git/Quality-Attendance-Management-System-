import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Min,
} from "class-validator";

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

  @IsString()
  @IsNotEmpty({ message: "Call reference is required" })
  @MinLength(2, { message: "Call reference must be at least 2 characters" })
  @MaxLength(120, { message: "Call reference is too long (max 120)" })
  callReference!: string;
}
