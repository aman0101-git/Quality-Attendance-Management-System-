"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = __importStar(require("bcrypt"));
const BCRYPT_ROUNDS = 10;
const ROLE_CREATION_MATRIX = {
    ADMIN: ["SUPERVISOR", "AGENT"],
    SUPERVISOR: ["AGENT"],
    AGENT: [],
};
function toSafeUser(user) {
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
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByUsername(username) {
        return this.prisma.user.findUnique({
            where: { username },
        });
    }
    async listUsers(filter = {}) {
        const rows = await this.prisma.user.findMany({
            where: { role: filter.role },
            orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        });
        return rows.map(toSafeUser);
    }
    async createUserAsActor(actorRole, dto) {
        const allowed = ROLE_CREATION_MATRIX[actorRole] ?? [];
        if (!allowed.includes(dto.role)) {
            throw new common_1.ForbiddenException(`Your role (${actorRole}) is not allowed to create a ${dto.role}`);
        }
        const existing = await this.prisma.user.findUnique({
            where: { username: dto.username },
        });
        if (existing) {
            throw new common_1.ConflictException("Username is already taken");
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
    async createUser(data) {
        return this.prisma.user.create({ data });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map