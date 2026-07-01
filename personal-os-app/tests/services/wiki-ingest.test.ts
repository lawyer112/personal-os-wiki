import { afterEach, describe, expect, it, vi } from "vitest";

const wikiInput = {
  title: "Wiki fallback demo",
  content: "Body",
  source_type: "telegram",
  tags: [],
  metadata: {},
};

async function loadWikiIngest(write: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  vi.doMock("@/lib/wiki-client", () => ({
    wikiClient: { write },
  }));
  vi.doMock("@/lib/app-config", () => ({
    wikiOpenUrl: (path: string) => `http://wiki.local${path}`,
  }));

  return import("@/lib/wiki-ingest");
}

describe("ingestWikiNote", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/wiki-client");
    vi.doUnmock("@/lib/app-config");
  });

  it("returns a failed result instead of throwing when Wiki rejects writes", async () => {
    const write = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      body: { error: "missing write auth" },
      url: "http://wiki.local/api/ingest",
    });
    const { ingestWikiNote } = await loadWikiIngest(write);

    const result = await ingestWikiNote(wikiInput);

    expect(result).toEqual({
      ok: false,
      title: "Wiki fallback demo",
      error: "missing write auth",
    });
    expect(write).toHaveBeenCalledWith("/api/ingest", { body: wikiInput });
  });

  it("returns a failed result instead of throwing when Wiki is unreachable", async () => {
    const write = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
    const { ingestWikiNote } = await loadWikiIngest(write);

    await expect(ingestWikiNote(wikiInput)).resolves.toEqual({
      ok: false,
      title: "Wiki fallback demo",
      error: "connect ECONNREFUSED",
    });
  });

  it("can request light ingest so Wiki writes defer index rebuild work", async () => {
    const write = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        status: "created",
        note_path: "vault/20_notes/2026-07-01/wiki-fallback-demo.md",
        url: "/note?path=vault/20_notes/2026-07-01/wiki-fallback-demo.md",
      },
      url: "http://wiki.local/api/ingest?mode=light",
    });
    const { ingestWikiNote } = await loadWikiIngest(write);

    await expect(ingestWikiNote(wikiInput, { light: true })).resolves.toEqual({
      ok: true,
      title: "Wiki fallback demo",
      status: "created",
      note_path: "vault/20_notes/2026-07-01/wiki-fallback-demo.md",
      url: "http://wiki.local/note?path=vault/20_notes/2026-07-01/wiki-fallback-demo.md",
    });
    expect(write).toHaveBeenCalledWith("/api/ingest?mode=light", {
      body: wikiInput,
    });
  });
});
