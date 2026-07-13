#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_TOP_LEVEL_FIELDS = [
  "schema_version",
  "id",
  "type",
  "title",
  "summary",
  "source_path",
  "source_url",
  "source_type",
  "hash",
  "freshness",
  "sensitivity",
  "owner",
  "created_at",
  "updated_at",
  "confidence",
  "lifecycle",
  "relationships",
];

const VALID_TYPES = new Set([
  "task",
  "project",
  "evidence",
  "decision",
  "sop",
  "project_hub",
  "status",
  "context_pack",
  "agent_run",
  "idea",
  "note",
]);

const VALID_CONFIDENCE = new Set(["verified", "inferred", "speculative"]);
const VALID_SENSITIVITY = new Set(["public", "internal", "private", "secret"]);
const SECRET_SAFE_USES = new Set(["local_only", "task_execution"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDate(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addFinding(findings, severity, code, message) {
  findings.push({ severity, code, message });
}

function resolveSourcePath(sourcePath, baseDir) {
  if (!isNonEmptyString(sourcePath)) {
    return null;
  }
  return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(baseDir, sourcePath);
}

function hashFile(filePath, algorithm) {
  const hash = crypto.createHash(algorithm);
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function waivedCodes(object) {
  const waivers = object?.lint?.waivers;
  if (!Array.isArray(waivers)) {
    return new Set();
  }
  const now = new Date();
  return new Set(
    waivers
      .filter((waiver) => {
        if (!isPlainObject(waiver) || !isNonEmptyString(waiver.code)) {
          return false;
        }
        const expiresAt = waiver.expires_at ? parseDate(waiver.expires_at) : null;
        return !expiresAt || expiresAt >= now;
      })
      .map((waiver) => waiver.code),
  );
}

export function lintObject(object, options = {}) {
  const baseDir = options.baseDir ?? process.cwd();
  const now = options.now ?? new Date();
  const findings = [];

  if (!isPlainObject(object)) {
    addFinding(findings, "error", "object-invalid", "Manifest must be a JSON object.");
    return findings;
  }

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!(field in object)) {
      addFinding(findings, "error", "required-field-missing", `Missing required field: ${field}.`);
    }
  }

  if (object.schema_version !== "classic-knowledge-object-manifest/v0") {
    addFinding(findings, "error", "schema-version-invalid", "schema_version must be classic-knowledge-object-manifest/v0.");
  }

  if (!isNonEmptyString(object.id) || !/^(task|project|evidence|decision|sop|project_hub|status|context_pack|agent_run|idea|note):[A-Za-z0-9._:/#-]+$/.test(object.id)) {
    addFinding(findings, "error", "id-invalid", "id must be a stable prefixed id such as task:<id> or decision:<slug>.");
  }

  if (!VALID_TYPES.has(object.type)) {
    addFinding(findings, "error", "type-invalid", `type must be one of: ${Array.from(VALID_TYPES).join(", ")}.`);
  }

  if (!isNonEmptyString(object.title)) {
    addFinding(findings, "error", "title-missing", "title must be a non-empty string.");
  }

  if (!isNonEmptyString(object.summary)) {
    addFinding(findings, "error", "summary-missing", "summary must be a non-empty string.");
  }

  const hasSource = isNonEmptyString(object.source_path);
  if (!hasSource) {
    if (object.confidence !== "speculative" || object.hash !== null) {
      addFinding(findings, "error", "no-source-must-be-speculative", "Objects without source_path must set confidence=speculative and hash=null.");
    }
  } else {
    const sourcePath = resolveSourcePath(object.source_path, baseDir);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      addFinding(findings, "error", "source-missing", `source_path does not exist: ${object.source_path}.`);
    } else if (!isPlainObject(object.hash)) {
      addFinding(findings, "error", "hash-missing", "Objects with source_path must include a hash object.");
    } else {
      const algorithm = object.hash.algorithm;
      if (algorithm !== "sha256" && algorithm !== "sha1") {
        addFinding(findings, "error", "hash-algorithm-invalid", "hash.algorithm must be sha256 or sha1.");
      } else if (!isNonEmptyString(object.hash.value)) {
        addFinding(findings, "error", "hash-value-missing", "hash.value must be present.");
      } else {
        const actualHash = hashFile(sourcePath, algorithm);
        if (actualHash !== object.hash.value) {
          addFinding(findings, "error", "hash-changed", `hash.value no longer matches source_path; expected ${actualHash}.`);
        }
      }
    }
  }

  if (!VALID_CONFIDENCE.has(object.confidence)) {
    addFinding(findings, "error", "confidence-invalid", "confidence must be verified, inferred, or speculative.");
  }

  const createdAt = parseDate(object.created_at);
  const updatedAt = parseDate(object.updated_at);
  if (!createdAt) {
    addFinding(findings, "error", "created-at-invalid", "created_at must be an ISO date-time string.");
  }
  if (!updatedAt) {
    addFinding(findings, "error", "updated-at-invalid", "updated_at must be an ISO date-time string.");
  }
  if (createdAt && updatedAt && updatedAt < createdAt) {
    addFinding(findings, "error", "updated-before-created", "updated_at must not be earlier than created_at.");
  }

  if (!isPlainObject(object.owner) || !isNonEmptyString(object.owner.type) || !isNonEmptyString(object.owner.id)) {
    addFinding(findings, "error", "owner-missing", "owner.type and owner.id are required.");
  }

  if (!isPlainObject(object.freshness)) {
    addFinding(findings, "error", "freshness-missing", "freshness object is required.");
  } else {
    const capturedAt = parseDate(object.freshness.captured_at);
    const validUntil = object.freshness.valid_until === null ? null : parseDate(object.freshness.valid_until);
    const lastCheckedAt = object.freshness.last_checked_at === null ? null : parseDate(object.freshness.last_checked_at);
    if (!capturedAt) {
      addFinding(findings, "error", "freshness-captured-at-invalid", "freshness.captured_at must be an ISO date-time string.");
    }
    if (object.freshness.valid_until !== null && !validUntil) {
      addFinding(findings, "error", "freshness-valid-until-invalid", "freshness.valid_until must be null or an ISO date-time string.");
    }
    if (object.freshness.last_checked_at !== null && !lastCheckedAt) {
      addFinding(findings, "error", "freshness-last-checked-at-invalid", "freshness.last_checked_at must be null or an ISO date-time string.");
    }
    if (validUntil && validUntil < now) {
      addFinding(findings, "warning", "ttl-expired", "freshness.valid_until is older than the lint run time.");
    }
    if (object.freshness.status === "fresh" && validUntil && validUntil < now) {
      addFinding(findings, "error", "freshness-status-inconsistent", "freshness.status cannot be fresh after valid_until has passed.");
    }
  }

  if (!isPlainObject(object.sensitivity)) {
    addFinding(findings, "error", "sensitivity-missing", "sensitivity object is required.");
  } else {
    if (!VALID_SENSITIVITY.has(object.sensitivity.level)) {
      addFinding(findings, "error", "sensitivity-level-invalid", "sensitivity.level must be public, internal, private, or secret.");
    }
    if (typeof object.sensitivity.contains_secrets !== "boolean") {
      addFinding(findings, "error", "sensitivity-secrets-flag-missing", "sensitivity.contains_secrets must be boolean.");
    }
    if (!Array.isArray(object.sensitivity.allowed_uses) || object.sensitivity.allowed_uses.length === 0) {
      addFinding(findings, "error", "sensitivity-allowed-uses-missing", "sensitivity.allowed_uses must be a non-empty array.");
    }
    if (object.sensitivity.contains_secrets && object.sensitivity.level !== "secret") {
      addFinding(findings, "error", "sensitivity-violation", "contains_secrets=true requires sensitivity.level=secret.");
    }
    if (object.sensitivity.level === "secret") {
      const unsafeUse = (object.sensitivity.allowed_uses ?? []).find((use) => !SECRET_SAFE_USES.has(use));
      if (unsafeUse) {
        addFinding(findings, "error", "sensitivity-violation", `secret objects cannot be used for ${unsafeUse}.`);
      }
    }
  }

  if (!isPlainObject(object.lifecycle) || !isNonEmptyString(object.lifecycle.status)) {
    addFinding(findings, "error", "lifecycle-missing", "lifecycle.status is required.");
  }

  if (!isPlainObject(object.relationships)) {
    addFinding(findings, "error", "relationships-missing", "relationships object is required.");
  } else {
    const supersededBy = Array.isArray(object.relationships.superseded_by) ? object.relationships.superseded_by : [];
    if (object.type === "decision" && supersededBy.length > 0 && object.lifecycle?.status !== "superseded") {
      addFinding(findings, "error", "decision-superseded", "Decision with relationships.superseded_by must set lifecycle.status=superseded.");
    }
  }

  const waivers = waivedCodes(object);
  return findings.filter((finding) => !(finding.severity === "warning" && waivers.has(finding.code)));
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return { __parseError: error instanceof Error ? error.message : String(error) };
  }
}

export function lintFiles(files, options = {}) {
  const baseDir = options.baseDir ?? process.cwd();
  return files.map((file) => {
    const object = readJson(file);
    const findings = object.__parseError
      ? [{ severity: "error", code: "json-parse-error", message: object.__parseError }]
      : lintObject(object, { ...options, baseDir });
    return { file, findings };
  });
}

function printResult(result) {
  if (result.findings.length === 0) {
    console.log(`OK ${result.file}`);
    return;
  }
  for (const finding of result.findings) {
    console.log(`${finding.severity.toUpperCase()} ${result.file} ${finding.code}: ${finding.message}`);
  }
}

function main(argv) {
  if (argv.length === 0) {
    console.error("Usage: node scripts/lint-classic-knowledge-object-manifest.mjs <manifest-object.json> [...]");
    return 2;
  }
  const results = lintFiles(argv, { baseDir: process.cwd() });
  for (const result of results) {
    printResult(result);
  }
  const errorCount = results.reduce(
    (count, result) => count + result.findings.filter((finding) => finding.severity === "error").length,
    0,
  );
  const warningCount = results.reduce(
    (count, result) => count + result.findings.filter((finding) => finding.severity === "warning").length,
    0,
  );
  if (errorCount > 0) {
    console.error(`classic knowledge object manifest lint failed: ${errorCount} error(s), ${warningCount} warning(s).`);
    return 1;
  }
  console.log(`classic knowledge object manifest lint passed: ${results.length} file(s), ${warningCount} warning(s).`);
  return 0;
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
