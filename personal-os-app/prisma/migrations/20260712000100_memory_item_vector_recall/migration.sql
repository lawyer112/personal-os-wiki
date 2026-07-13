-- CreateTable
CREATE TABLE "MemoryItem" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "projectId" TEXT,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryItem_projectId_idx" ON "MemoryItem"("projectId");

-- CreateIndex
CREATE INDEX "MemoryItem_expiresAt_idx" ON "MemoryItem"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryItem_sourceType_sourceId_key" ON "MemoryItem"("sourceType", "sourceId");
