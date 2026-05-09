import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { ProjectsModule } from "./projects/projects.module";
import { AuditsModule } from "./audits/audits.module";
import { ScorecardsModule } from "./scorecards/scorecards.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    ScorecardsModule,
    AuditsModule,
  ],
})
export class AppModule {}
