import { Module } from "@nestjs/common";
import { AuditsController } from "./audits.controller";
import { AuditsService } from "./audits.service";
import { AuditScoreService } from "./audit-score.service";
import { ScorecardsModule } from "../scorecards/scorecards.module";

@Module({
  imports: [ScorecardsModule],
  controllers: [AuditsController],
  providers: [AuditsService, AuditScoreService],
  exports: [AuditsService, AuditScoreService],
})
export class AuditsModule {}
