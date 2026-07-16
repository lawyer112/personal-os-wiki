import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError, requireReadAccess, requireWriteAccess } from "@/lib/http";
import { tokenAllowed } from "@/lib/auth";
import { resetRateLimitForTests } from "@/lib/rate-limit";

function request(token?: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/test", {
    headers: token ? { authorization: `Bearer ${token}`, ...headers } : headers,
  });
}

describe("API token guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetRateLimitForTests();
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

  it("allows write access with the write token stored in the read cookie", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "read-token-000000");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "write-token-000000");

    expect(() =>
      requireWriteAccess(
        request(undefined, { cookie: "personal_os_read=write-token-000000" }),
      ),
    ).not.toThrow();
  });

  it("rejects write access with the read token stored in the read cookie", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "read-token-000000");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "write-token-000000");

    expect(() =>
      requireWriteAccess(
        request(undefined, { cookie: "personal_os_read=read-token-000000" }),
      ),
    ).toThrow(HttpError);
  });

  it("does not trust forwarded addresses for rate-limit buckets by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "write-token-000000");
    vi.stubEnv("PERSONAL_OS_WRITE_RATE_LIMIT", "1");
    vi.stubEnv("PERSONAL_OS_WRITE_RATE_WINDOW_MS", "60000");

    expect(() =>
      requireWriteAccess(
        request("wrong-token-000000", { "x-forwarded-for": "203.0.113.10" }),
      ),
    ).toThrow("Missing or invalid API token");
    expect(() =>
      requireWriteAccess(
        request("wrong-token-000000", { "x-forwarded-for": "203.0.113.11" }),
      ),
    ).toThrow("Too many write requests");
  });

  it("uses forwarded addresses only behind an explicitly trusted proxy", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "write-token-000000");
    vi.stubEnv("PERSONAL_OS_WRITE_RATE_LIMIT", "1");
    vi.stubEnv("PERSONAL_OS_WRITE_RATE_WINDOW_MS", "60000");
    vi.stubEnv("PERSONAL_OS_TRUST_PROXY_HEADERS", "true");

    expect(() =>
      requireWriteAccess(
        request("wrong-token-000000", { "x-forwarded-for": "203.0.113.10" }),
      ),
    ).toThrow("Missing or invalid API token");
    expect(() =>
      requireWriteAccess(
        request("wrong-token-000000", { "x-forwarded-for": "203.0.113.11" }),
      ),
    ).toThrow("Missing or invalid API token");
  });

  it("compares tokens without length-sensitive equality failures", () => {
    expect(tokenAllowed("read-token-000000", ["read-token-000000"])).toBe(true);
    expect(tokenAllowed("short", ["read-token-000000"])).toBe(false);
    expect(tokenAllowed("", ["read-token-000000"])).toBe(false);
  });
});
