import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("agent helper scripts", () => {
  it("documents a heartbeat helper for long-running agent leases", async () => {
    const { stdout } = await execFileAsync("node", [
      "scripts/agent-heartbeat.mjs",
      "--help",
    ]);

    expect(stdout).toContain("agent-heartbeat.mjs");
    expect(stdout).toContain("--task-id");
    expect(stdout).toContain("--lease-minutes");
  });

  it("prints a dry-run smoke plan without requiring tokens or network", async () => {
    const { stdout } = await execFileAsync("node", [
      "scripts/agent-protocol-smoke.mjs",
      "--dry-run",
      "--json",
    ]);
    const body = JSON.parse(stdout);

    expect(body.ok).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(body.steps.map((step: { name: string }) => step.name)).toEqual([
      "upsert profile",
      "intake create task",
      "agent inbox before claim",
      "claim task",
      "heartbeat task",
      "write contribution",
      "submit task",
      "review archive",
      "read final task",
      "agent inbox after archive",
    ]);
  });
});
