import { afterEach, describe, expect, it, vi } from "vitest";

function intakeRequest(body: unknown) {
  return new Request("http://os.local/api/intake", {
    method: "POST",
    headers: {
      authorization: "Bearer os-write-token-0000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function loadIntakeRoute() {
  vi.resetModules();

  const mocks = {
    createInboxItem: vi.fn().mockResolvedValue({ id: "inbox_1" }),
    startAgentRun: vi.fn().mockResolvedValue({ id: "run_1" }),
    completeAgentRun: vi.fn().mockResolvedValue({ id: "run_1" }),
    createNote: vi.fn(),
    ingestWikiNote: vi.fn().mockResolvedValue({
      ok: false,
      title: "Wiki fallback demo",
      error: "Personal Wiki returned 500",
    }),
    createTask: vi.fn().mockResolvedValue({
      id: "task_1",
      title: "OS fallback task",
      status: "todo",
    }),
    createIdea: vi.fn(),
    createProjectEvent: vi.fn(),
    createTelegramNotification: vi.fn(),
  };

  vi.doMock("@/lib/db", () => ({
    prisma: {
      project: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    },
  }));
  vi.doMock("@/lib/inbox", () => ({
    createInboxItem: mocks.createInboxItem,
    startAgentRun: mocks.startAgentRun,
    completeAgentRun: mocks.completeAgentRun,
  }));
  vi.doMock("@/lib/wiki-ingest", () => ({
    ingestWikiNote: mocks.ingestWikiNote,
  }));
  vi.doMock("@/lib/notes", () => ({
    createNote: mocks.createNote,
  }));
  vi.doMock("@/lib/tasks", () => ({
    createTask: mocks.createTask,
  }));
  vi.doMock("@/lib/ideas", () => ({
    createIdea: mocks.createIdea,
  }));
  vi.doMock("@/lib/projects", () => ({
    createProjectEvent: mocks.createProjectEvent,
  }));
  vi.doMock("@/lib/notifications", () => ({
    createTelegramNotification: mocks.createTelegramNotification,
  }));

  const route = await import("@/app/api/intake/route");
  return { ...route, mocks };
}

describe("POST /api/intake Wiki fallback", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps OS task writes successful when Wiki note ingest returns 500", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");

    const { POST, mocks } = await loadIntakeRoute();
    const response = await POST(
      intakeRequest({
        source: {
          sourceType: "cron",
          sourcePlatform: "hermes",
          rawText: "check wiki fallback",
          attachments: [],
          createdBy: "hermes",
        },
        agent: {
          model: "hermes-cron",
          classification: { kind: "verification" },
          reasoningSummary: "Verify Wiki failure does not block OS writes.",
        },
        wikiNotes: [
          {
            title: "Wiki fallback demo",
            content: "Body",
            source_type: "cron",
            tags: ["personal-os"],
            metadata: {},
          },
        ],
        tasks: [
          {
            title: "OS fallback task",
            description: "This task proves /api/intake continued after Wiki failed.",
            status: "todo",
            priority: "P0",
            riskLevel: "low",
            executionMode: "agent_allowed",
            agentTags: ["personal-os", "wiki"],
            nextAction: "Run the focused intake fallback test.",
            definitionOfDone: "The intake response is 201 and includes the task plus the Wiki failure result.",
            wikiLinks: [],
          },
        ],
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.tasks).toEqual([
      { id: "task_1", title: "OS fallback task", status: "todo" },
    ]);
    expect(body.wiki).toEqual([
      {
        ok: false,
        title: "Wiki fallback demo",
        error: "Personal Wiki returned 500",
      },
    ]);
    expect(body.wiki_write_status).toEqual({
      status: "failed",
      requested: 1,
      succeeded: 0,
      failed: 1,
      errors: [
        {
          title: "Wiki fallback demo",
          error: "Personal Wiki returned 500",
        },
      ],
    });
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "OS fallback task",
        sourceInboxItemId: "inbox_1",
        sourceAgentRunId: "run_1",
        wikiLinks: [],
      }),
    );
    expect(mocks.createNote).not.toHaveBeenCalled();
    expect(mocks.completeAgentRun).toHaveBeenCalledWith(
      expect.anything(),
      "run_1",
      expect.objectContaining({
        classification: expect.objectContaining({
          kind: "verification",
          wiki_write_status: expect.objectContaining({
            status: "failed",
            requested: 1,
            succeeded: 0,
            failed: 1,
          }),
        }),
        outputSummary: expect.stringContaining("创建 1 个任务"),
        error: undefined,
      }),
    );
  });
});
