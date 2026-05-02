import { afterEach, describe, expect, it, vi } from "vitest";

describe("capture bookmarklet", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the configured public app URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://os.example.test");
    const { captureBookmarklet } = await import("@/lib/bookmarklet");

    expect(captureBookmarklet()).toContain('"https://os.example.test/capture"');
    expect(captureBookmarklet()).not.toContain("http://localhost:3000/capture");
  });
});
