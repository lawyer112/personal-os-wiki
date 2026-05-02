-- Add execution-attempt and agent-action audit tables.

ALTER TABLE "TaskContribution"
  ADD COLUMN "taskRunId" TEXT;

CREATE TABLE "TaskRun" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "policySnapshot" JSONB NOT NULL,
    "resultSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "TaskRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentActionLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskRunId" TEXT,
    "agentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentActionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskRun_taskId_startedAt_idx" ON "TaskRun"("taskId", "startedAt");
CREATE INDEX "TaskRun_agentId_status_startedAt_idx" ON "TaskRun"("agentId", "status", "startedAt");
CREATE INDEX "TaskRun_status_submittedAt_idx" ON "TaskRun"("status", "submittedAt");
CREATE INDEX "TaskContribution_taskRunId_createdAt_idx" ON "TaskContribution"("taskRunId", "createdAt");
CREATE INDEX "AgentActionLog_taskId_createdAt_idx" ON "AgentActionLog"("taskId", "createdAt");
CREATE INDEX "AgentActionLog_taskRunId_createdAt_idx" ON "AgentActionLog"("taskRunId", "createdAt");
CREATE INDEX "AgentActionLog_agentId_createdAt_idx" ON "AgentActionLog"("agentId", "createdAt");

ALTER TABLE "TaskRun" ADD CONSTRAINT "TaskRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskContribution" ADD CONSTRAINT "TaskContribution_taskRunId_fkey" FOREIGN KEY ("taskRunId") REFERENCES "TaskRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentActionLog" ADD CONSTRAINT "AgentActionLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentActionLog" ADD CONSTRAINT "AgentActionLog_taskRunId_fkey" FOREIGN KEY ("taskRunId") REFERENCES "TaskRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
