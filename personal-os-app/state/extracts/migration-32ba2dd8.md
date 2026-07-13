CREATE TYPE "TaskExecutionMode" AS ENUM (
  'manual',
  'agent_suggested',
  'agent_allowed',
  'approval_required',
  'blocked_until_user'
);

ALTER TABLE "Task"
  ADD COLUMN "executionMode" "TaskExecutionMode" NOT NULL DEFAULT 'manual';

CREATE INDEX "Task_executionMode_riskLevel_idx"
  ON "Task"("executionMode", "riskLevel");
