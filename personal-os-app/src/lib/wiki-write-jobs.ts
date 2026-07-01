import { createHash } from "node:crypto";

import { recordActivity } from "@/lib/activity";
import type { WikiIngestInput } from "@/lib/validation";

export type WikiWriteJobStatus =
  | "queued"
  | "processing"
  | "done"
  | "retry"
  | "failed"
  | "cancelled";

export type WikiWriteJobSummary = {
  id: string;
  title: string;
  status: WikiWriteJobStatus;
  notePath?: string | null;
  noteUrl?: string | null;
  lastError?: string | null;
};

export type WikiWriteStatus = {
  status: "skipped" | "queued";
  requested: number;
  queued: number;
  succeeded: number;
  failed: number;
  errors: { title: string; error: string }[];
  job_ids: string[];
};

type QueueWikiWriteContext = {
  inboxId: string;
  agentRunId: string;
  projectId?: string;
};

export type WikiWriteJobDb = {
  wikiWriteJob: unknown;
  activityLog: unknown;
};

type WikiWriteJobDelegate = {
  create(args: unknown): Promise<WikiWriteJobSummary>;
};

export const wikiWriteJobTitle = (input: WikiIngestInput) =>
  input.frontmatter?.title ?? input.title ?? "untitled-wiki-note";

export const buildWikiWriteJobPayload = (
  input: WikiIngestInput,
  context: QueueWikiWriteContext,
) => ({
  ...input,
  metadata: {
    ...(input.metadata ?? {}),
    personal_os_inbox_id: context.inboxId,
    personal_os_agent_run_id: context.agentRunId,
    ...(context.projectId ? { personal_os_project_id: context.projectId } : {}),
  },
});

export const wikiWriteJobIdempotencyKey = (
  payload: ReturnType<typeof buildWikiWriteJobPayload>,
  context: QueueWikiWriteContext,
  index: number,
) => {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        index,
        inboxId: context.inboxId,
        agentRunId: context.agentRunId,
        projectId: context.projectId ?? null,
        payload,
      }),
    )
    .digest("hex")
    .slice(0, 32);

  return `wiki-write:${digest}`;
};

export async function queueWikiWriteJobs<TDb extends WikiWriteJobDb>(
  db: TDb,
  notes: WikiIngestInput[],
  context: QueueWikiWriteContext,
) {
  const wikiWriteJob = db.wikiWriteJob as WikiWriteJobDelegate;
  const jobs: WikiWriteJobSummary[] = [];

  for (const [index, note] of notes.entries()) {
    const payload = buildWikiWriteJobPayload(note, context);
    const job = await wikiWriteJob.create({
      data: {
        idempotencyKey: wikiWriteJobIdempotencyKey(payload, context, index),
        title: wikiWriteJobTitle(note),
        payload,
        status: "queued",
        sourceInboxItemId: context.inboxId,
        sourceAgentRunId: context.agentRunId,
        projectId: context.projectId,
      },
    });

    await recordActivity(db, {
      actorType: "hermes",
      action: "wikiWriteJob.queued",
      targetType: "wikiWriteJob",
      targetId: job.id,
      after: {
        title: job.title,
        status: job.status,
        sourceInboxItemId: context.inboxId,
        sourceAgentRunId: context.agentRunId,
        projectId: context.projectId ?? null,
      },
    });

    jobs.push(toWikiWriteJobSummary(job));
  }

  return jobs;
}

export const buildWikiWriteStatus = (
  requested: number,
  jobs: WikiWriteJobSummary[],
): WikiWriteStatus => ({
  status: requested === 0 ? "skipped" : "queued",
  requested,
  queued: jobs.length,
  succeeded: 0,
  failed: 0,
  errors: [],
  job_ids: jobs.map((job) => job.id),
});

export const wikiWriteJobResponse = (job: WikiWriteJobSummary) => ({
  ok: true,
  title: job.title,
  status: job.status,
  job_id: job.id,
  note_path: job.notePath ?? undefined,
  url: job.noteUrl ?? undefined,
});

const toWikiWriteJobSummary = (job: WikiWriteJobSummary): WikiWriteJobSummary => ({
  id: job.id,
  title: job.title,
  status: job.status,
  notePath: job.notePath,
  noteUrl: job.noteUrl,
  lastError: job.lastError,
});
