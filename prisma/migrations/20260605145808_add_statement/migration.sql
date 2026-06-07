-- CreateTable
CREATE TABLE "AccountStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "saldoEmConta" REAL NOT NULL DEFAULT 0,
    "totalReceitas" REAL NOT NULL DEFAULT 0,
    "totalDespesas" REAL NOT NULL DEFAULT 0,
    "resultado" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "notes" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountStatement_month_key" ON "AccountStatement"("month");
