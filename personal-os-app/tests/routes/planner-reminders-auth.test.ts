import { afterEach, describe, expect, it, vi } from "vitest";

function request(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return new Request(`http://os.local${path}`, { headers });
}

async function loadPlannerRoute() {
  vi.resetModules();
  vi.doMock("@/lib/db", () => ({ prisma: {} }));
  vi.doMock("@/lib/daily-planner", () => ({
    normalizePlannerMode: (mode: string | null) => mode ?? "morning",
    getDailyPlannerPack: vi.fn().mockResolvedValue({ mode: "morning" }),
  }));
  return import("@/app/api/planner/today/route");
}

async function loadReminderRoute() {
  vi.resetModules();
  vi.doMock("@/lib/db", () => ({ prisma: {} }));
  vi.doMock("@/lib/reminders", () => ({
    normalizeReminderMode: (mode: string | null) => mode ?? "morning",
    getTodayReminder: vi.fn().mockResolvedValue({ mode: "morning" }),
  }));
  return import("@/app/api/reminders/today/route");
}

describe("planner and reminder read auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows the read token to fetch the planner packet", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "os-read-token-0000");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");

    const { GET } = await loadPlannerRoute();
    const response = await GET(
      request("/api/planner/today?mode=morning", "os-read-token-0000"),
    );

    expect(response.status).toBe(200);
  });

  it("allows the read token to fetch reminder payloads", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "os-read-token-0000");
    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");

    const { GET } = await loadReminderRoute();
    const response = await GET(
      request("/api/reminders/today?mode=checkin", "os-read-token-0000"),
    );

    expect(response.status).toBe(200);
  });

  it("rejects unauthenticated planner reads in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "os-read-token-0000");

    const { GET } = await loadPlannerRoute();
    const response = await GET(request("/api/planner/today?mode=morning"));

    expect(response.status).toBe(401);
  });
});
