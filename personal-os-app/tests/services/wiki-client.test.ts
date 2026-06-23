import { afterEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function loadWikiClient() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_WIKI_URL", "http://wiki.local");
  vi.stubEnv("WIKI_READ_TOKEN", "read-token-000000");
  vi.stubEnv("WIKI_API_TOKEN", "write-token-000000");
  return import("@/lib/wiki-client");
}

describe("wikiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses WIKI_READ_TOKEN for read requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ notes: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const { wikiClient } = await loadWikiClient();

    const result = await wikiClient.read<{ notes: unknown[] }>(
      "/api/notes?page_size=1",
    );

    expect(result).toMatchObject({ ok: true, status: 200, body: { notes: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const scheme = "Bearer";
    expect(url).toBe("http://wiki.local/api/notes?page_size=1");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `${scheme} read-token-000000`,
    );
  });

  it("uses WIKI_API_TOKEN and JSON body for write requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "created", note_path: "demo.md" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const { wikiClient } = await loadWikiClient();

    const result = await wikiClient.write<{ status: string; note_path: string }>(
      "/api/ingest",
      { body: { title: "Demo", content: "Body" } },
    );

    expect(result).toMatchObject({
      ok: true,
      status: 201,
      body: { status: "created", note_path: "demo.md" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const scheme = "Bearer";
    expect(url).toBe("http://wiki.local/api/ingest");
    expect(init.method).toBe("POST");
    expect(headers.Authorization).toBe(`${scheme} write-token-000000`);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ title: "Demo", content: "Body" }));
  });

  it("keeps searchWikiNotes on the read side and surfaces non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "no" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const { searchWikiNotes } = await loadWikiClient();

    await expect(searchWikiNotes("Personal OS", 3)).rejects.toThrow(
      "Personal Wiki search failed: 401",
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const scheme = "Bearer";
    expect(url).toBe("http://wiki.local/api/notes?q=Personal+OS&page=1&page_size=3");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `${scheme} read-token-000000`,
    );
  });

  it("prevents read tokens from being used for writes and write tokens for reads", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { wikiClient } = await loadWikiClient();
    const read = wikiClient.read as unknown as (
      path: string,
      options: { method: string; body?: unknown },
    ) => unknown;
    const write = wikiClient.write as unknown as (
      path: string,
      options: { method: string },
    ) => unknown;

    expect(() =>
      read("/api/ingest", { method: "POST", body: { title: "Nope" } }),
    ).toThrow("Personal Wiki read client cannot use POST");
    expect(() => write("/api/notes", { method: "GET" })).toThrow(
      "Personal Wiki write client cannot use GET",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
