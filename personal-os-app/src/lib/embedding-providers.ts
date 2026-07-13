/**
 * Embedding providers for the read-only memory vector candidate recall PoC.
 *
 * The default provider is a deterministic, offline, local hashing embedding.
 * It requires no external network calls or API keys, which keeps the PoC
 * self-contained and safe to run inside cron / CI. A remote provider can be
 * added later behind MEMORY_EMBEDDING_PROVIDER without changing callers.
 */

export interface EmbeddingProvider {
  /** Embed a single text into a fixed-dimension unit vector. */
  embed(text: string): Promise<number[]>;
  /** Embed a batch of texts. */
  batchEmbed(texts: string[]): Promise<number[][]>;
}

const DEFAULT_DIM = 256;

/**
 * FNV-1a 32-bit string hash — stable across runs and platforms.
 */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // multiply by FNV prime with 32-bit overflow
    hash = Math.imul(hash, 0x01000193);
  }
  // force unsigned
  return hash >>> 0;
}

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/u;

/**
 * Tokenize text into features that give useful lexical overlap for both
 * latin and CJK content:
 *   - latin/number runs, lowercased
 *   - individual CJK characters
 *   - CJK character bigrams
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
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

function localHashEmbed(text: string, dim = DEFAULT_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  // term frequency counts
  const counts = new Map<string, number>();
  for (const tok of tokens) {
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }

  for (const [tok, count] of counts) {
    const h = hashString(tok);
    const idx = h % dim;
    // signed hashing (feature-hashing trick) reduces collision bias
    const sign = (h >>> 31) & 1 ? -1 : 1;
    // sublinear tf weighting
    const weight = 1 + Math.log(count);
    vec[idx] += sign * weight;
  }

  // L2 normalize so cosine similarity is well behaved
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

/**
 * A deterministic, offline embedding provider based on feature hashing.
 */
export function createLocalEmbeddingProvider(dim = DEFAULT_DIM): EmbeddingProvider {
  return {
    async embed(text: string): Promise<number[]> {
      return localHashEmbed(text ?? "", dim);
    },
    async batchEmbed(texts: string[]): Promise<number[][]> {
      return texts.map((t) => localHashEmbed(t ?? "", dim));
    },
  };
}

/**
 * Build an embedding provider from environment configuration.
 *
 * MEMORY_EMBEDDING_PROVIDER:
 *   "local" (default) — deterministic offline hashing embedding.
 *
 * Remote providers are intentionally not wired up in this PoC to avoid any
 * outbound transmission of project data. Extend here when a vetted provider
 * and credentials are approved.
 */
export function createEmbeddingProviderFromEnv(): EmbeddingProvider {
  const mode = (process.env.MEMORY_EMBEDDING_PROVIDER ?? "local").toLowerCase();
  switch (mode) {
    case "local":
    default:
      return createLocalEmbeddingProvider();
  }
}
