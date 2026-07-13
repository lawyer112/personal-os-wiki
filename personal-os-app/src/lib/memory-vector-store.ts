/**
 * Read-only memory vector candidate recall store (PoC).
 *
 * Backs the /api/agent/context episode recall with a vector-candidate layer.
 * Storage is a `MemoryItem` table (source_type, source_id, title, body,
 * projectId, embedding Float[], expiresAt). Similarity is computed in-memory
 * with cosine similarity over the embedding column.
 *
 * This module is intentionally standalone (not yet wired into any live route)
 * so it can be validated in isolation before being enabled behind a flag.
 */

import { prisma } from "./db";
import { createEmbeddingProviderFromEnv } from "./embedding-providers";

export interface MemoryItemInput {
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  projectId?: string | null;
  expiresAt?: Date | null;
}

export interface MemoryVectorHit {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  projectId: string | null;
  similarity: number;
  createdAt: Date;
}

export interface SearchMemoryOptions {
  limit?: number;
  minSimilarity?: number;
  projectId?: string;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_MIN_SIMILARITY = 0.5;

/**
 * Cosine similarity between two equal-length numeric vectors.
 * Returns 0 when either vector has zero magnitude (guards divide-by-zero).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`,
    );
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

type MemoryItemRow = {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  projectId: string | null;
  embedding: number[];
  createdAt: Date;
};

// prisma.memoryItem is added by the Prisma schema; typed loosely here so the
// PoC compiles ahead of the migration landing in every environment.
type MemoryItemDelegate = {
  findFirst: (args: unknown) => Promise<MemoryItemRow | null>;
  findMany: (args: unknown) => Promise<MemoryItemRow[]>;
  create: (args: unknown) => Promise<MemoryItemRow>;
  update: (args: unknown) => Promise<MemoryItemRow>;
  deleteMany: (args: unknown) => Promise<{ count: number }>;
};

function memoryItemDelegate(): MemoryItemDelegate {
  return (prisma as unknown as { memoryItem: MemoryItemDelegate }).memoryItem;
}

/**
 * Insert or update a memory item keyed by (sourceType, sourceId).
 * Recomputes the embedding from title + body on every write.
 */
export async function upsertMemoryItem(
  input: MemoryItemInput,
): Promise<void> {
  const provider = createEmbeddingProviderFromEnv();
  const text = [input.title, input.body].filter(Boolean).join("\n");
  const embedding = await provider.embed(text);

  const db = memoryItemDelegate();
  const existing = await db.findFirst({
    where: { sourceType: input.sourceType, sourceId: input.sourceId },
  });

  if (existing) {
    await db.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        body: input.body,
        projectId: input.projectId ?? null,
        embedding,
        expiresAt: input.expiresAt ?? null,
      },
    });
    return;
  }

  await db.create({
    data: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      body: input.body,
      projectId: input.projectId ?? null,
      embedding,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

/**
 * Batch upsert helper for backfill / seeding.
 */
export async function batchUpsertMemoryItems(
  inputs: MemoryItemInput[],
): Promise<void> {
  for (const input of inputs) {
    await upsertMemoryItem(input);
  }
}

/**
 * Vector candidate search. Filters expired rows at the DB layer, then ranks
 * the remaining candidates in memory by cosine similarity.
 */
export async function searchMemoryVectors(
  query: string,
  options: SearchMemoryOptions = {},
): Promise<MemoryVectorHit[]> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minSimilarity = options.minSimilarity ?? DEFAULT_MIN_SIMILARITY;

  const provider = createEmbeddingProviderFromEnv();
  const queryVec = await provider.embed(query);

  const now = new Date();
  const where: Record<string, unknown> = {
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
  if (options.projectId) {
    where.projectId = options.projectId;
  }

  const rows = await memoryItemDelegate().findMany({ where });

  return rows
    .map((row) => ({
      id: row.id,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      title: row.title,
      body: row.body,
      projectId: row.projectId ?? null,
      similarity: cosineSimilarity(queryVec, row.embedding),
      createdAt: row.createdAt,
    }))
    .filter((hit) => hit.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Delete memory items whose expiry has passed. Returns the number removed.
 */
export async function pruneExpiredMemoryItems(): Promise<number> {
  const result = await memoryItemDelegate().deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return result.count;
}

/**
 * Map a vector hit into the ContextEpisode shape used by /api/agent/context.
 * relevanceScore is scaled from cosine similarity (0..1) into the 0..60 band
 * so vector candidates rank alongside keyword/FTS episodes without dominating.
 */
export function memoryVectorHitToEpisode(hit: MemoryVectorHit) {
  return {
    id: `vec:${hit.id}`,
    sourceType: hit.sourceType,
    sourceId: hit.sourceId,
    title: hit.title,
    body: hit.body,
    projectId: hit.projectId,
    relevanceScore: Math.round(hit.similarity * 60),
    createdAt: hit.createdAt,
  };
}
