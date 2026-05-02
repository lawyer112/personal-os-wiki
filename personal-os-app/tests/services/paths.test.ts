import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachmentDir, resolveDataPath, vaultDir } from "@/lib/paths";

describe("data paths", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps default runtime data under the app data directory", () => {
    expect(vaultDir()).toBe(path.resolve(process.cwd(), "data", "vault"));
    expect(attachmentDir()).toBe(
      path.resolve(process.cwd(), "data", "attachments"),
    );
  });

  it("allows configured paths inside the app data directory", () => {
    vi.stubEnv("PERSONAL_OS_VAULT_DIR", "data/custom-vault");

    expect(vaultDir()).toBe(path.resolve(process.cwd(), "data", "custom-vault"));
  });

  it("rejects relative path traversal outside the app data directory", () => {
    expect(() => resolveDataPath("../../outside", "vault")).toThrow(
      "Configured data path must stay inside the data directory",
    );
  });

  it("rejects absolute paths outside the app data directory", () => {
    const outside = path.resolve(process.cwd(), "..", "outside");

    expect(() => resolveDataPath(outside, "vault")).toThrow(
      "Configured data path must stay inside the data directory",
    );
  });
});
