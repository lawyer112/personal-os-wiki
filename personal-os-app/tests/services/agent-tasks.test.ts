import { describe, expect, it, vi } from "vitest";
import {
  addTaskContribution,
  claimTask,
  heartbeatTask,
  listAgentInboxTasks,
  reviewTask,
  submitTask,
} from "@/lib/agent-tasks";

function claimableTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task_1",
    title: "Demo task",
    status: "todo",
    riskLevel: "low",
    executionMode: "agent_allowed",
    ownerAgent: null,
    leaseUntil: null,
    ...overrides,
  };
}

function ownedTask(overrides: Record<string, unknown> = {}) {
  return claimableTask({
    status: "doing",
    ownerAgent: "agent_1",
    leaseUntil: new Date(Date.now() + 60_000),
    ...overrides,
  });
}

function createDb(overrides: Record<string, unknown> = {}) {
  return {
    task: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(claimableTask()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ id: "task_1", status: "doing" }),
    },
    agentProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: "agent_1",
        tags: ["demo", "review"],
        allowedRiskLevel: "medium",
        canWriteTasks: true,
        enabled: true,
      }),
    },
    taskClaim: {
      create: vi.fn().mockResolvedValue({ id: "claim_1", taskId: "task_1" }),
    },
    taskContribution: {
      create: vi.fn().mockResolvedValue({ id: "contribution_1" }),
    },
    taskArtifact: {
      create: vi.fn().mockResolvedValue({ id: "artifact_1" }),
    },
    taskReview: {
      create: vi.fn().mockResolvedValue({ id: "review_1" }),
    },
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: "activity_1" }),
    },
    ...overrides,
  };
}

describe("agent task protocol", () => {
  it("lists inbox tasks with agent tag filters and context routes", async () => {
    const db = createDb({
      task: {
        findMany: vi.fn().mockResolvedValue([{ id: "task_1" }]),
      },
    });

    const tasks = await listAgentInboxTasks(db, {
      agentId: "agent_1",
      tags: ["demo"],
      limit: 5,
    });

    expect(tasks).toEqual([{ id: "task_1" }]);
    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({
          AND: expect.any(Array),
        }),
      }),
    );
  });

  it("claims a task with a lease and records activity", async () => {
    const db = createDb({
      task: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(claimableTask())
          .mockResolvedValueOnce({ id: "task_1", status: "doing" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
        findMany: vi.fn(),
      },
    });

    const result = await claimTask(db, "task_1", {
      agentId: "agent_1",
      leaseMinutes: 30,
    });

    expect(result.task).toEqual({ id: "task_1", status: "doing" });
    expect(db.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "task_1" }),
        data: expect.objectContaining({
          status: "doing",
          ownerAgent: "agent_1",
        }),
      }),
    );
    expect(db.taskClaim.create).toHaveBeenCalled();
    expect(db.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "task.claimed" }),
      }),
    );
  });

  it("rejects a stale concurrent claim when the conditional update loses", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue(claimableTask()),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    await expect(
      claimTask(db, "task_1", { agentId: "agent_1", leaseMinutes: 30 }),
    ).rejects.toThrow("Task lease changed");
  });

  it("rejects direct claims for tasks that still need review", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue(claimableTask({ status: "review" })),
        updateMany: vi.fn(),
      },
    });

    await expect(
      claimTask(db, "task_1", { agentId: "agent_1", leaseMinutes: 30 }),
    ).rejects.toThrow("only todo or expired doing tasks can be claimed");
    expect(db.task.updateMany).not.toHaveBeenCalled();
  });

  it("rejects claims unless the task is explicitly agent_allowed", async () => {
    const db = createDb({
      task: {
        findUnique: vi
          .fn()
          .mockResolvedValue(claimableTask({ executionMode: "manual" })),
        updateMany: vi.fn(),
      },
    });

    await expect(
      claimTask(db, "task_1", { agentId: "agent_1", leaseMinutes: 30 }),
    ).rejects.toThrow("agent claims require agent_allowed");
    expect(db.task.updateMany).not.toHaveBeenCalled();
  });

  it("rejects high-risk auto-claims even when agent_allowed", async () => {
    const db = createDb({
      task: {
        findUnique: vi
          .fn()
          .mockResolvedValue(claimableTask({ riskLevel: "high" })),
        updateMany: vi.fn(),
      },
    });

    await expect(
      claimTask(db, "task_1", { agentId: "agent_1", leaseMinutes: 30 }),
    ).rejects.toThrow("High-risk tasks require explicit approval");
    expect(db.task.updateMany).not.toHaveBeenCalled();
  });

  it("heartbeats an owned task", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue(ownedTask()),
        update: vi.fn().mockResolvedValue({ id: "task_1" }),
      },
    });

    await heartbeatTask(db, "task_1", {
      agentId: "agent_1",
      leaseMinutes: 30,
    });

    expect(db.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerAgent: "agent_1" }),
      }),
    );
  });

  it("rejects heartbeats before a task is claimed", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue(claimableTask()),
        update: vi.fn(),
      },
    });

    await expect(
      heartbeatTask(db, "task_1", {
        agentId: "agent_1",
        leaseMinutes: 30,
      }),
    ).rejects.toThrow("Task is not claimed by an agent");
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("writes a contribution and artifacts for the owning agent", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue(ownedTask()),
      },
    });

    const result = await addTaskContribution(db, "task_1", {
      agentId: "agent_1",
      summary: "Added demo evidence.",
      evidenceLinks: ["wiki://demo"],
      artifactUrls: ["https://example.com/artifact"],
    });

    expect(result.contribution.id).toBe("contribution_1");
    expect(db.taskArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: "https://example.com/artifact",
        }),
      }),
    );
  });

  it("rejects contributions before a task is claimed", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue(claimableTask()),
      },
    });

    await expect(
      addTaskContribution(db, "task_1", {
        agentId: "agent_1",
        summary: "Tried to write without a claim.",
        evidenceLinks: [],
        artifactUrls: [],
      }),
    ).rejects.toThrow("Task is not claimed by an agent");
    expect(db.taskContribution.create).not.toHaveBeenCalled();
  });

  it("rejects contributions after the lease expires", async () => {
    const db = createDb({
      task: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            ownedTask({ leaseUntil: new Date(Date.now() - 60_000) }),
          ),
      },
    });

    await expect(
      addTaskContribution(db, "task_1", {
        agentId: "agent_1",
        summary: "Tried to write after the lease expired.",
        evidenceLinks: [],
        artifactUrls: [],
      }),
    ).rejects.toThrow("Task lease expired");
    expect(db.taskContribution.create).not.toHaveBeenCalled();
  });

  it("submits work for review instead of marking it done", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue(ownedTask()),
        update: vi.fn().mockResolvedValue({ id: "task_1", status: "review" }),
      },
    });

    const result = await submitTask(db, "task_1", {
      agentId: "agent_1",
      summary: "Ready for review.",
      artifactUrls: [],
      evidenceLinks: [],
      resultType: "demo",
      definitionOfDoneMet: true,
      needsHumanDecision: false,
    });

    expect(result.task).toEqual({ id: "task_1", status: "review" });
    expect(db.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "review", leaseUntil: null }),
      }),
    );
  });

  it("approves a reviewed task into done", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue({
          id: "task_1",
          status: "review",
          ownerAgent: "agent_1",
        }),
        update: vi.fn().mockResolvedValue({ id: "task_1", status: "done" }),
      },
    });

    const result = await reviewTask(db, "task_1", {
      reviewer: "user",
      decision: "approve",
      comment: "Looks good.",
    });

    expect(result.task).toEqual({ id: "task_1", status: "done" });
    expect(db.taskReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ decision: "approve" }),
      }),
    );
  });
});
