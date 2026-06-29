import { describe, expect, it } from "vitest";

async function loadArchiver() {
  const moduleUrl = new URL("../../scripts/archive-agent-run-context-pack.mjs", import.meta.url).href;
  return import(moduleUrl);
}

describe("AgentRun context pack archiver", () => {
  it("builds markdown with task_id, gate, diff, tests, deployment, and residual risks", async () => {
    const { buildContextPackMarkdown } = await loadArchiver();
    const markdown = buildContextPackMarkdown({
      targetTaskId: "task_done_1",
      archiveTaskId: "task_archive_1",
      generatedAt: "2026-06-23T00:00:00.000Z",
      taskContext: {
        context: {
          task: {
            id: "task_done_1",
            title: "Ship context tiers",
            status: "done",
            project: { name: "Personal OS / Wiki Upgrade" },
            wikiLinks: [
              { noteTitle: "Prior note", notePath: "vault/prior.md" },
            ],
          },
        },
      },
      artifacts: {
        runDir: ".agent-runs/task_done_1",
        files: [
          { path: "gate.json", bytes: 100 },
          { path: "diff.patch", bytes: 200 },
        ],
        gate: {
          data: {
            status: "pass",
            synthesizer: { allowed_to_announce_done: true },
            verifier: {
              commands: [
                { cmd: "npm test", exit_code: 0, evidence: "artifacts/npm-test.log" },
              ],
            },
            deployment: {
              status: "pass",
              backup_dir: "/data/archive/backup",
              rollback_path: "/data/archive/backup",
            },
            production_regression: { status: "pass" },
            writeback: { status: "pass", task_status: "done" },
          },
        },
        workerResult: {
          data: {
            status: "done",
            diff_path: "diff.patch",
            diff_stat: "1 file changed",
            changed_files: ["src/lib/agent-context.ts"],
            risks: ["Worktree has unrelated files"],
            writeback: { definitionOfDoneMet: true },
          },
        },
        diffPatch: { exists: true, text: "diff --git a/a b/a", truncated: false },
        finalMarkdown: { exists: false, text: "", truncated: false },
      },
    });

    expect(markdown).toContain("task_id: task_done_1");
    expect(markdown).toContain("archive_task_id: task_archive_1");
    expect(markdown).toContain("gate: pass");
    expect(markdown).toContain("1 file changed");
    expect(markdown).toContain("npm test");
    expect(markdown).toContain("deployment_status: pass");
    expect(markdown).toContain("Worktree has unrelated files");
  });

  it("builds an intake payload with the production Wiki frontmatter whitelist", async () => {
    const { buildIntakePayload } = await loadArchiver();
    const payload = buildIntakePayload({
      markdown: "# Context pack",
      title: "AgentRun context pack task_done_1 2026-06-23",
      targetTaskId: "task_done_1",
      archiveTaskId: "task_archive_1",
      agentId: "obsidianmanager1",
      projectName: "Personal OS / Wiki Upgrade",
      generatedAt: "2026-06-23T00:00:00.000Z",
    });

    expect(payload.wikiNotes[0].frontmatter).toEqual({
      title: "AgentRun context pack task_done_1 2026-06-23",
      type: "project",
      created_by: "hermes:worker",
      source_type: "agent-output",
      tags: ["personal-os", "personal-wiki", "agent-run", "context-pack", "evidence"],
      created_at: "2026-06-23T00:00:00.000Z",
      task_id: "task_done_1",
      agent_id: "obsidianmanager1",
      project: "Personal OS / Wiki Upgrade",
      last_reviewed: "2026-06-23",
    });
    expect(payload.wikiNotes[0].metadata.archive_task_id).toBe("task_archive_1");
    expect(payload.projectEvents[0].eventType).toBe("agent-context-pack");
  });

  it("redacts bearer tokens and token assignments", async () => {
    const { redact } = await loadArchiver();

    const bearerHeader = ["Authorization:", "Bearer", "secret-token-value-12345"].join(" ");
    const tokenAssignment = ["PERSONAL_OS_API_TOKEN", "secret-token-value-12345"].join("=");

    expect(redact(bearerHeader)).toBe("Authorization: [REDACTED]");
    expect(redact(tokenAssignment)).toBe("PERSONAL_OS_API_TOKEN=[REDACTED]");
  });
});
