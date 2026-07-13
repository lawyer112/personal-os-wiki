import { afterEach, describe, expect, it, vi } from "vitest";

function request(token?: string, cookie?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (cookie) {
    headers.cookie = cookie;
  }
  return new Request("http://os.local/api/wiki/open?next=/notes", { headers });
}

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/wiki/open/route");
}

describe("Wiki browser handoff", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects unauthenticated handoff requests", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "os-read-token-0000");
    vi.stubEnv("WIKI_READ_TOKEN", "wiki-read-token-0000");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");
    vi.stubEnv("NEXT_PUBLIC_WIKI_URL", "http://os.local");

    const { GET } = await loadRoute();
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets the Wiki read cookie after Personal OS read auth", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "os-read-token-0000");
    vi.stubEnv("WIKI_READ_TOKEN", "wiki-read-token-0000");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");
    vi.stubEnv("NEXT_PUBLIC_WIKI_URL", "http://os.local");

    const { GET } = await loadRoute();
    const response = await GET(request("os-read-token-0000"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://os.local/notes");
    expect(response.headers.get("set-cookie")).toContain(
      "personal_wiki_read=wiki-read-token-0000",
    );
  });

  it("accepts the Personal OS read cookie for browser handoff", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "os-read-token-0000");
    vi.stubEnv("WIKI_READ_TOKEN", "wiki-read-token-0000");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");
    vi.stubEnv("NEXT_PUBLIC_WIKI_URL", "http://os.local");

    const { GET } = await loadRoute();
    const response = await GET(request(undefined, "personal_os_read=os-read-token-0000"));

    expect(response.status).toBe(302);
    expect(response.headers.get("set-cookie")).toContain(
      "personal_wiki_read=wiki-read-token-0000",
    );
  });
});
