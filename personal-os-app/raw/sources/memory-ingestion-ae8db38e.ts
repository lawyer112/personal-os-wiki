/**
 * memory-ingestion.ts
 *
 * Fire-and-forget helpers that write completed AgentRun / task events into
 * the local vector memory store so future /api/agent/context calls can do
 * hybrid episode recall.
 *
 * All functions are intentionally non-blocking — a failed embedding write
 * must never crash the primary request path.  Errors are logged to stderr.
 *
 * The upsertMemoryItem import is done lazily (dynamic import inside the
 * setImmediate callback) so test suites that do not configure DATABASE_URL
 * are not forced to initialise the Prisma client at module load time.
 */

import type { MemoryItemInput } from "@/lib/memory-vector-store";

/** 30-day TTL for agent-run memory items. */
const AGENT_RUN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 90-day TTL for task memory items. */
const TASK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function isEmbeddingEnabled(): boolean {
  return Boolean(process.env.EMBEDDING_MODEL);
}

/**
 * Schedule a non-blocking upsert.  Swallows errors so callers never need
 * try/catch.  Uses a dynamic import so the Prisma client is only
 * initialised when embedding is actually configured and the callback fires.
 */
function scheduleUpsert(input: MemoryItemInput): void {
  if (!isEmbeddingEnabled()) {
    return;
  }
  setImmediate(() => {
    import("@/lib/memory-vector-store")
      .then(({ upsertMemoryItem }) => upsertMemoryItem(input))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          `[memory-ingestion] upsert failed (${input.sourceType}:${input.sourceId}): ${msg}\n`,
        );
      });
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export type AgentRunMemoryInput = {
  id: string;
  model?: string | null;
  reasoningSummary?: string | null;
  outputSummary?: string | null;
  projectId?: string | null;
};

/**
 * Ingest a completed AgentRun into the vector store.
 * Call after `completeAgentRun` — fire and forget.
 */
export function ingestAgentRun(run: AgentRunMemoryInput): void {
  const body = [run.reasoningSummary, run.outputSummary]
    .filter(Boolean)
    .join("\n");

  if (!body.trim()) {
    return;
  }

  const title = run.model
    ? `AgentRun ${run.id} (${run.model})`
    : `AgentRun ${run.id}`;

  scheduleUpsert({
    sourceType: "agent_run",
    sourceId: run.id,
    title,
    body,
    projectId: run.projectId ?? undefined,
    expiresAt: new Date(Date.now() + AGENT_RUN_TTL_MS),
  });
}

export type TaskMemoryInput = {
  id: string;
  title: string;
  description?: string | null;
  nextAction?: string | null;
  definitionOfDone?: string | null;
  projectId?: string | null;
};

/**
 * Ingest a new task into the vector store.
 * Call after `createTask` — fire and forget.
 */
export function ingestTask(task: TaskMemoryInput): void {
  const body = [
    task.title,
    task.description,
    task.nextAction,
    task.definitionOfDone,
  ]
    .filter(Boolean)
    .join("\n");

  if (!body.trim()) {
    return;
  }

  scheduleUpsert({
    sourceType: "task",
    sourceId: task.id,
    title: task.title,
    body,
    projectId: task.projectId ?? undefined,
    expiresAt: new Date(Date.now() + TASK_TTL_MS),
  });
}
