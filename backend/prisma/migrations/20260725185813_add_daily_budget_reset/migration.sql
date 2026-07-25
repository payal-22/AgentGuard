-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancialAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "transactionLimit" INTEGER NOT NULL,
    "approvalThreshold" INTEGER NOT NULL,
    "dailyBudget" INTEGER NOT NULL,
    "spentToday" INTEGER NOT NULL DEFAULT 0,
    "budgetResetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FinancialAgent" ("approvalThreshold", "createdAt", "dailyBudget", "description", "id", "name", "spentToday", "status", "transactionLimit", "updatedAt") SELECT "approvalThreshold", "createdAt", "dailyBudget", "description", "id", "name", "spentToday", "status", "transactionLimit", "updatedAt" FROM "FinancialAgent";
DROP TABLE "FinancialAgent";
ALTER TABLE "new_FinancialAgent" RENAME TO "FinancialAgent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
