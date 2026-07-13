import { afterEach, describe, expect, it, vi } from "vitest";
import { searchSwarmVaultContext } from "@/lib/swarmvault-mcp-client";

const previousEnabled = process.env.AGENT_CONTEXT_SWARMVAULT_ENABLED;
const previousProjectRoot = process.env.AGENT_CONTEXT_SWARMVAULT_PROJECT_ROOT;
const previousLimit = process.env.AGENT_CONTEXT_SWARMVAULT_LIMIT;
const previousTimeout = process.env.AGENT_CONTEXT_SWARMVAULT_TIMEOUT_MS;

const restoreEnv = () => {
  for (const [key, val] of [
    ["AGENT_CONTEXT_SWARMVAULT_ENABLED", previousEnabled],
    ["AGENT_CONTEXT_SWARMVAULT_PROJECT_ROOT", previousProjectRoot],
    ["AGENT_CONTEXT_SWARMVAULT_LIMIT", previousLimit],
    ["AGENT_CONTEXT_SWARMVAULT_TIMEOUT_MS", previousTimeout],
  ] as const) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
};

describe("swarmvault-mcp-client", () => {
  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it("returns empty array when disabled (default)", async () => {
    delete process.env.AGENT_CONTEXT_SWARMVAULT_ENABLED;
    const hits = await searchSwarmVaultContext("code memory");
    expect(hits).toEqual([]);
  });

  it("returns empty array for blank query even when enabled", async () => {
    process.env.AGENT_CONTEXT_SWARMVAULT_ENABLED = "true";
    const hits = await searchSwarmVaultContext("   ");
    expect(hits).toEqual([]);
  });

  it("falls back to empty array on MCP process error", async () => {
    // projectRoot set but pointing at a nonexistent path forces swarmvault to fail
    const hits = await searchSwarmVaultContext("code memory", {
      projectRoot: "/nonexistent/path/that/does/not/exist",
      timeoutMs: 200,
    });
    expect(hits).toEqual([]);
  });
});
