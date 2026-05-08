import { PrismaService } from "../prisma/prisma.service";
import type { CreateUserDto } from "./dto/create-user.dto";
import { Role } from "../auth/role.enum";
export type SafeUser = {
    id: string;
    username: string;
    name: string;
    role: Role;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findByUsername(username: string): Promise<{
        id: string;
        username: string;
        passwordHash: string;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    listUsers(filter?: {
        role?: Role;
    }): Promise<SafeUser[]>;
    createUserAsActor(actorRole: Role, dto: CreateUserDto): Promise<SafeUser>;
    createUser(data: {
        username: string;
        passwordHash: string;
        name: string;
        role: Role;
    }): Promise<{
        id: string;
        username: string;
        passwordHash: string;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
