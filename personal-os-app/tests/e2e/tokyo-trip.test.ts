import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitTask } from "@/lib/agent-tasks";
import { completeAgentRun, createInboxItem, startAgentRun } from "@/lib/inbox";
import { createTask } from "@/lib/tasks";
import { ingestWikiNote } from "@/lib/wiki-ingest";

vi.mock("@/lib/db", () => ({
  prisma: {
    activityLog: { create: vi.fn().mockResolvedValue({ id: "activity_1" }) },
    project: {
      upsert: vi.fn().mockResolvedValue({ id: "project_1", name: "2026-05 东京行" }),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/inbox", () => ({
  createInboxItem: vi.fn().mockResolvedValue({ id: "inbox_1" }),
  startAgentRun: vi.fn().mockResolvedValue({ id: "run_1" }),
  completeAgentRun: vi.fn().mockResolvedValue({ id: "run_1" }),
}));

vi.mock("@/lib/tasks", () => ({
  createTask: vi.fn().mockResolvedValue({
    id: "task_1",
    title: "东京三天行程规划",
    status: "review",
    project: { name: "2026-05 东京行" },
    agentTags: ["tokyo", "travel"],
  }),
}));

vi.mock("@/lib/agent-tasks", () => ({
  submitTask: vi.fn(),
}));

vi.mock("@/lib/wiki-ingest", () => ({
  ingestWikiNote: vi.fn().mockResolvedValue({
    ok: true,
    title: "东京三天行程规划 — 完成总结",
    path: "30_projects/2026-05-东京行/东京三天行程规划.md",
  }),
}));

vi.mock("@/lib/ideas", () => ({
  createIdea: vi.fn(),
}));

vi.mock("@/lib/notes", () => ({
  createNote: vi.fn(),
}));

vi.mock("@/lib/projects", () => ({
  createProjectEvent: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  createTelegramNotification: vi.fn(),
}));

const mockedCreateInboxItem = vi.mocked(createInboxItem);
const mockedStartAgentRun = vi.mocked(startAgentRun);
const mockedCompleteAgentRun = vi.mocked(completeAgentRun);
const mockedCreateTask = vi.mocked(createTask);
const mockedSubmitTask = vi.mocked(submitTask);
const mockedIngestWikiNote = vi.mocked(ingestWikiNote);

const postJson = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("Tokyo trip wiki handoff", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");
    mockedSubmitTask.mockResolvedValue({
      task: {
        id: "task_1",
        title: "东京三天行程规划",
        project: { name: "2026-05 东京行" },
        agentTags: ["tokyo", "travel"],
      },
      contribution: { id: "contribution_1" },
      artifacts: [],
    });
    mockedIngestWikiNote.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("routes a Tokyo intake through submit into a project wiki note", async () => {
    const intakeRoute = await import("@/app/api/intake/route");
    const intakeResponse = await intakeRoute.POST(
      postJson("http://os.local/api/intake", {
        source: {
          sourceType: "telegram",
          rawText: "5月15号去东京三天",
          createdBy: "hermes",
        },
        project: {
          name: "2026-05 东京行",
        },
        tasks: [
          {
            title: "东京三天行程规划",
            nextAction: "整理三天交通和酒店建议。",
            definitionOfDone: "形成可提交的东京三天行程草案。",
            agentTags: ["tokyo", "travel"],
            executionMode: "agent_allowed",
          },
        ],
      }),
    );

    expect(intakeResponse.status).toBe(201);
    expect(mockedCreateInboxItem).toHaveBeenCalled();
    expect(mockedStartAgentRun).toHaveBeenCalled();
    expect(mockedCreateTask).toHaveBeenCalled();
    expect(mockedCompleteAgentRun).toHaveBeenCalled();

    const submitRoute = await import("@/app/api/tasks/[id]/submit/route");
    const submitResponse = await submitRoute.POST(
      postJson("http://os.local/api/tasks/task_1/submit", {
        agentId: "agent_1",
        summary: "东京三天行程已整理，可以进入人工 review。",
        evidenceLinks: ["https://example.com/tokyo"],
        artifactUrls: ["https://example.com/tokyo-plan"],
        resultType: "artifact",
        definitionOfDoneMet: true,
        needsHumanDecision: false,
      }),
      { params: Promise.resolve({ id: "task_1" }) },
    );

    expect(submitResponse.status).toBe(200);
    expect(mockedIngestWikiNote).toHaveBeenCalledWith(
      expect.objectContaining({
        frontmatter: expect.objectContaining({
          type: "project",
          project: "2026-05 东京行",
          task_id: "task_1",
        }),
      }),
    );
  });
});
