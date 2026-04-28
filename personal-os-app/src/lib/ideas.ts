import { recordActivity } from "@/lib/activity";
import { HttpError } from "@/lib/http";
import { createTask } from "@/lib/tasks";
import type {
  IdeaCreateInput,
  IdeaPromoteInput,
  IdeaUpdateInput,
} from "@/lib/validation";

type IdeaDb = {
  idea: unknown;
  task: unknown;
  activityLog: unknown;
};

const ideaInclude = {
  project: true,
  sourceInboxItem: true,
  sourceAgentRun: true,
  promotedTask: true,
};

export async function listIdeas<TDb extends IdeaDb>(db: TDb) {
  const idea = db.idea as { findMany(args: unknown): Promise<unknown[]> };
  return idea.findMany({
    where: { status: { not: "archived" } },
    include: ideaInclude,
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    take: 120,
  });
}

export async function createIdea<TDb extends IdeaDb>(
  db: TDb,
  input: IdeaCreateInput,
) {
  const ideaDelegate = db.idea as {
    create(args: unknown): Promise<{ id: string; title: string; status: string }>;
  };
  const idea = await ideaDelegate.create({
    data: input,
    include: ideaInclude,
  });

  await recordActivity(db, {
    actorType: "hermes",
    action: "idea.created",
    targetType: "idea",
    targetId: idea.id,
    after: {
      title: idea.title,
      status: idea.status,
      projectId: input.projectId ?? null,
      sourceInboxItemId: input.sourceInboxItemId ?? null,
      sourceAgentRunId: input.sourceAgentRunId ?? null,
    },
  });

  return idea;
}

export async function updateIdea<TDb extends IdeaDb>(
  db: TDb,
  id: string,
  input: IdeaUpdateInput,
) {
  const ideaDelegate = db.idea as {
    findUnique(args: unknown): Promise<unknown | null>;
    update(args: unknown): Promise<{ id: string; title: string; status: string }>;
  };
  const before = await ideaDelegate.findUnique({ where: { id } });
  const idea = await ideaDelegate.update({
    where: { id },
    data: input,
    include: ideaInclude,
  });

  await recordActivity(db, {
    actorType: "user",
    action: "idea.updated",
    targetType: "idea",
    targetId: id,
    before: before as Record<string, unknown> | null,
    after: input,
  });

  return idea;
}

export async function promoteIdea<TDb extends IdeaDb>(
  db: TDb,
  id: string,
  input: IdeaPromoteInput,
) {
  const ideaDelegate = db.idea as {
    findUnique(args: unknown): Promise<{
      id: string;
      title: string;
      body: string;
      priority: "P0" | "P1" | "P2" | "P3";
      nextAction?: string | null;
      projectId?: string | null;
      sourceInboxItemId?: string | null;
      sourceAgentRunId?: string | null;
    } | null>;
    update(args: unknown): Promise<unknown>;
  };
  const idea = await ideaDelegate.findUnique({ where: { id } });
  if (!idea) {
    throw new HttpError(404, "Idea not found");
  }

  const task = await createTask(db, {
    title: input.title ?? idea.title,
    description: idea.body,
    status: "review",
    priority: input.priority ?? idea.priority,
    nextAction: input.nextAction ?? idea.nextAction ?? "把这个想法改写成一个今天可以推进的动作。",
    definitionOfDone:
      input.definitionOfDone ?? "这个想法已经变成可判断完成的任务，或明确被放回以后再看。",
    projectId: idea.projectId ?? undefined,
    sourceInboxItemId: idea.sourceInboxItemId ?? undefined,
    sourceAgentRunId: idea.sourceAgentRunId ?? undefined,
    createdBy: "hermes",
  });

  await ideaDelegate.update({
    where: { id },
    data: { status: "promoted", promotedTaskId: task.id },
  });

  await recordActivity(db, {
    actorType: "user",
    action: "idea.promoted",
    targetType: "idea",
    targetId: id,
    after: { taskId: task.id },
  });

  return { ideaId: id, task };
}
