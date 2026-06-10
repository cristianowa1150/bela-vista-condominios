-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvestmentStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MOVIMENTACAO',
    "totalValue" REAL NOT NULL,
    "rendimento" REAL NOT NULL DEFAULT 0,
    "irPrevisto" REAL NOT NULL DEFAULT 0,
    "iofPrevisto" REAL NOT NULL DEFAULT 0,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "filename" TEXT NOT NULL,
    "fileHash" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_InvestmentStatement" ("createdAt", "date", "fileHash", "filename", "id", "iofPrevisto", "irPrevisto", "periodEnd", "periodStart", "rendimento", "totalValue", "userId") SELECT "createdAt", "date", "fileHash", "filename", "id", "iofPrevisto", "irPrevisto", "periodEnd", "periodStart", "rendimento", "totalValue", "userId" FROM "InvestmentStatement";
DROP TABLE "InvestmentStatement";
ALTER TABLE "new_InvestmentStatement" RENAME TO "InvestmentStatement";
CREATE UNIQUE INDEX "InvestmentStatement_date_key" ON "InvestmentStatement"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
