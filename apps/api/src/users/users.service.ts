import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";
import type { CreateUserDto } from "./dto/create-user.dto";
import { Role } from "../auth/role.enum";

const BCRYPT_ROUNDS = 10;

/**
 * Defines who can create whom. Centralized so both server and (mirrored)
 * client logic stay in sync.
 *
 * - ADMIN can create SUPERVISOR and AGENT
 * - SUPERVISOR can create AGENT only
 * - AGENT can create no one
 */
const ROLE_CREATION_MATRIX: Record<Role, Role[]> = {
  ADMIN: ["SUPERVISOR", "AGENT"],
  SUPERVISOR: ["AGENT"],
  AGENT: [],
};

/** Public-safe shape used for API responses. */
export type SafeUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toSafeUser(user: {
  id: string;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * List users, optionally filtered by role. Used by the Agents page.
   * Always returns the safe shape (no `passwordHash`).
   */
  async listUsers(filter: { role?: Role } = {}): Promise<SafeUser[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: filter.role },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toSafeUser);
  }

  /**
   * Create a user, performing:
   *   - role-permission check (actor → target role)
   *   - duplicate-username check (returns 409 instead of relying on the DB error)
   *   - password hashing with bcrypt
   *
   * The full `User` row (including `passwordHash`) never leaves this service.
   */
  async createUserAsActor(
    actorRole: Role,
    dto: CreateUserDto,
  ): Promise<SafeUser> {
    const allowed = ROLE_CREATION_MATRIX[actorRole] ?? [];
    if (!allowed.includes(dto.role)) {
      throw new ForbiddenException(
        `Your role (${actorRole}) is not allowed to create a ${dto.role}`,
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException("Username is already taken");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();

    const created = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        name: fullName,
        role: dto.role,
      },
    });

    return toSafeUser(created);
  }

  /**
   * Legacy creator used by the seed script and tests.
   * Accepts a pre-hashed password and trusts the caller.
   */
  async createUser(data: {
    username: string;
    passwordHash: string;
    name: string;
    role: Role;
  }) {
    return this.prisma.user.create({ data });
  }
}
