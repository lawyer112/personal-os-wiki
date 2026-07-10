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

function intakeBody(overrides: Record<string, unknown> = {}) {
  return {
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
      reasoningSummary: "Verify Wiki and task linkage.",
    },
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
        definitionOfDone: "The intake response is 201 and includes the task plus the Wiki result.",
        wikiLinks: [],
      },
    ],
    ...overrides,
  };
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
      intakeRequest(intakeBody({
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
      })),
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

  it("creates task proposals in review and only promotes explicit bounded low-risk work", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");

    const { POST, mocks } = await loadIntakeRoute();
    mocks.createTask.mockImplementation(async (_db, input) => ({
      id: `task_${mocks.createTask.mock.calls.length}`,
      title: input.title,
      status: input.status,
      executionMode: input.executionMode,
    }));

    const response = await POST(
      intakeRequest(
        intakeBody({
          tasks: [],
          taskProposals: [
            {
              title: "先审阅的模糊提案",
              nextAction: "确认范围。",
              definitionOfDone: "用户确认范围。",
              agentTags: ["personal-os"],
            },
            {
              title: "可自动提升的明确修复",
              nextAction: "运行已知测试。",
              definitionOfDone: "测试通过。",
              riskLevel: "low",
              estimateMinutes: 30,
              agentTags: ["personal-os"],
              autoPromote: true,
            },
          ],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.taskProposals).toEqual([
      expect.objectContaining({
        title: "先审阅的模糊提案",
        status: "review",
        executionMode: "agent_suggested",
      }),
      expect.objectContaining({
        title: "可自动提升的明确修复",
        status: "todo",
        executionMode: "agent_allowed",
      }),
    ]);
    expect(mocks.createTask).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        status: "review",
        executionMode: "agent_suggested",
        agentTags: ["task-proposal", "personal-os"],
      }),
    );
    expect(mocks.createTask).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        status: "todo",
        executionMode: "agent_allowed",
      }),
    );
  });

  it("links successful Wiki writes to every task created by the same intake", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");

    const { POST, mocks } = await loadIntakeRoute();
    mocks.ingestWikiNote.mockResolvedValue({
      ok: true,
      title: "Protocol runbook",
      note_path: "vault/protocol-runbook.md",
      url: "http://wiki.local/note?path=vault%2Fprotocol-runbook.md",
    });
    const response = await POST(
      intakeRequest(
        intakeBody({
          wikiNotes: [
            {
              title: "Protocol runbook",
              content: "Body",
              source_type: "agent-output",
              tags: ["personal-os"],
              metadata: {},
            },
          ],
          tasks: [
            {
              title: "Use protocol runbook",
              status: "todo",
              priority: "P1",
              riskLevel: "low",
              executionMode: "agent_allowed",
              agentTags: ["personal-os"],
              nextAction: "Follow the runbook.",
              definitionOfDone: "The task has a Wiki link and explicit evidence.",
              wikiLinks: [
                {
                  noteTitle: "Explicit evidence",
                  notePath: "vault/explicit.md",
                  sourceType: "manual",
                },
              ],
            },
          ],
        }),
      ),
    );

    expect(response.status).toBe(201);
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "Use protocol runbook",
        sourceInboxItemId: "inbox_1",
        sourceAgentRunId: "run_1",
        wikiLinks: [
          expect.objectContaining({
            noteTitle: "Protocol runbook",
            notePath: "vault/protocol-runbook.md",
            noteUrl: "http://wiki.local/note?path=vault%2Fprotocol-runbook.md",
            sourceType: "personal-wiki",
            sourceInboxItemId: "inbox_1",
            sourceAgentRunId: "run_1",
          }),
          expect.objectContaining({
            noteTitle: "Explicit evidence",
            notePath: "vault/explicit.md",
            sourceType: "manual",
          }),
        ],
      }),
    );
  });
});
