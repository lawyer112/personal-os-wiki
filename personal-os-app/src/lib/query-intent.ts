/**
 * Query intent for memory recall ranking.
 * Keep rules explicit and small — no ML in the hot path.
 */

export type QueryIntent =
  | "deploy_sop"
  | "review_protocol"
  | "concept"
  | "ops"
  | "fact"
  | "noise"
  | "general";

const DEPLOY_RE =
  /部署|安装|deploy|installation|docker\s*compose|compose|启动服务|运维手册|runbook|how\s*to\s*(run|install|setup)|如何部署|怎么部署|怎么装/i;
const REVIEW_PROTOCOL_RE =
  /任务复核|复核协议|task\s*review|认领|claim|heartbeat|definitionOfDone|验收标准|submit.*review|reviewer/i;
const REVIEW_WORD_RE = /\breview\b|复核/i;
const TASK_CONTEXT_RE = /任务|task|agent|personal\s*os|认领|claim/i;
const OPS_RE =
  /token|env|环境变量|端口|port|3422|3100|api[_-]?token|WIKI_|PERSONAL_OS_|鉴权|read_token/i;
const CONCEPT_RE =
  /是什么|为什么|概念|架构|边界|记忆|检索|召回|原理|对比|区别|长期记忆|知识库/i;
const NOISE_RE =
  /今天天气|天气怎么样|完全不存在的专有名词|xyzqwerty/i;

export function detectQueryIntent(query: string): QueryIntent {
  const q = query.trim();
  if (!q) {
    return "general";
  }
  if (NOISE_RE.test(q)) {
    return "noise";
  }
  if (DEPLOY_RE.test(q)) {
    return "deploy_sop";
  }
  if (REVIEW_PROTOCOL_RE.test(q)) {
    return "review_protocol";
  }
  if (REVIEW_WORD_RE.test(q) && TASK_CONTEXT_RE.test(q)) {
    return "review_protocol";
  }
  // Bare "review" often means OS task review in this product, not PR review.
  if (/^任务复核(\s*review)?$/i.test(q) || /^review$/i.test(q.trim())) {
    return "review_protocol";
  }
  if (OPS_RE.test(q)) {
    return "ops";
  }
  if (CONCEPT_RE.test(q)) {
    return "concept";
  }
  return "fact";
}

/** Field text used for intent boosts (title/path/tags/excerpt). */
export function intentRankBoost(
  intent: QueryIntent,
  fields: {
    title?: string;
    path?: string;
    tags?: string[];
    concepts?: string[];
    excerpt?: string;
  },
): number {
  const title = (fields.title ?? "").toLowerCase();
  const path = (fields.path ?? "").toLowerCase();
  const tags = (fields.tags ?? []).join(" ").toLowerCase();
  const concepts = (fields.concepts ?? []).join(" ").toLowerCase();
  const excerpt = (fields.excerpt ?? "").toLowerCase();
  const hay = `${title}\n${path}\n${tags}\n${concepts}\n${excerpt}`;

  let boost = 0;

  if (intent === "deploy_sop") {
    if (/deploy|部署|install|安装|docker|compose|runbook|手册|sop|ops|启动|安装指南/.test(hay)) {
      boost += 36;
    }
    if (/how\s*to|步骤|checklist|验收/.test(hay)) {
      boost += 12;
    }
    // Positioning / identity notes are common false tops for deploy questions.
    if (
      /定位|调度层|连接 personal|外部输入/.test(hay) &&
      !/部署|deploy|install|docker|compose|安装/.test(hay)
    ) {
      boost -= 28;
    }
  }

  if (intent === "review_protocol") {
    if (
      /personal\s*os|task\s*review|任务复核|claim|认领|heartbeat|submit|reviewer|验收|agent.?protocol|任务协议/.test(
        hay,
      )
    ) {
      boost += 40;
    }
    if (/gb\/t|国标|pull\s*request|pr\s*review|kubernetes|react\s*pr|代码评审|peer\s*review/.test(hay)) {
      boost -= 35;
    }
  }

  if (intent === "ops") {
    if (/token|env|环境|端口|port|auth|鉴权|配置|deploy|docker/.test(hay)) {
      boost += 20;
    }
  }

  if (intent === "concept") {
    if (/记忆|memory|检索|架构|边界|对比|手册|设计/.test(hay)) {
      boost += 14;
    }
  }

  return boost;
}

/**
 * Merge FTS/BM25 rank (higher better in our Wiki API) into OS field score.
 * Wiki returns score ≈ -bm25 + exact_boost.
 */
export function ftsScoreBoost(metadataScore: unknown): number {
  if (typeof metadataScore !== "number" || !Number.isFinite(metadataScore)) {
    return 0;
  }
  // Typical good hits sit roughly in [-5, 20+] after exact boosts.
  return Math.round(Math.max(0, Math.min(45, metadataScore * 4 + 16)));
}