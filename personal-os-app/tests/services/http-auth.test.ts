import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError, requireReadAccess, requireWriteAccess } from "@/lib/http";

function request(token?: string) {
  return new Request("http://localhost/api/test", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("API token guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows read access with the read token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "read-token-000000");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "write-token-000000");

    expect(() => requireReadAccess(request("read-token-000000"))).not.toThrow();
  });

  it("allows read access with the write token for agent compatibility", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "read-token-000000");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "write-token-000000");

    expect(() => requireReadAccess(request("write-token-000000"))).not.toThrow();
  });

  it("rejects unauthenticated production reads", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "read-token-000000");

    expect(() => requireReadAccess(request())).toThrow(HttpError);
  });

  it("rejects write access with the read token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "read-token-000000");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "write-token-000000");

    expect(() => requireWriteAccess(request("read-token-000000"))).toThrow(
      HttpError,
    );
  });
});
