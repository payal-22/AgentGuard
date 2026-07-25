-- CreateTable
CREATE TABLE "FinancialAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "transactionLimit" INTEGER NOT NULL,
    "approvalThreshold" INTEGER NOT NULL,
    "dailyBudget" INTEGER NOT NULL,
    "spentToday" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentPermission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    CONSTRAINT "AgentPermission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "FinancialAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "customerId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "ApprovalRequest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "FinancialAgent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "agentId" TEXT,
    "agentName" TEXT,
    "action" TEXT,
    "amount" INTEGER,
    "outcome" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "FinancialAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emergencyStop" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AgentPermission_agentId_idx" ON "AgentPermission"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPermission_agentId_action_key" ON "AgentPermission"("agentId", "action");

-- CreateIndex
CREATE INDEX "ApprovalRequest_agentId_idx" ON "ApprovalRequest"("agentId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requestedAt_idx" ON "ApprovalRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_agentId_idx" ON "AuditEvent"("agentId");

-- CreateIndex
CREATE INDEX "AuditEvent_category_idx" ON "AuditEvent"("category");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
