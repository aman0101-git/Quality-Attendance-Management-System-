import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async createUser(data: {
    username: string;
    passwordHash: string;
    name: string;
    role: "ADMIN" | "SUPERVISOR" | "AGENT";
  }) {
    return this.prisma.user.create({
      data,
    });
  }
}