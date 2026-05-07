import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
export declare class AuthService {
    private usersService;
    private jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    validateUser(username: string, password: string): Promise<{
        id: string;
        username: string;
        passwordHash: string;
        name: string;
        role: import("@prisma/client").$Enums.Role;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    login(username: string, password: string): Promise<{
        accessToken: string;
        user: {
            id: string;
            username: string;
            passwordHash: string;
            name: string;
            role: import("@prisma/client").$Enums.Role;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
}
