import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordActivity } from "@/lib/activity";
import { submitTask } from "@/lib/agent-tasks";
import { ingestWikiNote } from "@/lib/wiki-ingest";

vi.mock("@/lib/db", () => ({
  prisma: {
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: "activity_1" }),
    },
  },
}));

vi.mock("@/lib/activity", () => ({
  recordActivity: vi.fn().mockResolvedValue({ id: "activity_1" }),
}));

vi.mock("@/lib/agent-tasks", () => ({
  submitTask: vi.fn(),
}));

vi.mock("@/lib/wiki-ingest", () => ({
  ingestWikiNote: vi.fn(),
}));

const mockedSubmitTask = vi.mocked(submitTask);
const mockedIngestWikiNote = vi.mocked(ingestWikiNote);
const mockedRecordActivity = vi.mocked(recordActivity);

const body = {
  agentId: "agent_1",
  summary: "完成东京三天行程草案。",
  evidenceLinks: ["https://example.com/evidence"],
  artifactUrls: ["https://example.com/artifact"],
  resultType: "artifact",
  definitionOfDoneMet: true,
  needsHumanDecision: false,
};

const taskResult = {
  task: {
    id: "task_1",
    title: "东京旅游规划",
    status: "review",
    agentTags: ["tokyo", "travel"],
    project: { name: "2026-05 东京行" },
  },
  contribution: { id: "contribution_1" },
  artifacts: [],
};

const request = () =>
  new Request("http://os.local/api/tasks/task_1/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const loadRoute = async () => {
  vi.resetModules();
  return import("@/app/api/tasks/[id]/submit/route");
};

describe("task submit route wiki summary", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");
    mockedSubmitTask.mockResolvedValue(taskResult);
    mockedIngestWikiNote.mockResolvedValue({
      ok: true,
      title: "东京旅游规划 — 完成总结",
      path: "30_projects/tokyo/summary.md",
    });
    mockedRecordActivity.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("writes a project wiki summary after submit succeeds", async () => {
    const { POST } = await loadRoute();

    const response = await POST(request(), {
      params: Promise.resolve({ id: "task_1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockedSubmitTask).toHaveBeenCalled();
    expect(mockedIngestWikiNote).toHaveBeenCalledWith({
      frontmatter: {
        title: "东京旅游规划 — 完成总结",
        type: "project",
        created_by: "hermes:worker",
        agent_id: "agent_1",
        task_id: "task_1",
        project: "2026-05 东京行",
        source_type: "agent-output",
        tags: ["tokyo", "travel"],
      },
      content: expect.stringContaining("完成东京三天行程草案。"),
    });
    expect(mockedIngestWikiNote.mock.calls[0][0].content).toContain(
      "https://example.com/artifact",
    );
    expect(mockedIngestWikiNote.mock.calls[0][0].content).toContain(
      "http://os.local/tasks/task_1",
    );
  });

  it("keeps submit success and records activity when wiki write fails", async () => {
    mockedIngestWikiNote.mockResolvedValue({
      ok: false,
      title: "东京旅游规划 — 完成总结",
      error: "missing-or-invalid-token",
    });
    const { POST } = await loadRoute();

    const response = await POST(request(), {
      params: Promise.resolve({ id: "task_1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockedRecordActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "wiki-write-failed",
        targetType: "task",
        targetId: "task_1",
        after: expect.objectContaining({
          reason: "missing-or-invalid-token",
        }),
      }),
    );
  });
});
