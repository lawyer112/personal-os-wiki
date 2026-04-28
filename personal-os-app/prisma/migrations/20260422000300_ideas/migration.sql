-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('captured', 'shaping', 'someday', 'promoted', 'archived');

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "IdeaStatus" NOT NULL DEFAULT 'captured',
    "priority" "Priority" NOT NULL DEFAULT 'P2',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nextAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,
    "sourceInboxItemId" TEXT,
    "sourceAgentRunId" TEXT,
    "promotedTaskId" TEXT,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Idea_status_priority_updatedAt_idx" ON "Idea"("status", "priority", "updatedAt");

-- CreateIndex
CREATE INDEX "Idea_projectId_idx" ON "Idea"("projectId");

-- CreateIndex
CREATE INDEX "Idea_promotedTaskId_idx" ON "Idea"("promotedTaskId");

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_sourceInboxItemId_fkey" FOREIGN KEY ("sourceInboxItemId") REFERENCES "InboxItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_sourceAgentRunId_fkey" FOREIGN KEY ("sourceAgentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_promotedTaskId_fkey" FOREIGN KEY ("promotedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
