-- CreateTable
CREATE TABLE "InvestmentStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
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

-- CreateTable
CREATE TABLE "InvestmentMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "fitid" TEXT,
    "snapshot" BOOLEAN NOT NULL DEFAULT false,
    "statementId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentMovement_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "InvestmentStatement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentStatement_date_key" ON "InvestmentStatement"("date");
