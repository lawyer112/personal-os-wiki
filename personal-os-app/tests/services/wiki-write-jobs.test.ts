import { describe, expect, it, vi } from "vitest";

import { buildWikiWriteStatus, queueWikiWriteJobs } from "@/lib/wiki-write-jobs";

describe("wiki write jobs", () => {
  it("persists queued Wiki writes with source metadata and an idempotency key", async () => {
    const db = {
      wikiWriteJob: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: "wiki_job_1",
          title: data.title,
          status: data.status,
          idempotencyKey: data.idempotencyKey,
        })),
      },
      activityLog: {
        create: vi.fn().mockResolvedValue({ id: "activity_1" }),
      },
    };

    const jobs = await queueWikiWriteJobs(
      db,
      [
        {
          title: "Queue me",
          content: "Body",
          source_type: "agent-output",
          tags: ["personal-os"],
          metadata: { request_id: "req_1" },
        },
      ],
      {
        inboxId: "inbox_1",
        agentRunId: "run_1",
        projectId: "project_1",
      },
    );

    expect(jobs).toEqual([
      {
        id: "wiki_job_1",
        title: "Queue me",
        status: "queued",
      },
    ]);
    expect(db.wikiWriteJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Queue me",
        status: "queued",
        sourceInboxItemId: "inbox_1",
        sourceAgentRunId: "run_1",
        projectId: "project_1",
        idempotencyKey: expect.stringMatching(/^wiki-write:/),
        payload: expect.objectContaining({
          title: "Queue me",
          metadata: expect.objectContaining({
            request_id: "req_1",
            personal_os_inbox_id: "inbox_1",
            personal_os_agent_run_id: "run_1",
            personal_os_project_id: "project_1",
          }),
        }),
      }),
    });
    expect(db.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: "hermes",
        action: "wikiWriteJob.queued",
        targetType: "wikiWriteJob",
        targetId: "wiki_job_1",
      }),
    });
  });

  it("summarizes queued jobs without treating them as completed Wiki writes", () => {
    expect(
      buildWikiWriteStatus(1, [
        {
          id: "wiki_job_1",
          title: "Queue me",
          status: "queued",
        },
      ]),
    ).toEqual({
      status: "queued",
      requested: 1,
      queued: 1,
      succeeded: 0,
      failed: 0,
      errors: [],
      job_ids: ["wiki_job_1"],
    });
  });
});
