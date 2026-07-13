-- CreateTable
CREATE TABLE "TaskWikiLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "noteTitle" TEXT NOT NULL,
    "notePath" TEXT,
    "noteUrl" TEXT,
    "sourceType" TEXT,
    "sourceInboxItemId" TEXT,
    "sourceAgentRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskWikiLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskWikiLink_taskId_idx" ON "TaskWikiLink"("taskId");

-- CreateIndex
CREATE INDEX "TaskWikiLink_notePath_idx" ON "TaskWikiLink"("notePath");

-- AddForeignKey
ALTER TABLE "TaskWikiLink" ADD CONSTRAINT "TaskWikiLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
