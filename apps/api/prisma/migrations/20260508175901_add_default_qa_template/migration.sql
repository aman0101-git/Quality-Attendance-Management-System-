-- AlterTable
ALTER TABLE `scorecard_templates` ADD COLUMN `is_default` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `scorecard_templates_is_default_idx` ON `scorecard_templates`(`is_default`);
