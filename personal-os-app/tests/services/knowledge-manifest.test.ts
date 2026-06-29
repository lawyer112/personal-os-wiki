import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testDir, "../..");
const schemaPath = path.join(appRoot, "schemas/classic-knowledge-object-manifest.schema.json");
const lintScript = path.join(appRoot, "scripts/lint-classic-knowledge-object-manifest.mjs");
const examplePaths = [
  "examples/knowledge-objects/task.classic-knowledge-object.json",
  "examples/knowledge-objects/decision.classic-knowledge-object.json",
  "examples/knowledge-objects/sop.classic-knowledge-object.json",
];

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runLint(files: string[]) {
  return spawnSync(process.execPath, [lintScript, ...files], {
    cwd: appRoot,
    encoding: "utf8",
  });
}

describe("Knowledge Object Manifest v0", () => {
  it("declares the required provenance, freshness, and sensitivity fields", () => {
    const schema = readJson(schemaPath);

    expect(schema.properties.schema_version.const).toBe(
      "classic-knowledge-object-manifest/v0",
    );
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "id",
        "type",
        "source_path",
        "hash",
        "freshness",
        "sensitivity",
        "owner",
        "confidence",
        "relationships",
      ]),
    );
    expect(schema.properties.type.enum).toEqual(
      expect.arrayContaining(["task", "project", "evidence", "decision", "sop", "project_hub"]),
    );
    expect(schema.properties.freshness.required).toEqual(
      expect.arrayContaining(["status", "captured_at", "valid_until", "ttl_days"]),
    );
    expect(schema.properties.sensitivity.required).toEqual(
      expect.arrayContaining(["level", "contains_secrets", "allowed_uses"]),
    );
  });

  it("ships three valid example objects", () => {
    for (const relativePath of examplePaths) {
      const object = readJson(path.join(appRoot, relativePath));
      expect(object.schema_version).toBe("classic-knowledge-object-manifest/v0");
      expect(object.source_path).toBeTruthy();
      expect(object.hash.algorithm).toBe("sha256");
      expect(object.freshness.status).toBe("fresh");
      expect(object.sensitivity.contains_secrets).toBe(false);
    }

    const result = runLint(examplePaths);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("classic knowledge object manifest lint passed: 3 file(s)");
  });

  it("rejects no-source objects unless they are explicitly speculative", () => {
    const base = readJson(path.join(appRoot, examplePaths[0]));
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cko-manifest-"));
    const invalidPath = path.join(tempDir, "invalid.json");
    fs.writeFileSync(
      invalidPath,
      JSON.stringify(
        {
          ...base,
          id: "task:no-source-invalid",
          source_path: null,
          hash: null,
          confidence: "verified",
        },
        null,
        2,
      ),
    );

    const result = runLint([invalidPath]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("no-source-must-be-speculative");
  });

  it("detects source hash drift", () => {
    const base = readJson(path.join(appRoot, examplePaths[0]));
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cko-manifest-"));
    const invalidPath = path.join(tempDir, "hash-drift.json");
    fs.writeFileSync(
      invalidPath,
      JSON.stringify(
        {
          ...base,
          id: "task:hash-drift-invalid",
          hash: { ...base.hash, value: "0".repeat(64) },
        },
        null,
        2,
      ),
    );

    const result = runLint([invalidPath]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("hash-changed");
  });

  it("lint script is executable by node without TypeScript build", () => {
    const stdout = execFileSync(process.execPath, [lintScript, examplePaths[0]], {
      cwd: appRoot,
      encoding: "utf8",
    });
    expect(stdout).toContain("OK examples/knowledge-objects/task.classic-knowledge-object.json");
  });
});
