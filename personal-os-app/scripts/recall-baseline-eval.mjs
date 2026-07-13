/**
 * Self-contained recall baseline seed + eval script.
 * Runs inside the personal-os container (has pg + DATABASE_URL).
 *
 * Usage: docker exec personal-os-wiki-main-personal-os-1 node /app/scripts/recall-baseline-eval.mjs
 *
 * Steps:
 * 1. Fetch 50 non-archived tasks from DB (title, description, nextAction, definitionOfDone, project)
 * 2. Compute local hash embeddings (256-dim, FNV-1a feature hashing)
 * 3. Upsert into MemoryItem table
 * 4. Run 8 eval queries with known expected hits
 * 5. Output Recall@3, MRR, nDCG
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// Local hash embedding (ported from embedding-providers.ts)
// ---------------------------------------------------------------------------
const DEFAULT_DIM = 256;

function hashString(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/u;

function tokenize(text) {
  const tokens = [];
  const runs = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const run of runs) {
    if (CJK_RE.test(run)) {
      const chars = Array.from(run);
      for (let i = 0; i < chars.length; i++) {
        tokens.push(chars[i]);
        if (i + 1 < chars.length) {
          tokens.push(chars[i] + chars[i + 1]);
        }
      }
    } else {
      tokens.push(run);
    }
  }
  return tokens;
}

function localHashEmbed(text, dim = DEFAULT_DIM) {
  const vec = new Array(dim).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;
  const counts = new Map();
  for (const tok of tokens) {
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }
  for (const [tok, count] of counts) {
    const h = hashString(tok);
    const idx = h % dim;
    const sign = (h >>> 31) & 1 ? -1 : 1;
    const weight = 1 + Math.log(count);
    vec[idx] += sign * weight;
  }
  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error(`dim mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // already normalized
}

// ---------------------------------------------------------------------------
// Seed: fetch tasks and upsert as MemoryItems
// ---------------------------------------------------------------------------
async function seedTasks() {
  const client = await pool.connect();
  try {
    const { rows: tasks } = await client.query(`
      SELECT t.id, t.title, t.description, t."nextAction", t."definitionOfDone",
             t."projectId", p.name as "projectName", p.goal as "projectGoal"
      FROM "Task" t
      LEFT JOIN "Project" p ON p.id = t."projectId"
      WHERE t.status != 'archived'
      ORDER BY CASE t.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, t."updatedAt" DESC
      LIMIT 80
    `);

    console.log(`[seed] Fetched ${tasks.length} tasks from DB`);

    let upserted = 0;
    for (const t of tasks) {
      const body = [t.title, t.description, t.nextAction, t.definitionOfDone, t.projectName, t.projectGoal]
        .filter(Boolean).join("\n");
      const embedding = localHashEmbed(body);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();

      // Use upsert via DELETE + INSERT (index on 6.37 is not UNIQUE)
      await client.query(`DELETE FROM "MemoryItem" WHERE "sourceType" = 'task' AND "sourceId" = $1`, [t.id]);
      await client.query(`
        INSERT INTO "MemoryItem" (id, "sourceType", "sourceId", title, body, "projectId", embedding, "expiresAt", "createdAt", "updatedAt")
        VALUES ($1, 'task', $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        `task-${t.id}`, t.id, t.title, body, t.projectId,
        embedding, expiresAt, now, now
      ]);
      upserted++;
    }
    console.log(`[seed] Upserted ${upserted} memory items`);
    return tasks;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Search: query MemoryItem table with cosine similarity
// ---------------------------------------------------------------------------
async function searchMemoryVectors(query, limit = 5, minSimilarity = 0.1) {
  const queryEmbedding = localHashEmbed(query);
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT id, "sourceType", "sourceId", title, body, "projectId", embedding, "createdAt"
      FROM "MemoryItem"
      WHERE "expiresAt" IS NULL OR "expiresAt" > NOW()
    `);

    const results = [];
    for (const row of rows) {
      if (!row.embedding || row.embedding.length === 0) continue;
      const sim = cosineSimilarity(queryEmbedding, row.embedding);
      if (sim >= minSimilarity) {
        results.push({
          id: row.id,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          title: row.title,
          body: row.body,
          projectId: row.projectId,
          similarity: sim,
          createdAt: row.createdAt,
        });
      }
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Eval queries with expected keywords in results
// ---------------------------------------------------------------------------
const EVAL_QUERIES = [
  { query: "StratDeck 行情 双终端", expectKeywords: ["stratdeck", "行情", "终端", "双机", "canary"] },
  { query: "GitHub 雷达 EverMind Raven", expectKeywords: ["github", "radar", "raven", "evermind", "吸收"] },
  { query: "Personal OS agent context 召回", expectKeywords: ["agent", "context", "召回", "memory", "os"] },
  { query: "每日简报 交付证据", expectKeywords: ["简报", "daily", "brief", "交付", "证据"] },
  { query: "Wiki note superseded fact", expectKeywords: ["wiki", "superseded", "fact", "note", "schema"] },
  { query: "memory vector embedding recall", expectKeywords: ["vector", "embedding", "recall", "memory", "memory item"] },
  { query: "Content Workbench 动态 child-run", expectKeywords: ["workbench", "child", "run", "batch", "content"] },
  { query: "Hermes 知识库 召回基准 语料", expectKeywords: ["hermes", "知识库", "召回", "语料", "基准"] },
  { query: "公众号 草稿 五篇", expectKeywords: ["公众号", "草稿", "五篇", "图文", "draft"] },
  { query: "intake governance gate fail-closed", expectKeywords: ["intake", "governance", "gate", "fail"] },
  { query: "prisma migration schema", expectKeywords: ["prisma", "migration", "schema", "database"] },
  { query: "交易 持仓 止盈止损", expectKeywords: ["交易", "持仓", "止盈", "止损", "position"] },
  { query: "agent executionMode owner lease", expectKeywords: ["agent", "execution", "owner", "lease", "claim"] },
  { query: "dream pass cleanup duplicate wiki", expectKeywords: ["dream", "pass", "cleanup", "duplicate", "wiki"] },
  { query: "OpenAI 账户 登录 安全", expectKeywords: ["openai", "账户", "登录", "安全", "login"] },
  { query: "Finnhub 注册 邮箱验证", expectKeywords: ["finnhub", "注册", "邮箱", "验证", "register"] },
  { query: "Dependabot PR js-yaml 安全更新", expectKeywords: ["dependabot", "yaml", "安全", "pr", "update"] },
  { query: "XHS 小红书 素材库 采集", expectKeywords: ["xhs", "小红书", "素材", "采集", "material"] },
  { query: "daily planner 今日 主线", expectKeywords: ["planner", "今日", "主线", "daily", "plan"] },
  { query: "task claim heartbeat lease release", expectKeywords: ["task", "claim", "heartbeat", "lease", "release"] },
];

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------
function computeRecallAtK(hits, expectedKeywords, k = 3) {
  const topK = hits.slice(0, k);
  for (const hit of topK) {
    const titleLower = (hit.title || "").toLowerCase();
    const bodyLower = (hit.body || "").toLowerCase();
    const combined = titleLower + " " + bodyLower;
    for (const kw of expectedKeywords) {
      if (combined.includes(kw.toLowerCase())) return 1;
    }
  }
  return 0;
}

function computeMRR(hits, expectedKeywords) {
  for (let i = 0; i < hits.length; i++) {
    const titleLower = (hits[i].title || "").toLowerCase();
    const bodyLower = (hits[i].body || "").toLowerCase();
    const combined = titleLower + " " + bodyLower;
    for (const kw of expectedKeywords) {
      if (combined.includes(kw.toLowerCase())) {
        return 1 / (i + 1);
      }
    }
  }
  return 0;
}

function computeNDCG(hits, expectedKeywords, k = 5) {
  const dcgParts = [];
  for (let i = 0; i < Math.min(hits.length, k); i++) {
    const titleLower = (hits[i].title || "").toLowerCase();
    const bodyLower = (hits[i].body || "").toLowerCase();
    const combined = titleLower + " " + bodyLower;
    let relevant = 0;
    for (const kw of expectedKeywords) {
      if (combined.includes(kw.toLowerCase())) relevant = 1;
    }
    dcgParts.push(relevant / Math.log2(i + 2));
  }
  const dcg = dcgParts.reduce((a, b) => a + b, 0);

  // Ideal: all relevant at top
  const idealDcg = 1 / Math.log2(2); // best case: 1 relevant at position 1
  return idealDcg > 0 ? dcg / idealDcg : 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Recall Baseline Evaluation ===");
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Step 1: Seed
  await seedTasks();

  // Verify seed
  const client = await pool.connect();
  const { rows: [{ count: memoryCount }] } = await client.query('SELECT count(*) FROM "MemoryItem"');
  client.release();
  console.log(`[info] MemoryItem count after seed: ${memoryCount}\n`);

  // Step 2: Eval
  console.log("Query".padEnd(45) + "Hits".padEnd(6) + "R@3".padEnd(6) + "MRR".padEnd(8) + "nDCG".padEnd(8) + "Top title");
  console.log("-".repeat(120));

  let totalRecall = 0;
  let totalMRR = 0;
  let totalNDCG = 0;
  let queriesWithHits = 0;

  for (const { query, expectKeywords } of EVAL_QUERIES) {
    const hits = await searchMemoryVectors(query, 5, 0.05);
    const recall = computeRecallAtK(hits, expectKeywords, 3);
    const mrr = computeMRR(hits, expectKeywords);
    const ndcg = computeNDCG(hits, expectKeywords, 5);

    totalRecall += recall;
    totalMRR += mrr;
    totalNDCG += ndcg;
    if (hits.length > 0) queriesWithHits++;

    const topTitle = hits[0]?.title?.slice(0, 50) ?? "(none)";
    const topSim = hits[0]?.similarity?.toFixed(3) ?? "-";
    console.log(
      query.slice(0, 43).padEnd(45) +
      String(hits.length).padEnd(6) +
      recall.toFixed(0).padEnd(6) +
      mrr.toFixed(3).padEnd(8) +
      ndcg.toFixed(3).padEnd(8) +
      topTitle
    );
  }

  const n = EVAL_QUERIES.length;
  console.log("-".repeat(120));
  console.log(`\n=== Summary ===`);
  console.log(`Queries: ${n}`);
  console.log(`Queries with >=1 hit: ${queriesWithHits}/${n} (${((queriesWithHits / n) * 100).toFixed(1)}%)`);
  console.log(`Recall@3: ${(totalRecall / n).toFixed(3)}`);
  console.log(`MRR: ${(totalMRR / n).toFixed(3)}`);
  console.log(`nDCG@5: ${(totalNDCG / n).toFixed(3)}`);

  // Gate
  const recallRate = totalRecall / n;
  if (recallRate >= 0.5) {
    console.log(`\n✅ PASS - Recall@3 >= 0.5`);
  } else {
    console.log(`\n❌ FAIL - Recall@3 < 0.5 (need more data or query tuning)`);
  }

  await pool.end();
  process.exit(recallRate >= 0.5 ? 0 : 1);
}

main().catch(e => {
  console.error("[error]", e.message);
  pool.end().then(() => process.exit(2));
});
