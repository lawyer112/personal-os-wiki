CREATE TABLE "AgentProfile" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowedRiskLevel" "TaskRiskLevel" NOT NULL DEFAULT 'low',
  "canWriteWiki" BOOLEAN NOT NULL DEFAULT false,
  "canWriteTasks" BOOLEAN NOT NULL DEFAULT true,
  "canTouchFiles" BOOLEAN NOT NULL DEFAULT false,
  "canSendNotifications" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentProfile_enabled_idx" ON "AgentProfile"("enabled");
