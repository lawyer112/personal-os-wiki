import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { batchUpsertMemoryItems, type MemoryItemInput } from "@/lib/memory-vector-store";

/**
 * POST /api/agent/memory/backfill
 *
 * Seeds MemoryItem table with embeddings from recent tasks, wiki notes, and
 * activities so that /api/agent/context vector recall returns results.
 *
 * Query params:
 *   limit  - max records per type (default 50)
 *   types  - comma-separated: task,wiki,activity (default all)
 *   dryRun - if "true", return counts without writing
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const typesParam = searchParams.get("types") ?? "task,wiki,activity";
  const types = new Set(typesParam.split(",").map((t) => t.trim()));
  const dryRun = searchParams.get("dryRun") === "true";

  const inputs: MemoryItemInput[] = [];
  const stats: Record<string, number> = {};

  if (types.has("task")) {
    const tasks = await prisma.task.findMany({
      where: { status: { not: "archived" } },
      include: { project: true },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: limit,
    });

    for (const t of tasks) {
      const body = [
        t.title,
        t.description ?? "",
        t.nextAction,
        t.definitionOfDone,
        t.requiredOutput ?? "",
        t.project?.name ?? "",
        t.project?.goal ?? "",
      ]
        .filter(Boolean)
        .join("\n");

      inputs.push({
        sourceType: "task",
        sourceId: t.id,
        title: t.title,
        body,
        projectId: t.projectId ?? undefined,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }
    stats.tasks = tasks.length;
  }

  if (types.has("wiki")) {
    const notes = await prisma.note.findMany({
      include: { projects: { include: { project: true } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    for (const n of notes) {
      const body = [
        n.title,
        n.body ?? "",
        ...(n.tags ?? []),
        ...(n.concepts ?? []),
      ]
        .filter(Boolean)
        .join("\n");

      const projectId = n.projects?.[0]?.projectId ?? undefined;
      inputs.push({
        sourceType: "wiki",
        sourceId: n.id,
        title: n.title,
        body,
        projectId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }
    stats.notes = notes.length;
  }

  if (types.has("activity")) {
    const activities = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    for (const a of activities) {
      const body = [
        a.action,
        a.targetType,
        a.targetId,
        a.actorType,
        a.actorId ?? "",
      ]
        .filter(Boolean)
        .join("\n");

      inputs.push({
        sourceType: "activity",
        sourceId: a.id,
        title: `${a.action} on ${a.targetType}`,
        body,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
    }
    stats.activities = activities.length;
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      totalInputs: inputs.length,
      stats,
    });
  }

  await batchUpsertMemoryItems(inputs);

  const totalVectors = await prisma.memoryItem.count();

  return NextResponse.json({
    ok: true,
    upserted: inputs.length,
    totalVectors,
    stats,
  });
}

/**
 * GET /api/agent/memory/backfill
 * Returns current MemoryItem count and freshness info without writing.
 */
export async function GET() {
  const total = await prisma.memoryItem.count();
  const byType = await prisma.memoryItem.groupBy({
    by: ["sourceType"],
    _count: { id: true },
  });

  const newest = await prisma.memoryItem.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return NextResponse.json({
    ok: true,
    total,
    byType: Object.fromEntries(byType.map((r) => [r.sourceType, r._count.id])),
    newestAt: newest?.createdAt ?? null,
  });
}
