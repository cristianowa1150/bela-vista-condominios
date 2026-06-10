-- Upgrade v2.0.1 → v2.1.0: preferências por usuário + configurações globais
ALTER TABLE `User` ADD COLUMN `preferences` LONGTEXT NULL;

CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` LONGTEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
