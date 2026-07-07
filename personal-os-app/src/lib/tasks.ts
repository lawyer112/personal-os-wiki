import { recordActivity } from "@/lib/activity";
import { ingestTask } from "@/lib/memory-ingestion";
import type { TaskCreateInput, TaskUpdateInput } from "@/lib/validation";

type TaskCreateServiceInput = Omit<
  TaskCreateInput,
  "wikiLinks" | "riskLevel" | "executionMode" | "agentTags"
> &
  Partial<Pick<TaskCreateInput, "riskLevel" | "executionMode" | "agentTags">> & {
  wikiLinks?: TaskCreateInput["wikiLinks"];
};

type TaskDb = {
  task: unknown;
  activityLog: unknown;
};

const taskInclude = {
  project: true,
  sourceInboxItem: true,
  sourceAgentRun: true,
  wikiLinks: true,
  claims: { orderBy: { claimedAt: "desc" }, take: 3 },
  contributions: { orderBy: { createdAt: "desc" }, take: 5 },
  artifacts: { orderBy: { createdAt: "desc" }, take: 5 },
  reviews: { orderBy: { createdAt: "desc" }, take: 3 },
};

export async function listTasks<TDb extends TaskDb>(db: TDb) {
  const taskDelegate = db.task as { findMany(args: unknown): Promise<unknown[]> };
  return taskDelegate.findMany({
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    include: taskInclude,
  });
}

export async function createTask<TDb extends TaskDb>(
  db: TDb,
  input: TaskCreateServiceInput,
) {
  const { wikiLinks = [], ...taskInput } = input;
  const taskDelegate = db.task as {
    create(args: unknown): Promise<{ id: string; title: string; status: string }>;
  };
  const task = await taskDelegate.create({
    data: {
      ...taskInput,
      riskLevel: taskInput.riskLevel ?? "low",
      executionMode: taskInput.executionMode ?? "manual",
      agentTags: taskInput.agentTags ?? [],
      wikiLinks: {
        create: wikiLinks.map((link) => ({
          noteTitle: link.noteTitle,
          notePath: link.notePath,
          noteUrl: link.noteUrl,
          sourceType: link.sourceType,
          sourceInboxItemId: link.sourceInboxItemId ?? input.sourceInboxItemId,
          sourceAgentRunId: link.sourceAgentRunId ?? input.sourceAgentRunId,
        })),
      },
    },
    include: taskInclude,
  });

  await recordActivity(db, {
    actorType: input.createdBy === "user" ? "user" : "hermes",
    action: "task.created",
    targetType: "task",
    targetId: task.id,
    after: {
      title: task.title,
      status: task.status,
      sourceInboxItemId: input.sourceInboxItemId ?? null,
      sourceAgentRunId: input.sourceAgentRunId ?? null,
    },
    undoPayload: { action: "task.archive", id: task.id },
  });

  // Fire-and-forget: ingest new task into vector memory for hybrid recall.
  ingestTask({
    id: task.id,
    title: input.title,
    description: input.description ?? null,
    nextAction: input.nextAction ?? null,
    definitionOfDone: input.definitionOfDone ?? null,
    projectId: input.projectId ?? null,
  });

  return task;
}

export async function updateTask<TDb extends TaskDb>(
  db: TDb,
  id: string,
  input: TaskUpdateInput,
) {
  const { wikiLinks: _wikiLinks, ...taskInput } = input;
  void _wikiLinks;
  const taskDelegate = db.task as {
    findUnique(args: unknown): Promise<unknown | null>;
    update(args: unknown): Promise<{ id: string; title: string; status: string }>;
  };
  const before = await taskDelegate.findUnique({ where: { id } });
  const data = {
    ...taskInput,
    ...(taskInput.status === "done"
      ? { completedAt: new Date() }
      : taskInput.status
        ? { completedAt: null }
        : {}),
  };
  const task = await taskDelegate.update({
    where: { id },
    data,
    include: taskInclude,
  });

  await recordActivity(db, {
    actorType: "user",
    action: "task.updated",
    targetType: "task",
    targetId: id,
    before: before as Record<string, unknown> | null,
    after: data,
  });

  return task;
}

export async function completeTask<TDb extends TaskDb>(db: TDb, id: string) {
  const taskDelegate = db.task as {
    findUnique(args: unknown): Promise<unknown | null>;
    update(args: unknown): Promise<{
      id: string;
      title: string;
      status: string;
      completedAt?: Date | null;
    }>;
  };
  const before = await taskDelegate.findUnique({ where: { id } });
  const task = await taskDelegate.update({
    where: { id },
    data: {
      status: "done",
      completedAt: new Date(),
    },
    include: taskInclude,
  });

  await recordActivity(db, {
    actorType: "user",
    action: "task.completed",
    targetType: "task",
    targetId: id,
    before: before as Record<string, unknown> | null,
    after: { status: "done", completedAt: task.completedAt ?? null },
  });

  return task;
}
