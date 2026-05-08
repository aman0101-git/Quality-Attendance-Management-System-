import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ProjectStatus } from "../types";

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: "Project name is required" })
  @MinLength(2, { message: "Project name must be at least 2 characters" })
  @MaxLength(100, { message: "Project name is too long (max 100)" })
  projectName!: string;

  @IsString()
  @IsNotEmpty({ message: "Group name is required" })
  @MinLength(2, { message: "Group name must be at least 2 characters" })
  @MaxLength(100, { message: "Group name is too long (max 100)" })
  groupName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: "Description is too long (max 255)" })
  description?: string;

  @IsOptional()
  @IsIn([ProjectStatus.ACTIVE, ProjectStatus.INACTIVE], {
    message: "Status must be ACTIVE or INACTIVE",
  })
  status?: ProjectStatus;
}
