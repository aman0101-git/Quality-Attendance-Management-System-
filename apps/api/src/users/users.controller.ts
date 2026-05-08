import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../auth/current-user.decorator";
import { Role } from "../auth/role.enum";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Create a new user.
   *
   * The endpoint is open to ADMIN and SUPERVISOR — but the service performs
   * the per-role allow-list check so a SUPERVISOR can never create a
   * SUPERVISOR or ADMIN even if the controller annotation drifts.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles("ADMIN", "SUPERVISOR")
  async createUser(
    @CurrentUser() actor: CurrentUserPayload,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.createUserAsActor(actor.role, dto);
  }

  /**
   * List users, optionally filtered by role.
   * Used by the Supervisor "Agents" page (`?role=AGENT`) and the Admin
   * users table.
   */
  @Get()
  @Roles("ADMIN", "SUPERVISOR")
  async listUsers(@Query("role") role?: string) {
    const valid: Role[] = ["ADMIN", "SUPERVISOR", "AGENT"];
    const roleFilter =
      role && (valid as string[]).includes(role) ? (role as Role) : undefined;
    return this.usersService.listUsers({ role: roleFilter });
  }
}
