-- CreateTable
CREATE TABLE `projects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_name` VARCHAR(100) NOT NULL,
    `group_name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(191) NOT NULL,

    INDEX `projects_group_name_idx`(`group_name`),
    INDEX `projects_status_idx`(`status`),
    INDEX `projects_is_active_idx`(`is_active`),
    UNIQUE INDEX `projects_project_name_group_name_key`(`project_name`, `group_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
