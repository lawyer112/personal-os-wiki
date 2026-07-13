-- AddEnum
CREATE TYPE "TaskRiskLevel" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "Task"
  ADD COLUMN "riskLevel" "TaskRiskLevel" NOT NULL DEFAULT 'low',
  ADD COLUMN "agentTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "ownerAgent" TEXT,
  ADD COLUMN "leaseUntil" TIMESTAMP(3),
  ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
  ADD COLUMN "requiredOutput" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TaskClaim" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,

    CONSTRAINT "TaskClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskContribution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceLinks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "artifactUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "nextRecommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskArtifact" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "contributionId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'link',
    "title" TEXT,
    "url" TEXT NOT NULL,
    "verification" TEXT NOT NULL DEFAULT 'unverified',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskReview" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_ownerAgent_leaseUntil_idx" ON "Task"("ownerAgent", "leaseUntil");

-- CreateIndex
CREATE INDEX "TaskClaim_taskId_claimedAt_idx" ON "TaskClaim"("taskId", "claimedAt");

-- CreateIndex
CREATE INDEX "TaskClaim_agentId_leaseUntil_idx" ON "TaskClaim"("agentId", "leaseUntil");

-- CreateIndex
CREATE INDEX "TaskContribution_taskId_createdAt_idx" ON "TaskContribution"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskContribution_agentId_createdAt_idx" ON "TaskContribution"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskArtifact_taskId_createdAt_idx" ON "TaskArtifact"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskArtifact_contributionId_idx" ON "TaskArtifact"("contributionId");

-- CreateIndex
CREATE INDEX "TaskReview_taskId_createdAt_idx" ON "TaskReview"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskReview_reviewer_createdAt_idx" ON "TaskReview"("reviewer", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskClaim" ADD CONSTRAINT "TaskClaim_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskContribution" ADD CONSTRAINT "TaskContribution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskArtifact" ADD CONSTRAINT "TaskArtifact_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskArtifact" ADD CONSTRAINT "TaskArtifact_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "TaskContribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReview" ADD CONSTRAINT "TaskReview_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
