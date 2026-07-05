import { afterEach, describe, expect, it, vi } from "vitest";

const protocolRequest = (body: unknown = {}, token = "os-write-token-0000") =>
  new Request("http://os.local/api/tasks/task_1/protocol", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

const emptyPostRequest = (token = "os-write-token-0000") =>
  new Request("http://os.local/api/tasks/task_1/complete", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

const params = { params: Promise.resolve({ id: "task_1" }) };

async function loadProtocolRoutes() {
  vi.resetModules();

  const mocks = {
    prisma: { task: {}, activityLog: {} },
    claimTask: vi.fn().mockResolvedValue({
      task: { id: "task_1", status: "doing" },
      claim: { id: "claim_1" },
    }),
    heartbeatTask: vi.fn().mockResolvedValue({
      id: "task_1",
      status: "doing",
      ownerAgent: "agent_1",
    }),
    addTaskContribution: vi.fn().mockResolvedValue({
      contribution: { id: "contribution_1" },
      artifacts: [],
    }),
    submitTask: vi.fn().mockResolvedValue({
      task: { id: "task_1", status: "review" },
      contribution: { id: "contribution_1" },
      artifacts: [],
    }),
    reviewTask: vi.fn().mockResolvedValue({
      task: { id: "task_1", status: "archived" },
      review: { id: "review_1" },
    }),
    completeTask: vi.fn().mockResolvedValue({
      id: "task_1",
      status: "done",
    }),
  };

  vi.doMock("@/lib/db", () => ({ prisma: mocks.prisma }));
  vi.doMock("@/lib/agent-tasks", () => ({
    claimTask: mocks.claimTask,
    heartbeatTask: mocks.heartbeatTask,
    addTaskContribution: mocks.addTaskContribution,
    submitTask: mocks.submitTask,
    reviewTask: mocks.reviewTask,
  }));
  vi.doMock("@/lib/tasks", () => ({
    completeTask: mocks.completeTask,
  }));

  const [claimRoute, heartbeatRoute, contributionsRoute, submitRoute, reviewRoute, completeRoute] =
    await Promise.all([
      import("@/app/api/tasks/[id]/claim/route"),
      import("@/app/api/tasks/[id]/heartbeat/route"),
      import("@/app/api/tasks/[id]/contributions/route"),
      import("@/app/api/tasks/[id]/submit/route"),
      import("@/app/api/tasks/[id]/review/route"),
      import("@/app/api/tasks/[id]/complete/route"),
    ]);

  return {
    mocks,
    claimRoute,
    heartbeatRoute,
    contributionsRoute,
    submitRoute,
    reviewRoute,
    completeRoute,
  };
}

describe("agent task protocol routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("routes claim requests through the task lease service", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");
    const { claimRoute, mocks } = await loadProtocolRoutes();

    const response = await claimRoute.POST(
      protocolRequest({ agentId: "agent_1", leaseMinutes: 45 }),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.task.status).toBe("doing");
    expect(mocks.claimTask).toHaveBeenCalledWith(mocks.prisma, "task_1", {
      agentId: "agent_1",
      leaseMinutes: 45,
    });
  });

  it("rejects read-token attempts before mutating task protocol state", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "os-read-token-00000");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");
    const {
      claimRoute,
      heartbeatRoute,
      contributionsRoute,
      submitRoute,
      reviewRoute,
      completeRoute,
      mocks,
    } = await loadProtocolRoutes();

    const claimResponse = await claimRoute.POST(protocolRequest({}, "os-read-token-00000"), params);
    const heartbeatResponse = await heartbeatRoute.POST(
      protocolRequest({}, "os-read-token-00000"),
      params,
    );
    const contributionResponse = await contributionsRoute.POST(
      protocolRequest({}, "os-read-token-00000"),
      params,
    );
    const submitResponse = await submitRoute.POST(
      protocolRequest({}, "os-read-token-00000"),
      params,
    );
    const reviewResponse = await reviewRoute.POST(
      protocolRequest({}, "os-read-token-00000"),
      params,
    );
    const completeResponse = await completeRoute.POST(
      emptyPostRequest("os-read-token-00000"),
      params,
    );

    expect([
      claimResponse.status,
      heartbeatResponse.status,
      contributionResponse.status,
      submitResponse.status,
      reviewResponse.status,
      completeResponse.status,
    ]).toEqual([401, 401, 401, 401, 401, 401]);
    expect(mocks.claimTask).not.toHaveBeenCalled();
    expect(mocks.heartbeatTask).not.toHaveBeenCalled();
    expect(mocks.addTaskContribution).not.toHaveBeenCalled();
    expect(mocks.submitTask).not.toHaveBeenCalled();
    expect(mocks.reviewTask).not.toHaveBeenCalled();
    expect(mocks.completeTask).not.toHaveBeenCalled();
  });

  it("routes heartbeat requests through the lease renewal service", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");
    const { heartbeatRoute, mocks } = await loadProtocolRoutes();

    const response = await heartbeatRoute.POST(
      protocolRequest({ agentId: "agent_1", leaseMinutes: 30 }),
      params,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.task.ownerAgent).toBe("agent_1");
    expect(mocks.heartbeatTask).toHaveBeenCalledWith(mocks.prisma, "task_1", {
      agentId: "agent_1",
      leaseMinutes: 30,
    });
  });

  it("routes contribution and submit requests without letting agents mark themselves done", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");
    const { contributionsRoute, submitRoute, mocks } = await loadProtocolRoutes();
    const contributionInput = {
      agentId: "agent_1",
      summary: "Added evidence.",
      evidenceLinks: ["wiki://evidence"],
      artifactUrls: ["https://example.com/artifact"],
      nextRecommendation: "Submit for review.",
    };

    const contributionResponse = await contributionsRoute.POST(
      protocolRequest(contributionInput),
      params,
    );
    const submitResponse = await submitRoute.POST(
      protocolRequest({
        ...contributionInput,
        resultType: "artifact",
        definitionOfDoneMet: true,
        needsHumanDecision: false,
      }),
      params,
    );
    const submitBody = await submitResponse.json();

    expect(contributionResponse.status).toBe(201);
    expect(submitBody.task.status).toBe("review");
    expect(mocks.addTaskContribution).toHaveBeenCalledWith(
      mocks.prisma,
      "task_1",
      contributionInput,
    );
    expect(mocks.submitTask).toHaveBeenCalledWith(
      mocks.prisma,
      "task_1",
      expect.objectContaining({ definitionOfDoneMet: true }),
    );
  });

  it("routes review and manual completion through their dedicated services", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");
    const { reviewRoute, completeRoute, mocks } = await loadProtocolRoutes();

    const reviewResponse = await reviewRoute.POST(
      protocolRequest({
        reviewer: "verifier",
        decision: "archive",
        comment: "Synthetic task archived.",
      }),
      params,
    );
    const completeResponse = await completeRoute.POST(emptyPostRequest(), params);
    const reviewBody = await reviewResponse.json();
    const completeBody = await completeResponse.json();

    expect(reviewBody.task.status).toBe("archived");
    expect(completeBody.task.status).toBe("done");
    expect(mocks.reviewTask).toHaveBeenCalledWith(mocks.prisma, "task_1", {
      reviewer: "verifier",
      decision: "archive",
      comment: "Synthetic task archived.",
    });
    expect(mocks.completeTask).toHaveBeenCalledWith(mocks.prisma, "task_1");
  });
});
