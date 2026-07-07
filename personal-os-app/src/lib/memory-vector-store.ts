import { prisma } from "@/lib/db";
import { createEmbeddingProviderFromEnv } from "@/lib/embedding-providers";

export type MemoryItemInput = {
  sourceType: "task" | "activity" | "agent_run" | "wiki" | "inbox";
  sourceId: string;
  title: string;
  body: string;
  projectId?: string;
  expiresAt?: Date;
};

export type MemoryVectorHit = {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  projectId?: string | null;
  similarity: number;
  createdAt: Date;
};

/**
 * Cosine similarity between two vectors.
 * Returns value in [0, 1], where 1 = identical direction.
 * Exported for testing.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Upsert a memory item: insert or update if (sourceType, sourceId) already exists.
 * Automatically computes embedding for the body text.
 */
export async function upsertMemoryItem(input: MemoryItemInput): Promise<void> {
  const provider = createEmbeddingProviderFromEnv();
  const embedding = await provider.embed(input.body);

  const existing = await prisma.memoryItem.findFirst({
    where: { sourceType: input.sourceType, sourceId: input.sourceId },
  });

  if (existing) {
    await prisma.memoryItem.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        body: input.body,
        projectId: input.projectId,
        embedding,
        expiresAt: input.expiresAt,
      },
    });
  } else {
    await prisma.memoryItem.create({
      data: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        title: input.title,
        body: input.body,
        projectId: input.projectId,
        embedding,
        expiresAt: input.expiresAt,
      },
    });
  }
}

/**
 * Batch upsert multiple memory items (for offline backfill).
 * Groups by 5 items to avoid overwhelming the embedding provider.
 */
export async function batchUpsertMemoryItems(
  inputs: MemoryItemInput[],
): Promise<void> {
  const provider = createEmbeddingProviderFromEnv();
  const BATCH_SIZE = 5;

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const embeddings = await provider.batchEmbed(batch.map((item) => item.body));

    for (let j = 0; j < batch.length; j++) {
      const input = batch[j];
      const embedding = embeddings[j];

      const existing = await prisma.memoryItem.findFirst({
        where: { sourceType: input.sourceType, sourceId: input.sourceId },
      });

      if (existing) {
        await prisma.memoryItem.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            body: input.body,
            projectId: input.projectId,
            embedding,
            expiresAt: input.expiresAt,
          },
        });
      } else {
        await prisma.memoryItem.create({
          data: {
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            title: input.title,
            body: input.body,
            projectId: input.projectId,
            embedding,
            expiresAt: input.expiresAt,
          },
        });
      }
    }
  }
}

/**
 * Vector similarity search: retrieve top-k memory items by cosine similarity.
 * Filters out expired items. Performs in-memory cosine similarity (PoC).
 */
export async function searchMemoryVectors(
  query: string,
  options: {
    limit?: number;
    projectId?: string;
    minSimilarity?: number;
  } = {},
): Promise<MemoryVectorHit[]> {
  const limit = options.limit ?? 5;
  const minSimilarity = options.minSimilarity ?? 0.5;

  const provider = createEmbeddingProviderFromEnv();
  const queryEmbedding = await provider.embed(query);

  const now = new Date();
  const candidates = await prisma.memoryItem.findMany({
    where: {
      ...(options.projectId ? { projectId: options.projectId } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    take: 200, // Limit scan size for PoC
  });

  const scored = candidates
    .map((item) => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding),
    }))
    .filter((item) => item.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored.map((item) => ({
    id: item.id,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    title: item.title,
    body: item.body,
    projectId: item.projectId,
    similarity: item.similarity,
    createdAt: item.createdAt,
  }));
}

/**
 * Expire old memory items to keep vector store bounded.
 * Call this periodically (e.g., daily cron).
 */
export async function pruneExpiredMemoryItems(): Promise<number> {
  const result = await prisma.memoryItem.deleteMany({
    where: {
      expiresAt: { lte: new Date() },
    },
  });
  return result.count;
}
