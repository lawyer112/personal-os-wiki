#!/usr/bin/env node
/**
 * Backfill Personal OS MemoryItem embeddings from existing tasks, notes,
 * agentRuns, and activity episodes. Meant to be run offline for PoC evaluation.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createEmbeddingProviderFromEnv } from "../src/lib/embedding-providers.ts";

const globalForPrisma = globalThis;
const pgAdapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: pgAdapter,
    log: ["error"],
  });

const BATCH_SIZE = 5;

async function main() {
  const provider = createEmbeddingProviderFromEnv();
  console.log("provider:", provider.getProviderInfo());

  const tasks = await prisma.task.findMany({
    where: { status: { notIn: ["archived"] } },
    include: { project: true },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });
  console.log("tasks:", tasks.length);

  const notes = await prisma.note.findMany({
    include: { projects: { include: { project: true } } },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });
  console.log("notes:", notes.length);

  const activities = await prisma.activityLog.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
  });
  console.log("activities:", activities.length);

  const inputs = [];

  for (const task of tasks) {
    const body = [
      task.title,
      task.description ?? "",
      task.nextAction,
      task.definitionOfDone,
      task.requiredOutput ?? "",
      task.project?.name ?? "",
    ]
      .filter(Boolean)
      .join("\n");

    inputs.push({
      sourceType: "task",
      sourceId: task.id,
      title: task.title,
      body,
      projectId: task.projectId ?? undefined,
    });
  }

  for (const note of notes) {
    const body = [note.title, note.body, ...(note.tags ?? []), ...(note.concepts ?? [])]
      .filter(Boolean)
      .join("\n");
    const projectId = note.projects?.[0]?.projectId;
    inputs.push({
      sourceType: "wiki",
      sourceId: note.id,
      title: note.title,
      body,
      projectId,
    });
  }

  for (const act of activities) {
    const title = `${act.action} on ${act.targetType}`;
    const body = [
      act.action,
      act.targetType,
      act.targetId,
      act.actorType,
      act.actorId ?? "",
      JSON.stringify(act.after ?? {}),
    ]
      .filter(Boolean)
      .join("\n");
    inputs.push({
      sourceType: "activity",
      sourceId: act.id,
      title,
      body,
    });
  }

  let done = 0;
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const embeddings = await provider.batchEmbed(batch.map((x) => x.body));
    for (let j = 0; j < batch.length; j++) {
      const existing = await prisma.memoryItem.findFirst({
        where: { sourceType: batch[j].sourceType, sourceId: batch[j].sourceId },
      });
      const data = {
        ...batch[j],
        embedding: embeddings[j],
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      };
      if (existing) {
        await prisma.memoryItem.update({ where: { id: existing.id }, data });
      } else {
        await prisma.memoryItem.create({ data });
      }
      done += 1;
    }
    console.log(`embedded ${done}/${inputs.length}`);
  }

  console.log("done:", done);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
