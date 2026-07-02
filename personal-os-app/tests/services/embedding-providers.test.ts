import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmbeddingProviderAdapter,
  createEmbeddingProviderFromEnv,
  OllamaEmbeddingAdapter,
  OpenAICompatibleEmbeddingAdapter,
} from "@/lib/embedding-providers";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Bad Request",
    headers: { "content-type": "application/json" },
  });
}

describe("embedding provider adapters", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends OpenAI-compatible embedding requests through one adapter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
      }),
    );
    const adapter = new OpenAICompatibleEmbeddingAdapter(
      {
        id: "doubao",
        type: "openai-compatible",
        model: "doubao-embedding-vision",
        baseUrl: "https://ark.example/v1/",
        apiKey: ["test", "token"].join("-"),
        dimensions: 2,
      },
      fetchMock as unknown as typeof fetch,
    );

    await expect(adapter.batchEmbed(["alpha", "beta"])).resolves.toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ark.example/v1/embeddings");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({
        model: "doubao-embedding-vision",
        input: ["alpha", "beta"],
        dimensions: 2,
      }),
    );
    expect((init.headers as Record<string, string>).Authorization).toMatch(/test-token$/);
  });

  it("creates ollama adapters with the local OpenAI-compatible endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: [{ embedding: [1, 2, 3] }] }));
    const adapter = createEmbeddingProviderAdapter(
      { id: "local", type: "ollama", model: "nomic-embed-text" },
      fetchMock as unknown as typeof fetch,
    );

    expect(adapter).toBeInstanceOf(OllamaEmbeddingAdapter);
    await expect(adapter.embed("hello")).resolves.toEqual([1, 2, 3]);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/v1/embeddings");
  });

  it("builds providers from environment config and rejects malformed vectors", async () => {
    vi.stubEnv("EMBEDDING_PROVIDER_TYPE", "openai-compatible");
    vi.stubEnv("EMBEDDING_PROVIDER_ID", "env-provider");
    vi.stubEnv("EMBEDDING_MODEL", "text-embedding-3-small");
    vi.stubEnv("EMBEDDING_BASE_URL", "http://embeddings.local/v1");
    vi.stubEnv("EMBEDDING_API_KEY", "env-token");

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ embedding: [] }] }));
    const adapter = createEmbeddingProviderFromEnv(fetchMock as unknown as typeof fetch);

    expect(adapter.getProviderInfo()).toMatchObject({
      id: "env-provider",
      type: "openai-compatible",
      model: "text-embedding-3-small",
      baseUrl: "http://embeddings.local/v1",
    });
    await expect(adapter.embed("bad-vector")).rejects.toThrow(
      "Embedding provider returned invalid vector at index 0.",
    );
  });
});
