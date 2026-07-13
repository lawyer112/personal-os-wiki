#!/usr/bin/env node
/**
 * Offline evaluation for vector+episode hybrid recall PoC.
 *
 * Usage:
 *   npx tsx scripts/memory-vector-eval.mts [--seed] [--limit=50]
 *
 * --seed   : backfill recent tasks/activities as MemoryItems before evaluating
 * --limit  : max records to seed (default 50)
 *
 * Outputs a simple precision / recall table to stdout.
 */

import { prisma } from "../src/lib/db.js";
import {
  batchUpsertMemoryItems,
  searchMemoryVectors,
  type MemoryItemInput,
} from "../src/lib/memory-vector-store.js";

const args = process.argv.slice(2);
const shouldSeed = args.includes("--seed");
const limitArg = args.find((a) => a.startsWith("--limit="));
const SEED_LIMIT = limitArg ? Number(limitArg.split("=")[1]) : 50;

// ---------------------------------------------------------------------------
// Seed: fetch real tasks from Personal OS and push them as MemoryItems
// ---------------------------------------------------------------------------
async function seedTasksAsMemory() {
  console.log(`[seed] Fetching up to ${SEED_LIMIT} tasks from Personal OS…`);

  const tasks = await prisma.task.findMany({
    where: { status: { not: "archived" } },
    include: { project: true },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    take: SEED_LIMIT,
  });

  console.log(`[seed] Got ${tasks.length} tasks. Upserting memory items…`);

  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const inputs: MemoryItemInput[] = tasks.map((t) => ({
    sourceType: "task",
    sourceId: t.id,
    title: t.title,
    body: [
      t.title,
      t.description,
      t.nextAction,
      t.definitionOfDone,
      t.project?.name,
      t.project?.goal,
    ]
      .filter(Boolean)
      .join("\n"),
    projectId: t.projectId ?? undefined,
    expiresAt: expiry,
  }));

  await batchUpsertMemoryItems(inputs);
  console.log(`[seed] Done. Upserted ${inputs.length} memory items.`);
}

// ---------------------------------------------------------------------------
// Eval queries — covering key P0/P1 topics in Personal OS / Wiki upgrade
// ---------------------------------------------------------------------------
const EVAL_QUERIES = [
  "vector embedding recall agent context",
  "向量召回 episode",
  "memory item schema index",
  "agent context knowledge retrieval",
  "hybrid search PoC",
  "cosine similarity 知识库",
  "Personal OS task embedding",
  "SwarmVault MCP context",
];

// ---------------------------------------------------------------------------
// Run evaluation
// ---------------------------------------------------------------------------
async function runEval() {
  console.log("\n[eval] Running recall evaluation…");
  console.log(
    "Query".padEnd(45),
    "Hits".padEnd(6),
    "Top title".padEnd(50),
    "Top sim",
  );
  console.log("-".repeat(115));

  let totalHits = 0;
  let queriesWithHits = 0;

  for (const query of EVAL_QUERIES) {
    const hits = await searchMemoryVectors(query, {
      limit: 5,
      minSimilarity: 0.3,
    });

    if (hits.length > 0) {
      queriesWithHits++;
      totalHits += hits.length;
    }

    const topTitle = hits[0]?.title?.slice(0, 48) ?? "(none)";
    const topSim = hits[0]?.similarity?.toFixed(3) ?? "—";
    console.log(
      query.slice(0, 43).padEnd(45),
      String(hits.length).padEnd(6),
      topTitle.padEnd(50),
      topSim,
    );
  }

  const recallRate = ((queriesWithHits / EVAL_QUERIES.length) * 100).toFixed(
    1,
  );
  console.log("-".repeat(115));
  console.log(
    `\n[eval] Queries with ≥1 hit: ${queriesWithHits}/${EVAL_QUERIES.length} (recall rate: ${recallRate}%)`,
  );
  console.log(`[eval] Total hits across all queries: ${totalHits}`);

  // PoC gate: at least 50% recall rate
  if (Number(recallRate) >= 50) {
    console.log("[eval] ✅ PASS — recall ≥ 50%");
    return true;
  } else {
    console.log("[eval] ❌ FAIL — recall < 50% (need more seeded data or lower threshold)");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------
async function main() {
  try {
    if (shouldSeed) {
      await seedTasksAsMemory();
    } else {
      const count = await prisma.memoryItem.count();
      console.log(`[info] MemoryItem table has ${count} rows. Pass --seed to backfill.`);
    }

    const passed = await runEval();
    await prisma.$disconnect();
    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error("[error]", err);
    await prisma.$disconnect();
    process.exit(2);
  }
}

main();
