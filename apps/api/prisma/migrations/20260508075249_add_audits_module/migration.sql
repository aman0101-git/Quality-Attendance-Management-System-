-- CreateTable
CREATE TABLE `scorecard_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NULL,
    `group_name` VARCHAR(100) NOT NULL,
    `project_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(191) NOT NULL,

    INDEX `scorecard_templates_group_name_idx`(`group_name`),
    INDEX `scorecard_templates_project_id_idx`(`project_id`),
    INDEX `scorecard_templates_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scorecard_sections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `template_id` INTEGER NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `description` VARCHAR(255) NULL,
    `weight` DOUBLE NOT NULL DEFAULT 1.0,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `scorecard_sections_template_id_idx`(`template_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scorecard_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section_id` INTEGER NOT NULL,
    `prompt` VARCHAR(500) NOT NULL,
    `help_text` VARCHAR(500) NULL,
    `type` ENUM('YES_NO', 'MULTIPLE_CHOICE', 'RATING', 'FREE_TEXT') NOT NULL,
    `weight` DOUBLE NOT NULL DEFAULT 1.0,
    `scoring` BOOLEAN NOT NULL DEFAULT true,
    `fatal` BOOLEAN NOT NULL DEFAULT false,
    `compliance` BOOLEAN NOT NULL DEFAULT false,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `options_json` JSON NULL,

    INDEX `scorecard_questions_section_id_idx`(`section_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_code` VARCHAR(40) NOT NULL,
    `status` ENUM('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
    `agent_id` VARCHAR(191) NOT NULL,
    `supervisor_id` VARCHAR(191) NOT NULL,
    `project_id` INTEGER NOT NULL,
    `group_name_snapshot` VARCHAR(100) NOT NULL,
    `project_name_snapshot` VARCHAR(120) NOT NULL,
    `scorecard_snapshot` JSON NULL,
    `call_reference` VARCHAR(120) NOT NULL,
    `total_score` DOUBLE NULL,
    `final_score` DOUBLE NULL,
    `fatal_triggered` BOOLEAN NOT NULL DEFAULT false,
    `overall_comment` TEXT NULL,
    `scorecard_template_id` INTEGER NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `reviewed_by` VARCHAR(191) NULL,
    `submitted_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `audits_audit_code_key`(`audit_code`),
    INDEX `audits_agent_id_idx`(`agent_id`),
    INDEX `audits_supervisor_id_idx`(`supervisor_id`),
    INDEX `audits_project_id_idx`(`project_id`),
    INDEX `audits_status_idx`(`status`),
    INDEX `audits_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_sections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_id` INTEGER NOT NULL,
    `source_section_id` INTEGER NULL,
    `title` VARCHAR(160) NOT NULL,
    `weight` DOUBLE NOT NULL DEFAULT 1.0,
    `position` INTEGER NOT NULL DEFAULT 0,
    `section_score` DOUBLE NULL,
    `remark` VARCHAR(500) NULL,

    INDEX `audit_sections_audit_id_idx`(`audit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_id` INTEGER NOT NULL,
    `section_id` INTEGER NOT NULL,
    `source_question_id` INTEGER NULL,
    `prompt` VARCHAR(500) NOT NULL,
    `help_text` VARCHAR(500) NULL,
    `type` ENUM('YES_NO', 'MULTIPLE_CHOICE', 'RATING', 'FREE_TEXT') NOT NULL,
    `weight` DOUBLE NOT NULL DEFAULT 1.0,
    `scoring` BOOLEAN NOT NULL DEFAULT true,
    `fatal` BOOLEAN NOT NULL DEFAULT false,
    `compliance` BOOLEAN NOT NULL DEFAULT false,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `options_json` JSON NULL,

    INDEX `audit_questions_audit_id_idx`(`audit_id`),
    INDEX `audit_questions_section_id_idx`(`section_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_answers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_id` INTEGER NOT NULL,
    `section_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `value` TEXT NULL,
    `normalized_score` DOUBLE NULL,
    `fatal_hit` BOOLEAN NOT NULL DEFAULT false,
    `remark` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `audit_answers_audit_id_idx`(`audit_id`),
    INDEX `audit_answers_question_id_idx`(`question_id`),
    UNIQUE INDEX `audit_answers_audit_id_question_id_key`(`audit_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scorecard_templates` ADD CONSTRAINT `scorecard_templates_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scorecard_sections` ADD CONSTRAINT `scorecard_sections_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `scorecard_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scorecard_questions` ADD CONSTRAINT `scorecard_questions_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `scorecard_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audits` ADD CONSTRAINT `audits_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audits` ADD CONSTRAINT `audits_supervisor_id_fkey` FOREIGN KEY (`supervisor_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audits` ADD CONSTRAINT `audits_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audits` ADD CONSTRAINT `audits_scorecard_template_id_fkey` FOREIGN KEY (`scorecard_template_id`) REFERENCES `scorecard_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audits` ADD CONSTRAINT `audits_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audits` ADD CONSTRAINT `audits_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_sections` ADD CONSTRAINT `audit_sections_audit_id_fkey` FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_answers` ADD CONSTRAINT `audit_answers_audit_id_fkey` FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_answers` ADD CONSTRAINT `audit_answers_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `audit_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_answers` ADD CONSTRAINT `audit_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `audit_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
