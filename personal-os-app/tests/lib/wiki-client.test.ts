import { afterEach, describe, expect, it, vi } from "vitest";

const payload = {
  frontmatter: {
    title: "东京行完成总结",
    type: "project",
    created_by: "hermes:worker",
    task_id: "task_1",
    agent_id: "agent_1",
    project: "2026-05 东京行",
    source_type: "agent-output",
    tags: ["tokyo"],
  },
  content: "Ready for review.",
};

async function loadClient() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");
  vi.stubEnv("NEXT_PUBLIC_WIKI_URL", "http://wiki.local");
  vi.stubEnv("WIKI_API_TOKEN", "wiki-token-0000");
  return import("@/lib/wiki-client");
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("wiki ingest client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("parses the new success response fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        status: "created",
        path: "30_projects/tokyo/summary.md",
        directory: "30_projects/tokyo",
        url: "http://wiki.local/note?path=30_projects%2Ftokyo%2Fsummary.md",
        task_id: "task_1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { ingestWiki } = await loadClient();

    const result = await ingestWiki(payload);

    expect(result).toMatchObject({
      status: "created",
      path: "30_projects/tokyo/summary.md",
      directory: "30_projects/tokyo",
      task_id: "task_1",
      url: "http://os.local/api/wiki/open?next=%2Fnote%3Fpath%3D30_projects%252Ftokyo%252Fsummary.md",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://wiki.local/api/ingest",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer wiki-token-0000",
        }),
      }),
    );
  });

  it("throws WikiAuthError for 401 without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { code: "missing-or-invalid-token" }));
    vi.stubGlobal("fetch", fetchMock);
    const { WikiAuthError, ingestWiki } = await loadClient();

    await expect(ingestWiki(payload)).rejects.toBeInstanceOf(WikiAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws WikiSourceConflict for source immutable conflicts without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, { code: "source-immutable" }));
    vi.stubGlobal("fetch", fetchMock);
    const { WikiSourceConflict, ingestWiki } = await loadClient();

    await expect(ingestWiki(payload)).rejects.toBeInstanceOf(WikiSourceConflict);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws WikiPayloadTooLarge for 413", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(413, { code: "body-too-large" })));
    const { WikiPayloadTooLarge, ingestWiki } = await loadClient();

    await expect(ingestWiki(payload)).rejects.toBeInstanceOf(WikiPayloadTooLarge);
  });

  it("retries one lock-timeout response before returning success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { code: "lock-timeout" }))
      .mockResolvedValueOnce(
        jsonResponse(201, {
          status: "revision",
          path: "30_projects/tokyo/summary-r2.md",
          directory: "30_projects/tokyo",
          task_id: "task_1",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { ingestWiki } = await loadClient();

    const result = await ingestWiki(payload);

    expect(result.status).toBe("revision");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
