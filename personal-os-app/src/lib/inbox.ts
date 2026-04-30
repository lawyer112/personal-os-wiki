import { recordActivity } from "@/lib/activity";
import type {
  AgentRunCompleteInput,
  AgentRunCreateInput,
  InboxCreateInput,
} from "@/lib/validation";

type InboxDb = {
  inboxItem: unknown;
  agentRun: unknown;
  activityLog: unknown;
};

export async function createInboxItem<TDb extends InboxDb>(
  db: TDb,
  input: InboxCreateInput,
) {
  const inboxItem = db.inboxItem as {
    create(args: unknown): Promise<{ id: string; rawText: string }>;
  };

  const item = await inboxItem.create({
    data: {
      ...input,
      attachments: input.attachments,
      status: "new",
    },
  });

  await recordActivity(db, {
    actorType: activityActorType(input.createdBy),
    action: "inbox.created",
    targetType: "inboxItem",
    targetId: item.id,
    after: {
      sourceType: input.sourceType,
      sourcePlatform: input.sourcePlatform,
      rawTextLength: input.rawText.length,
    },
  });

  return item;
}

function activityActorType(createdBy: string) {
  if (
    createdBy === "user" ||
    createdBy === "hermes" ||
    createdBy === "codex" ||
    createdBy === "system"
  ) {
    return createdBy;
  }
  return "hermes";
}

export async function startAgentRun<TDb extends InboxDb>(
  db: TDb,
  input: AgentRunCreateInput,
) {
  const agentRun = db.agentRun as {
    create(args: unknown): Promise<{ id: string }>;
  };
  const inboxItem = db.inboxItem as {
    update(args: unknown): Promise<unknown>;
  };

  const run = await agentRun.create({
    data: input,
  });

  await inboxItem.update({
    where: { id: input.inboxItemId },
    data: { status: "processing" },
  });

  await recordActivity(db, {
    actorType: "hermes",
    action: "agentRun.started",
    targetType: "agentRun",
    targetId: run.id,
    after: {
      inboxItemId: input.inboxItemId,
      model: input.model,
      classification: input.classification ?? null,
    },
  });

  return run;
}

export async function completeAgentRun<TDb extends InboxDb>(
  db: TDb,
  id: string,
  input: AgentRunCompleteInput,
) {
  const agentRun = db.agentRun as {
    update(args: unknown): Promise<{ id: string; inboxItemId?: string }>;
  };
  const inboxItem = db.inboxItem as {
    update(args: unknown): Promise<unknown>;
  };
  const status = input.error ? "failed" : "completed";
  const run = await agentRun.update({
    where: { id },
    data: {
      ...input,
      status,
      completedAt: new Date(),
    },
  });

  if (run.inboxItemId) {
    await inboxItem.update({
      where: { id: run.inboxItemId },
      data: { status: input.error ? "failed" : "processed" },
    });
  }

  await recordActivity(db, {
    actorType: "hermes",
    action: `agentRun.${status}`,
    targetType: "agentRun",
    targetId: id,
    after: input,
  });

  return run;
}
