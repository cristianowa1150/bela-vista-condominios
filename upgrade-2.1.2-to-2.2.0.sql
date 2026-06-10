-- Upgrade v2.1.x → v2.2.0: módulo de investimentos
CREATE TABLE `InvestmentStatement` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'MOVIMENTACAO',
    `totalValue` DOUBLE NOT NULL,
    `rendimento` DOUBLE NOT NULL DEFAULT 0,
    `irPrevisto` DOUBLE NOT NULL DEFAULT 0,
    `iofPrevisto` DOUBLE NOT NULL DEFAULT 0,
    `periodStart` DATETIME(3) NULL,
    `periodEnd` DATETIME(3) NULL,
    `filename` VARCHAR(191) NOT NULL,
    `fileHash` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `InvestmentStatement_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InvestmentMovement` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `fitid` VARCHAR(191) NULL,
    `snapshot` BOOLEAN NOT NULL DEFAULT false,
    `statementId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InvestmentMovement` ADD CONSTRAINT `InvestmentMovement_statementId_fkey` FOREIGN KEY (`statementId`) REFERENCES `InvestmentStatement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
