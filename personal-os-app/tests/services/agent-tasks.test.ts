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
  const defaults = {
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
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    taskRun: {
      findFirst: vi.fn().mockResolvedValue({ id: "run_1", taskId: "task_1" }),
      create: vi.fn().mockResolvedValue({ id: "run_1", taskId: "task_1" }),
      update: vi.fn().mockResolvedValue({ id: "run_1", taskId: "task_1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    agentActionLog: {
      create: vi.fn().mockResolvedValue({ id: "action_1" }),
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
  };

  return {
    ...defaults,
    ...overrides,
    task: {
      ...defaults.task,
      ...((overrides.task as Record<string, unknown> | undefined) ?? {}),
    },
    agentProfile: {
      ...defaults.agentProfile,
      ...((overrides.agentProfile as Record<string, unknown> | undefined) ??
        {}),
    },
    taskRun: {
      ...defaults.taskRun,
      ...((overrides.taskRun as Record<string, unknown> | undefined) ?? {}),
    },
    agentActionLog: {
      ...defaults.agentActionLog,
      ...((overrides.agentActionLog as Record<string, unknown> | undefined) ??
        {}),
    },
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

  it("keeps medium-risk owned work visible to high-capability agents", async () => {
    const db = createDb({
      agentProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "agent_1",
          tags: ["demo", "review"],
          allowedRiskLevel: "high",
          canWriteTasks: true,
          enabled: true,
        }),
      },
    });

    await listAgentInboxTasks(db, {
      agentId: "agent_1",
      tags: [],
      limit: 5,
    });

    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  ownerAgent: "agent_1",
                  riskLevel: { in: ["low", "medium"] },
                }),
              ]),
            }),
          ]),
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
    expect(db.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              executionMode: "agent_allowed",
              riskLevel: { in: ["low", "medium"] },
              OR: expect.arrayContaining([
                { agentTags: { hasSome: ["demo", "review"] } },
                { agentTags: { isEmpty: true } },
              ]),
            }),
          ]),
        }),
      }),
    );
    expect(db.taskClaim.create).toHaveBeenCalled();
    expect(db.taskRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: "task_1",
          agentId: "agent_1",
          status: "running",
          policySnapshot: expect.objectContaining({
            task: expect.objectContaining({ executionMode: "agent_allowed" }),
          }),
        }),
      }),
    );
    expect(db.agentActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "task.claimed",
          taskRunId: "run_1",
        }),
      }),
    );
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
    ).rejects.toThrow("agent work requires agent_allowed");
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

    expect(db.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerAgent: "agent_1" }),
      }),
    );
    expect(db.taskRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({ lastHeartbeatAt: expect.any(Date) }),
      }),
    );
    expect(db.agentActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "task.heartbeat" }),
      }),
    );
  });

  it("allows a high-capability profile to heartbeat a medium-risk task", async () => {
    const db = createDb({
      agentProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "agent_1",
          tags: ["demo", "review"],
          allowedRiskLevel: "high",
          canWriteTasks: true,
          enabled: true,
        }),
      },
      task: {
        findUnique: vi
          .fn()
          .mockResolvedValue(ownedTask({ riskLevel: "medium" })),
      },
    });

    await heartbeatTask(db, "task_1", {
      agentId: "agent_1",
      leaseMinutes: 30,
    });

    expect(db.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          riskLevel: { in: ["low", "medium"] },
        }),
      }),
    );
  });

  it("rejects heartbeats if task policy changed after claim", async () => {
    const db = createDb({
      task: {
        findUnique: vi
          .fn()
          .mockResolvedValue(ownedTask({ executionMode: "approval_required" })),
        update: vi.fn(),
      },
    });

    await expect(
      heartbeatTask(db, "task_1", {
        agentId: "agent_1",
        leaseMinutes: 30,
      }),
    ).rejects.toThrow("agent work requires agent_allowed");
    expect(db.task.update).not.toHaveBeenCalled();
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
    expect(db.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "task_1",
          ownerAgent: "agent_1",
        }),
      }),
    );
    expect(db.taskContribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ taskRunId: "run_1" }),
      }),
    );
    expect(db.taskArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: "https://example.com/artifact",
        }),
      }),
    );
    expect(db.agentActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "task.contribution.created",
          taskRunId: "run_1",
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

  it("rejects contributions if the agent profile is disabled after claim", async () => {
    const db = createDb({
      agentProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "agent_1",
          tags: ["demo", "review"],
          allowedRiskLevel: "medium",
          canWriteTasks: true,
          enabled: false,
        }),
      },
      task: {
        findUnique: vi.fn().mockResolvedValue(ownedTask()),
      },
    });

    await expect(
      addTaskContribution(db, "task_1", {
        agentId: "agent_1",
        summary: "Tried to write after profile disable.",
        evidenceLinks: [],
        artifactUrls: [],
      }),
    ).rejects.toThrow("Agent profile is missing or disabled");
    expect(db.taskContribution.create).not.toHaveBeenCalled();
  });

  it("rejects contributions when the conditional mutation lock loses", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue(ownedTask()),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    await expect(
      addTaskContribution(db, "task_1", {
        agentId: "agent_1",
        summary: "Race against policy change.",
        evidenceLinks: [],
        artifactUrls: [],
      }),
    ).rejects.toThrow("Policy or lease changed before mutation completed");
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
        data: expect.objectContaining({
          status: "review",
          ownerAgent: null,
          leaseUntil: null,
        }),
      }),
    );
    expect(db.taskRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({
          status: "submitted",
          resultSummary: "Ready for review.",
        }),
      }),
    );
    expect(db.taskClaim.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          taskId: "task_1",
          agentId: "agent_1",
          releasedAt: null,
        },
        data: expect.objectContaining({
          releaseReason: "submitted_for_review",
        }),
      }),
    );
    expect(db.agentActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "task.submitted" }),
      }),
    );
  });

  it("rejects reviews before a task is submitted", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue(claimableTask({ status: "todo" })),
        update: vi.fn(),
      },
    });

    await expect(
      reviewTask(db, "task_1", {
        reviewer: "user",
        decision: "approve",
      }),
    ).rejects.toThrow("Only submitted review tasks can be reviewed");
    expect(db.taskReview.create).not.toHaveBeenCalled();
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("rejects intake review tasks that have not been submitted", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue({
          id: "task_1",
          status: "review",
          submittedAt: null,
        }),
        update: vi.fn(),
      },
    });

    await expect(
      reviewTask(db, "task_1", {
        reviewer: "user",
        decision: "approve",
      }),
    ).rejects.toThrow("Only submitted review tasks can be reviewed");
    expect(db.taskReview.create).not.toHaveBeenCalled();
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("approves a reviewed task into done", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue({
          id: "task_1",
          status: "review",
          ownerAgent: "agent_1",
          submittedAt: new Date(),
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
    expect(db.taskRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId: "task_1", status: "submitted" },
        data: { status: "approved" },
      }),
    );
  });

  it("rejects reviewed work back to todo instead of archiving it", async () => {
    const db = createDb({
      task: {
        findUnique: vi.fn().mockResolvedValue({
          id: "task_1",
          status: "review",
          ownerAgent: "agent_1",
          submittedAt: new Date(),
        }),
        update: vi.fn().mockResolvedValue({ id: "task_1", status: "todo" }),
      },
    });

    const result = await reviewTask(db, "task_1", {
      reviewer: "user",
      decision: "reject",
      comment: "Evidence does not satisfy the definition of done.",
    });

    expect(result.task).toEqual({ id: "task_1", status: "todo" });
    expect(db.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "todo",
          submittedAt: null,
          ownerAgent: null,
        }),
      }),
    );
  });
});
