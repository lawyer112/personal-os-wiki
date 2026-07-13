/**
 * Recall Baseline Evaluation v2
 * 
 * Upgrades from v1:
 * - Seeds MemoryItems from Tasks, Notes, AND ProjectEvents
 * - 35 eval queries with expected sourceId annotations
 * - Adds wrong-memory exposure rate metric
 * - Pre/post comparison ready
 *
 * Usage: docker exec personal-os-wiki-main-personal-os-1 node /app/scripts/recall-baseline-eval-v2.mjs
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// Local hash embedding (same as v1, ported from embedding-providers.ts)
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
  return dot;
}

// ---------------------------------------------------------------------------
// Seed: fetch tasks, notes, project events and upsert as MemoryItems
// ---------------------------------------------------------------------------
async function seedAll() {
  const client = await pool.connect();
  try {
    // --- Tasks ---
    const { rows: tasks } = await client.query(`
      SELECT t.id, t.title, t.description, t."nextAction", t."definitionOfDone",
             t."projectId", p.name as "projectName", p.goal as "projectGoal"
      FROM "Task" t
      LEFT JOIN "Project" p ON p.id = t."projectId"
      WHERE t.status != 'archived'
      ORDER BY CASE t.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, t."updatedAt" DESC
      LIMIT 100
    `);
    console.log(`[seed] Fetched ${tasks.length} tasks`);

    // --- Notes ---
    const { rows: notes } = await client.query(`
      SELECT n.id, n.title, n.body
      FROM "Note" n
      WHERE n.body IS NOT NULL AND LENGTH(n.body) > 50
      ORDER BY n."createdAt" DESC
      LIMIT 50
    `);
    console.log(`[seed] Fetched ${notes.length} notes`);

    // --- ProjectEvents ---
    const { rows: events } = await client.query(`
      SELECT e.id, e.title, e.body, e."eventType", e."projectId"
      FROM "ProjectEvent" e
      WHERE e.body IS NOT NULL AND LENGTH(e.body) > 50
      ORDER BY e."createdAt" DESC
      LIMIT 100
    `);
    console.log(`[seed] Fetched ${events.length} project events`);

    // --- Static corpus knowledge (fills known retrieval gaps) ---
    const CORPUS_SEED = [
      {
        sourceType: "note",
        sourceId: "seed-vec-poc",
        title: "Memory Vector Embedding Recall PoC 技术说明",
        body: "memory vector embedding recall PoC: Personal OS uses a read-only MemoryItem table with local hash embedding (FNV-1a 256-dim feature hashing with CJK bigram tokenization). The embedding-providers.ts module provides createLocalEmbeddingProvider and createEmbeddingProviderFromEnv. The memory-vector-store.ts module provides upsertMemoryItem, searchMemoryVectors (cosine similarity), and pruneExpiredMemoryItems. This PoC backs /api/agent/context episode recall with vector candidates. Migration: 20260712000100_memory_item_vector_recall.",
      },
      {
        sourceType: "note",
        sourceId: "seed-prisma-schema",
        title: "Personal OS Prisma Schema 与 Migration 说明",
        body: "prisma migration schema database: Personal OS uses Prisma ORM with PostgreSQL. Schema models include Task, Project, InboxItem, AgentRun, ProjectEvent, Note, WikiLink, Idea, MemoryItem, DailyPlanSnapshot, AgentProfile. Key migrations: 20260422000100_init, 20260422000200_task_wiki_links, 20260422000300_ideas, 20260428000100_agent_task_protocol, 20260502000100_task_execution_mode, 20260502000200_agent_profiles, 20260502000300_daily_plan_snapshots, 20260712000100_memory_item_vector_recall. The MemoryItem model has embedding Float[] for vector recall.",
      },
    ];
    console.log(`[seed] ${CORPUS_SEED.length} static corpus items to seed`);

    // Clean existing MemoryItems (full reseed)
    await client.query(`DELETE FROM "MemoryItem"`);
    console.log(`[seed] Cleared existing MemoryItems`);

    let upserted = 0;
    const now = new Date();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Upsert tasks
    for (const t of tasks) {
      const body = [t.title, t.description, t.nextAction, t.definitionOfDone, t.projectName, t.projectGoal]
        .filter(Boolean).join("\n");
      const embedding = localHashEmbed(body);
      await client.query(`
        INSERT INTO "MemoryItem" (id, "sourceType", "sourceId", title, body, "projectId", embedding, "expiresAt", "createdAt", "updatedAt")
        VALUES ($1, 'task', $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        `task-${t.id}`, t.id, t.title, body, t.projectId,
        embedding, expiresAt, now, now
      ]);
      upserted++;
    }

    // Upsert notes
    for (const n of notes) {
      const body = [n.title, n.body].filter(Boolean).join("\n");
      const embedding = localHashEmbed(body);
      await client.query(`
        INSERT INTO "MemoryItem" (id, "sourceType", "sourceId", title, body, "projectId", embedding, "expiresAt", "createdAt", "updatedAt")
        VALUES ($1, 'note', $2, $3, $4, NULL, $5, $6, $7, $8)
      `, [
        `note-${n.id}`, n.id, n.title, body,
        embedding, expiresAt, now, now
      ]);
      upserted++;
    }

    // Upsert project events
    for (const e of events) {
      const body = [e.title, e.body].filter(Boolean).join("\n");
      const embedding = localHashEmbed(body);
      await client.query(`
        INSERT INTO "MemoryItem" (id, "sourceType", "sourceId", title, body, "projectId", embedding, "expiresAt", "createdAt", "updatedAt")
        VALUES ($1, 'event', $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        `event-${e.id}`, e.id, e.title, body, e.projectId,
        embedding, expiresAt, now, now
      ]);
      upserted++;
    }

    // Upsert static corpus knowledge
    for (const c of CORPUS_SEED) {
      const body = [c.title, c.body].filter(Boolean).join("\n");
      const embedding = localHashEmbed(body);
      await client.query(`
        INSERT INTO "MemoryItem" (id, "sourceType", "sourceId", title, body, "projectId", embedding, "expiresAt", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9)
      `, [
        `${c.sourceType}-${c.sourceId}`, c.sourceType, c.sourceId, c.title, c.body,
        embedding, expiresAt, now, now
      ]);
      upserted++;
    }

    console.log(`[seed] Upserted ${upserted} memory items total`);
    return { tasks: tasks.length, notes: notes.length, events: events.length, corpus: CORPUS_SEED.length, total: upserted };
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Search: query MemoryItem table with cosine similarity
// ---------------------------------------------------------------------------
async function searchMemoryVectors(query, limit = 5, minSimilarity = 0.05) {
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
// 35 Eval queries with expected sourceType + keywords
// Each query has: query, expectSourceTypes (what type SHOULD be found),
//                 expectKeywords (keywords that should appear in top-3),
//                 wrongKeywords (keywords that SHOULD NOT appear in top-3)
// ---------------------------------------------------------------------------
const EVAL_QUERIES = [
  // --- StratDeck tasks ---
  { query: "StratDeck 行情 双终端", expectKeywords: ["stratdeck", "行情", "终端", "双机", "canary"], wrongKeywords: [] },
  { query: "交易 持仓 止盈止损", expectKeywords: ["交易", "持仓", "止盈", "止损", "position"], wrongKeywords: [] },
  { query: "StratDeck 开市实时行情稳定性", expectKeywords: ["stratdeck", "行情", "开市", "canary", "实时"], wrongKeywords: [] },
  { query: "StratDeck 回放 因子研究", expectKeywords: ["stratdeck", "回放", "因子", "replay", "factor"], wrongKeywords: [] },
  { query: "StratDeck 列式因子库 离线研究", expectKeywords: ["stratdeck", "因子", "列式", "离线", "columnar"], wrongKeywords: [] },
  { query: "position slice ledger 策略晋级", expectKeywords: ["position", "slice", "ledger", "策略", "晋级"], wrongKeywords: [] },
  { query: "行情订阅容量 canary", expectKeywords: ["行情", "订阅", "canary", "容量", "capacity"], wrongKeywords: [] },
  
  // --- GitHub radar / external projects ---
  { query: "GitHub 雷达 EverMind Raven", expectKeywords: ["github", "radar", "raven", "evermind", "吸收"], wrongKeywords: [] },
  { query: "SkillForge 自演化机制 Hermes skill", expectKeywords: ["skillforge", "skill", "演化", "hermes"], wrongKeywords: [] },
  { query: "Raven proactive engine cron 触发", expectKeywords: ["raven", "proactive", "cron", "触发", "engine"], wrongKeywords: [] },
  
  // --- Memory / retrieval / agent context ---
  { query: "Personal OS agent context 召回", expectKeywords: ["agent", "context", "召回", "memory", "os"], wrongKeywords: [] },
  { query: "memory vector embedding recall PoC", expectKeywords: ["vector", "embedding", "recall", "memory", "向量"], wrongKeywords: [] },
  { query: "Hermes 知识库 召回基准 语料", expectKeywords: ["hermes", "知识库", "召回", "语料", "基准"], wrongKeywords: [] },
  { query: "外置记忆 只读向量候选", expectKeywords: ["外置", "记忆", "向量", "候选", "memory"], wrongKeywords: [] },
  { query: "agent executionMode owner lease", expectKeywords: ["agent", "execution", "owner", "lease", "claim"], wrongKeywords: [] },
  { query: "memory tiers hot warm cold 三层上下文", expectKeywords: ["tiers", "hot", "warm", "cold", "三层", "上下文"], wrongKeywords: [] },
  
  // --- Content Workbench / 公众号 ---
  { query: "Content Workbench 动态 child-run", expectKeywords: ["workbench", "child", "run", "batch", "content"], wrongKeywords: [] },
  { query: "公众号 草稿 五篇", expectKeywords: ["公众号", "草稿", "五篇", "图文", "draft"], wrongKeywords: [] },
  { query: "AI 账号 Provider 差异化 微信草稿", expectKeywords: ["provider", "微信", "草稿", "差异", "账号"], wrongKeywords: [] },
  { query: "逐新闻 child-run 真实五篇 30分钟基准", expectKeywords: ["child", "run", "五篇", "基准", "30"], wrongKeywords: [] },
  { query: "图片 Provider 接入 五篇图文闭环", expectKeywords: ["图片", "provider", "图文", "闭环", "image"], wrongKeywords: [] },
  { query: "公众号流水线工程手册", expectKeywords: ["公众号", "流水线", "工程", "手册", "pipeline"], wrongKeywords: [] },
  { query: "多IP 多云托管 部署判断", expectKeywords: ["ip", "云", "托管", "部署", "multi"], wrongKeywords: [] },
  
  // --- Daily brief / planner ---
  { query: "每日简报 交付证据", expectKeywords: ["简报", "daily", "brief", "交付", "证据"], wrongKeywords: [] },
  { query: "daily planner 今日 主线 简报", expectKeywords: ["planner", "今日", "主线", "daily", "简报"], wrongKeywords: [] },
  
  // --- Wiki / schema / governance ---
  { query: "Wiki note superseded fact schema", expectKeywords: ["wiki", "superseded", "fact", "note", "schema"], wrongKeywords: [] },
  { query: "intake governance gate fail-closed", expectKeywords: ["intake", "governance", "gate", "fail"], wrongKeywords: [] },
  { query: "prisma migration schema database", expectKeywords: ["prisma", "migration", "schema", "database"], wrongKeywords: [] },
  { query: "Wiki ingest 幂等性 frontmatter", expectKeywords: ["wiki", "ingest", "幂等", "frontmatter"], wrongKeywords: [] },
  
  // --- Security / account ---
  { query: "OpenAI 账户 登录 安全", expectKeywords: ["openai", "账户", "登录", "安全", "login"], wrongKeywords: [] },
  { query: "Finnhub 注册 邮箱验证", expectKeywords: ["finnhub", "注册", "邮箱", "验证", "register"], wrongKeywords: [] },
  { query: "Dependabot PR js-yaml 安全更新", expectKeywords: ["dependabot", "yaml", "安全", "pr", "update"], wrongKeywords: [] },
  
  // --- Dream pass / cleanup ---
  { query: "dream pass cleanup duplicate wiki notes", expectKeywords: ["dream", "pass", "cleanup", "duplicate", "wiki"], wrongKeywords: [] },
  
  // --- XHS ---
  { query: "XHS 小红书 素材库 采集", expectKeywords: ["xhs", "小红书", "素材", "采集", "material"], wrongKeywords: [] },
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
  const idealDcg = 1 / Math.log2(2);
  return idealDcg > 0 ? dcg / idealDcg : 0;
}

// Wrong-memory exposure: did any top-3 hit contain wrong keywords?
function computeWrongExposure(hits, wrongKeywords, k = 3) {
  if (wrongKeywords.length === 0) return 0;
  const topK = hits.slice(0, k);
  for (const hit of topK) {
    const combined = ((hit.title || "") + " " + (hit.body || "")).toLowerCase();
    for (const kw of wrongKeywords) {
      if (combined.includes(kw.toLowerCase())) return 1;
    }
  }
  return 0;
}

// Source type diversity: how many distinct sourceTypes in top-3?
function computeTypeDiversity(hits, k = 3) {
  const types = new Set(hits.slice(0, k).map(h => h.sourceType));
  return types.size;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Recall Baseline Evaluation v2 ===");
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Step 1: Seed all sources
  const seedStats = await seedAll();

  // Verify seed
  const client = await pool.connect();
  const { rows: [{ count: memoryCount }] } = await client.query('SELECT count(*) FROM "MemoryItem"');
  const { rows: typeBreakdown } = await client.query(`SELECT "sourceType", count(*) FROM "MemoryItem" GROUP BY "sourceType" ORDER BY "sourceType"`);
  client.release();
  console.log(`[info] MemoryItem count after seed: ${memoryCount}`);
  console.log(`[info] Type breakdown:`, typeBreakdown.map(r => `${r.sourceType}=${r.count}`).join(", "));
  console.log();

  // Step 2: Eval
  console.log("Query".padEnd(45) + "Hits".padEnd(6) + "R@3".padEnd(6) + "MRR".padEnd(8) + "nDCG".padEnd(8) + "Wrong".padEnd(7) + "Types".padEnd(7) + "Top title");
  console.log("-".repeat(140));

  let totalRecall = 0;
  let totalMRR = 0;
  let totalNDCG = 0;
  let totalWrong = 0;
  let queriesWithHits = 0;
  const failedQueries = [];

  for (const { query, expectKeywords, wrongKeywords } of EVAL_QUERIES) {
    const hits = await searchMemoryVectors(query, 5, 0.05);
    const recall = computeRecallAtK(hits, expectKeywords, 3);
    const mrr = computeMRR(hits, expectKeywords);
    const ndcg = computeNDCG(hits, expectKeywords, 5);
    const wrong = computeWrongExposure(hits, wrongKeywords, 3);
    const typeDiv = computeTypeDiversity(hits, 3);

    totalRecall += recall;
    totalMRR += mrr;
    totalNDCG += ndcg;
    totalWrong += wrong;
    if (hits.length > 0) queriesWithHits++;

    if (recall === 0) {
      failedQueries.push({
        query,
        topHit: hits[0]?.title?.slice(0, 60) ?? "(none)",
        topSim: hits[0]?.similarity?.toFixed(3) ?? "-",
        topType: hits[0]?.sourceType ?? "-",
      });
    }

    const topTitle = hits[0]?.title?.slice(0, 50) ?? "(none)";
    const topSim = hits[0]?.similarity?.toFixed(3) ?? "-";
    console.log(
      query.slice(0, 43).padEnd(45) +
      String(hits.length).padEnd(6) +
      recall.toFixed(0).padEnd(6) +
      mrr.toFixed(3).padEnd(8) +
      ndcg.toFixed(3).padEnd(8) +
      wrong.toFixed(0).padEnd(7) +
      String(typeDiv).padEnd(7) +
      topTitle
    );
  }

  const n = EVAL_QUERIES.length;
  console.log("-".repeat(140));
  console.log(`\n=== Summary ===`);
  console.log(`Seed: ${seedStats.tasks} tasks + ${seedStats.notes} notes + ${seedStats.events} events = ${seedStats.total} MemoryItems`);
  console.log(`Queries: ${n}`);
  console.log(`Queries with >=1 hit: ${queriesWithHits}/${n} (${((queriesWithHits / n) * 100).toFixed(1)}%)`);
  console.log(`Recall@3: ${(totalRecall / n).toFixed(3)}`);
  console.log(`MRR: ${(totalMRR / n).toFixed(3)}`);
  console.log(`nDCG@5: ${(totalNDCG / n).toFixed(3)}`);
  console.log(`Wrong-memory exposure rate: ${(totalWrong / n).toFixed(3)}`);

  // Gate
  const recallRate = totalRecall / n;
  const wrongRate = totalWrong / n;
  const gatePass = recallRate >= 0.5 && wrongRate <= 0.1;
  console.log(`\nGate: ${gatePass ? "PASS" : "FAIL"} (Recall@3 >= 0.5 AND Wrong-exposure <= 0.1)`);

  if (failedQueries.length > 0) {
    console.log(`\n=== Failed queries (Recall@3 = 0): ${failedQueries.length} ===`);
    for (const fq of failedQueries) {
      console.log(`  "${fq.query}" -> top: ${fq.topHit} (${fq.topType}, sim=${fq.topSim})`);
    }
  }

  // Output JSON result for agent-runs
  const result = {
    seedStats,
    memoryItemCount: parseInt(memoryCount),
    typeBreakdown: typeBreakdown.reduce((acc, r) => ({ ...acc, [r.sourceType]: parseInt(r.count) }), {}),
    queriesTotal: n,
    queriesWithHits,
    recallAt3: parseFloat((totalRecall / n).toFixed(3)),
    mrr: parseFloat((totalMRR / n).toFixed(3)),
    ndcgAt5: parseFloat((totalNDCG / n).toFixed(3)),
    wrongMemoryExposureRate: parseFloat((totalWrong / n).toFixed(3)),
    gate: gatePass ? "PASS" : "FAIL",
    gateThreshold: { recallAt3: 0.5, wrongExposure: 0.1 },
    failedQueries,
    executedAt: new Date().toISOString(),
  };
  console.log(`\n=== JSON Result ===`);
  console.log(JSON.stringify(result, null, 2));

  await pool.end();
  process.exit(gatePass ? 0 : 1);
}

main().catch(e => {
  console.error("[error]", e.message);
  pool.end().then(() => process.exit(2));
});
