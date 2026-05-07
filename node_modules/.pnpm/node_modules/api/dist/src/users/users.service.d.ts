import { PrismaService } from "../prisma/prisma.service";
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
    createUser(data: {
        username: string;
        passwordHash: string;
        name: string;
        role: "ADMIN" | "SUPERVISOR" | "AGENT";
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
