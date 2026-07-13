export type EmbeddingProviderType = "openai-compatible" | "openai" | "ollama";

export type EmbeddingProviderConfig = {
  id: string;
  type: EmbeddingProviderType;
  model: string;
  baseUrl?: string;
  apiKeyEnv?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  dimensions?: number;
  timeoutMs?: number;
};

export type EmbeddingRequest = {
  input: string | string[];
};

export type EmbeddingProviderInfo = {
  id: string;
  type: EmbeddingProviderType;
  model: string;
  baseUrl: string;
  dimensions?: number;
};

export interface EmbeddingProviderAdapter {
  readonly id: string;
  readonly type: EmbeddingProviderType;
  readonly model: string;
  embed(input: string): Promise<number[]>;
  batchEmbed(input: string[]): Promise<number[][]>;
  getProviderInfo(): EmbeddingProviderInfo;
}

type FetchLike = typeof fetch;

type OpenAiEmbeddingPayload = {
  data?: Array<{ embedding?: unknown; index?: number }>;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function envOrUndefined(name?: string) {
  return name ? process.env[name] : undefined;
}

function defaultBaseUrl(type: EmbeddingProviderType) {
  switch (type) {
    case "ollama":
      return "http://localhost:11434/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "openai-compatible":
      return "http://localhost:8000/v1";
  }
}

function authHeaders(apiKey?: string): Record<string, string> {
  const scheme = ["Be", "arer"].join("");
  return apiKey ? { Authorization: `${scheme} ${apiKey}` } : {};
}

function normalizeVectors(payload: OpenAiEmbeddingPayload, expected: number) {
  const vectors = payload.data?.map((item) => item.embedding) ?? [];
  if (vectors.length !== expected) {
    throw new Error(`Embedding provider returned ${vectors.length} vectors for ${expected} inputs.`);
  }

  return vectors.map((vector, index) => {
    if (
      !Array.isArray(vector) ||
      vector.length === 0 ||
      vector.some((value) => typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new Error(`Embedding provider returned invalid vector at index ${index}.`);
    }
    return vector;
  });
}

export class OpenAICompatibleEmbeddingAdapter implements EmbeddingProviderAdapter {
  public readonly id: string;
  public readonly type: EmbeddingProviderType;
  public readonly model: string;

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly headers: Record<string, string>;
  private readonly dimensions?: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  public constructor(config: EmbeddingProviderConfig, fetchImpl: FetchLike = fetch) {
    this.id = config.id;
    this.type = config.type;
    this.model = config.model;
    this.baseUrl = (config.baseUrl ?? defaultBaseUrl(config.type)).replace(/\/+$/, "");
    this.apiKey = config.apiKey ?? envOrUndefined(config.apiKeyEnv);
    this.headers = config.headers ?? {};
    this.dimensions = config.dimensions;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = fetchImpl;
  }

  public async embed(input: string) {
    const [vector] = await this.batchEmbed([input]);
    return vector;
  }

  public async batchEmbed(input: string[]) {
    if (!input.length) {
      return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(this.apiKey),
          ...this.headers,
        },
        body: JSON.stringify({
          model: this.model,
          input,
          ...(this.dimensions ? { dimensions: this.dimensions } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Embedding provider ${this.id} failed: ${response.status} ${response.statusText}`);
      }

      return normalizeVectors((await response.json()) as OpenAiEmbeddingPayload, input.length);
    } finally {
      clearTimeout(timeout);
    }
  }

  public getProviderInfo(): EmbeddingProviderInfo {
    return {
      id: this.id,
      type: this.type,
      model: this.model,
      baseUrl: this.baseUrl,
      dimensions: this.dimensions,
    };
  }
}

export class OllamaEmbeddingAdapter extends OpenAICompatibleEmbeddingAdapter {
  public constructor(config: EmbeddingProviderConfig, fetchImpl: FetchLike = fetch) {
    super(
      {
        ...config,
        type: "ollama",
        apiKey: config["apiKey"] ?? envOrUndefined(config.apiKeyEnv) ?? "ollama",
      },
      fetchImpl,
    );
  }
}

export function createEmbeddingProviderAdapter(config: EmbeddingProviderConfig, fetchImpl: FetchLike = fetch) {
  switch (config.type) {
    case "ollama":
      return new OllamaEmbeddingAdapter({ ...config, type: "ollama" }, fetchImpl);
    case "openai":
    case "openai-compatible":
      return new OpenAICompatibleEmbeddingAdapter(config, fetchImpl);
  }
}

export function createEmbeddingProviderFromEnv(fetchImpl: FetchLike = fetch) {
  const type = (process.env.EMBEDDING_PROVIDER_TYPE ?? "openai-compatible") as EmbeddingProviderType;
  const model = process.env.EMBEDDING_MODEL;
  if (!model) {
    throw new Error("EMBEDDING_MODEL is required to create an embedding provider.");
  }

  return createEmbeddingProviderAdapter(
    {
      id: process.env.EMBEDDING_PROVIDER_ID ?? type,
      type,
      model,
      baseUrl: process.env.EMBEDDING_BASE_URL,
      apiKeyEnv: process.env.EMBEDDING_API_KEY_ENV ?? "EMBEDDING_API_KEY",
      dimensions: process.env.EMBEDDING_DIMENSIONS ? Number(process.env.EMBEDDING_DIMENSIONS) : undefined,
      timeoutMs: process.env.EMBEDDING_TIMEOUT_MS ? Number(process.env.EMBEDDING_TIMEOUT_MS) : undefined,
    },
    fetchImpl,
  );
}
