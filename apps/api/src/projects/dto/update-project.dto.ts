import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ProjectStatus } from "../types";

/**
 * General-purpose update DTO. Every field is optional so partial updates
 * are supported, but `class-validator` still constrains values that are sent.
 */
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  projectName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  groupName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsIn([ProjectStatus.ACTIVE, ProjectStatus.INACTIVE], {
    message: "Status must be ACTIVE or INACTIVE",
  })
  status?: ProjectStatus;
}

/**
 * Body for the `PATCH /projects/:id/status` endpoint — kept narrow on purpose
 * so the status-toggle UI doesn't accidentally update unrelated fields.
 */
export class UpdateProjectStatusDto {
  @IsIn([ProjectStatus.ACTIVE, ProjectStatus.INACTIVE], {
    message: "Status must be ACTIVE or INACTIVE",
  })
  status!: ProjectStatus;
}
