import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testDir, "../..");
const fixtureDir = path.join(appRoot, "tests/fixtures/raw-manifest-ingest");
const ingestScript = path.join(appRoot, "scripts/raw-manifest-ingest.mjs");

async function loadIngestModule() {
  vi.resetModules();
  return import(ingestScript);
}

describe("raw-manifest-ingest", () => {
  it("dry-runs 3 fixtures into ingest=1, skip=1, update=1, invalid=0", async () => {
    const { ingestDirectory, formatReport } = await loadIngestModule();

    const registryPath = path.join(fixtureDir, ".raw-manifest-registry.json");
    const originalRegistry = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, "utf8") : null;

    try {
      const result = await ingestDirectory({
        dir: fixtureDir,
        dryRun: true,
        stateFile: registryPath,
      });

      expect(result.counts).toEqual({ ingest: 1, skip: 1, update: 1, invalid: 0 });
      expect(result.items).toHaveLength(3);
      expect(result.items.map((i: { action: string }) => i.action)).toEqual(
        expect.arrayContaining(["ingest", "skip", "update"]),
      );

      const ingestItem = result.items.find((i: { action: string; reason?: string }) => i.action === "ingest");
      expect(ingestItem?.reason).toBe("not in registry");

      const skipItem = result.items.find((i: { action: string; reason?: string }) => i.action === "skip");
      expect(skipItem?.reason).toBe("hash matches registry");

      const updateItem = result.items.find((i: { action: string; reason?: string }) => i.action === "update");
      expect(updateItem?.reason).toBe("hash drift");

      const report = formatReport(result, fixtureDir);
      expect(report).toContain("ingest: 1, skip: 1, update: 1, invalid: 0");
      expect(report).toContain("INGEST");
      expect(report).toContain("SKIP");
      expect(report).toContain("UPDATE");
    } finally {
      if (originalRegistry !== null) {
        fs.writeFileSync(registryPath, originalRegistry);
      }
    }
  });

  it("does not scan the real vault", async () => {
    const { ingestDirectory } = await loadIngestModule();

    const result = await ingestDirectory({
      dir: fixtureDir,
      dryRun: true,
      stateFile: path.join(fixtureDir, ".raw-manifest-registry.json"),
    });

    // All items must be within fixtureDir
    for (const item of result.items) {
      const itemPath = path.resolve(fixtureDir, item.file);
      expect(itemPath.startsWith(fixtureDir)).toBe(true);
    }
    expect(result.items.length).toBe(3);
  });

  it("builds an intake payload with correct structure", async () => {
    const { buildIntakePayload } = await loadIngestModule();
    const payload = buildIntakePayload(
      [
        {
          id: "task:test",
          title: "Test object",
          type: "task",
          hash: { value: "abc123" },
        },
      ],
      { agentId: "obsidianmanager1", projectName: "Test Project" },
    );

    expect(payload.source.sourceType).toBe("agent-output");
    expect(payload.project.priority).toBe("P0");
    expect(payload.wikiNotes).toHaveLength(1);
    expect(payload.wikiNotes[0].frontmatter.created_by).toBe("hermes:worker");
    expect(payload.wikiNotes[0].frontmatter.source_type).toBe("agent-output");
    expect(payload.wikiNotes[0].frontmatter.tags).toContain("raw-manifest");
    expect(payload.projectEvents).toHaveLength(1);
  });
});
