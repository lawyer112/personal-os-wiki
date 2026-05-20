import { afterEach, describe, expect, it, vi } from "vitest";

async function loadRoute() {
  vi.resetModules();
  return import("@/app/auth/read/route");
}

describe("read auth page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("renders localized access-token copy and preview hints", async () => {
    vi.stubEnv("PERSONAL_OS_READ_ACCESS_HINT", "demo-read-token");

    const { GET } = await loadRoute();
    const response = await GET(
      new Request("http://os.local/auth/read", {
        headers: { "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" },
      }),
    );
    const body = await response.text();

    expect(response.headers.get("content-language")).toBe("zh-CN");
    expect(body).toContain("这里不是账号密码登录");
    expect(body).toContain("预览口令");
    expect(body).toContain("demo-read-token");
  });

  it("redirects successful login to the configured public app URL", async () => {
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "demo-read-token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://192.168.6.28:3100");

    const { POST } = await loadRoute();
    const response = await POST(
      new Request("http://localhost:3000/auth/read", {
        method: "POST",
        body: new URLSearchParams({ token: "demo-read-token", next: "/" }),
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://192.168.6.28:3100/");
  });
});
