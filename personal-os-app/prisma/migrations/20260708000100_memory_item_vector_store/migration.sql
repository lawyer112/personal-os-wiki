-- CreateTable: local vector memory store for hybrid episode recall PoC.
-- Each row holds a text chunk and its embedding (Float[]) for cosine-similarity search.
CREATE TABLE "MemoryItem" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "projectId" TEXT,
    "embedding" DOUBLE PRECISION[],
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryItem_sourceType_sourceId_idx" ON "MemoryItem"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "MemoryItem_projectId_createdAt_idx" ON "MemoryItem"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryItem_expiresAt_idx" ON "MemoryItem"("expiresAt");
