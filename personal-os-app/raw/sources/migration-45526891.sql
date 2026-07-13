-- CreateEnum
CREATE TYPE "WikiWriteJobStatus" AS ENUM ('queued', 'processing', 'done', 'retry', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "WikiWriteJob" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WikiWriteJobStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notePath" TEXT,
    "noteUrl" TEXT,
    "sourceInboxItemId" TEXT,
    "sourceAgentRunId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiWriteJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WikiWriteJob_idempotencyKey_key" ON "WikiWriteJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WikiWriteJob_status_nextRunAt_createdAt_idx" ON "WikiWriteJob"("status", "nextRunAt", "createdAt");

-- CreateIndex
CREATE INDEX "WikiWriteJob_sourceInboxItemId_idx" ON "WikiWriteJob"("sourceInboxItemId");

-- CreateIndex
CREATE INDEX "WikiWriteJob_sourceAgentRunId_idx" ON "WikiWriteJob"("sourceAgentRunId");

-- CreateIndex
CREATE INDEX "WikiWriteJob_projectId_idx" ON "WikiWriteJob"("projectId");

-- AddForeignKey
ALTER TABLE "WikiWriteJob" ADD CONSTRAINT "WikiWriteJob_sourceInboxItemId_fkey" FOREIGN KEY ("sourceInboxItemId") REFERENCES "InboxItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiWriteJob" ADD CONSTRAINT "WikiWriteJob_sourceAgentRunId_fkey" FOREIGN KEY ("sourceAgentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiWriteJob" ADD CONSTRAINT "WikiWriteJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
