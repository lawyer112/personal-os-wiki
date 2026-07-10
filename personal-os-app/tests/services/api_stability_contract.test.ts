import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  agentContextRequestSchema,
  intakeSchema,
  taskContributionSchema,
  taskSubmitSchema,
  wikiIngestSchema,
} from "@/lib/validation";

type TieredFields = {
  stable: string[];
  experimental: string[];
  internal: string[];
  deprecated: string[];
};

type ContractSurface = {
  request?: Record<string, TieredFields>;
  response?: Record<string, TieredFields>;
};

type StabilityContract = {
  version: string;
  lifecycle: {
    stabilityTiers: Record<string, { changePolicy: string }>;
    deprecationPolicy: {
      minimumNoticeDays: number;
      removalRequires: string[];
    };
  };
  surfaces: Record<string, ContractSurface>;
};

const contractPath = join(
  process.cwd(),
  "tests/fixtures/api_stability_contract_v0.json",
);
const docPath = join(process.cwd(), "docs/api_stability_contract_v0.md");

const readContract = () =>
  JSON.parse(readFileSync(contractPath, "utf8")) as StabilityContract;

const readDoc = () => readFileSync(docPath, "utf8");

const allFields = (fields: TieredFields) => [
  ...fields.stable,
  ...fields.experimental,
  ...fields.internal,
  ...fields.deprecated,
];

const expectUniqueClassification = (fields: TieredFields) => {
  const classified = allFields(fields);
  expect(new Set(classified).size).toBe(classified.length);
};

describe("Personal OS API Stability Contract v0", () => {
  it("publishes lifecycle rules and covers every v0 integration surface", () => {
    const contract = readContract();
    const doc = readDoc();
    const requiredSurfaces = [
      "GET /api/agent/context",
      "POST /api/agent/context",
      "POST /api/intake",
      "GET /api/wiki-write-jobs",
      "scripts/agent-writeback.mjs",
      "Personal Wiki frontmatter",
    ];

    expect(contract.version).toBe("v0");
    expect(Object.keys(contract.lifecycle.stabilityTiers).sort()).toEqual([
      "deprecated",
      "experimental",
      "internal",
      "stable",
    ]);
    expect(
      contract.lifecycle.stabilityTiers.stable.changePolicy,
    ).toContain("backward-compatible");
    expect(contract.lifecycle.deprecationPolicy.minimumNoticeDays).toBeGreaterThanOrEqual(
      14,
    );
    expect(contract.lifecycle.deprecationPolicy.removalRequires).toEqual(
      expect.arrayContaining(["contract test update", "migration note"]),
    );
    expect(Object.keys(contract.surfaces).sort()).toEqual(
      requiredSurfaces.sort(),
    );
    expect(doc).toContain("# Personal OS API Stability Contract v0");
    for (const surface of requiredSurfaces) {
      expect(doc).toContain(surface);
    }
  });

  it("keeps request contracts aligned with the existing validation schemas", () => {
    const contract = readContract();
    const intakeRequest = contract.surfaces["POST /api/intake"].request?.body;
    const contextRequest = contract.surfaces["POST /api/agent/context"].request?.body;
    const writebackContribution =
      contract.surfaces["scripts/agent-writeback.mjs"].request?.contributeBody;
    const writebackSubmit =
      contract.surfaces["scripts/agent-writeback.mjs"].request?.submitBody;
    const frontmatter =
      contract.surfaces["Personal Wiki frontmatter"].request?.frontmatter;

    expect(intakeRequest?.stable).toEqual(
      expect.arrayContaining([
        "source",
        "agent",
        "project",
        "wikiNotes",
        "tasks",
        "ideas",
        "projectEvents",
        "notes",
        "notification",
      ]),
    );
    expectUniqueClassification(intakeRequest!);
    expect(contextRequest?.stable).toContain("query");
    expect(contextRequest?.experimental).toEqual(
      expect.arrayContaining(["scope", "required_refs", "top_k", "budget"]),
    );
    expectUniqueClassification(contextRequest!);
    expect(() =>
      agentContextRequestSchema.parse({
        query: "Personal OS 外置记忆召回",
        scope: { projectName: "Personal OS" },
        required_refs: [
          {
            memory_id: "wiki:vault/memory-eval.md",
            version: 3,
            chunk_id: "结论",
          },
        ],
        top_k: 5,
        budget: { tokens: 900 },
      }),
    ).not.toThrow();
    expect(() =>
      intakeSchema.parse({
        source: {
          sourceType: "agent-output",
          sourcePlatform: "codex-autodrive",
          rawText: "Stability contract fixture",
        },
        agent: {
          model: "codex-autodrive",
          classification: { kind: "contract-test" },
          reasoningSummary: "Schema alignment check.",
          outputSummary: "Schema alignment check.",
        },
        project: { name: "Personal OS / Wiki knowledge upgrade" },
        wikiNotes: [
          {
            title: "Personal OS API Stability Contract v0",
            content: "Contract body",
            source_type: "agent-output",
            tags: ["personal-os", "api-contract"],
          },
        ],
        tasks: [
          {
            title: "Review API Stability Contract v0",
            nextAction: "Review stable and experimental fields.",
            definitionOfDone: "Contract is accepted or changes requested.",
          },
        ],
        ideas: [{ title: "Contract v1", body: "Future contract hardening." }],
        projectEvents: [
          { title: "Contract v0 drafted", body: "Published v0.", eventType: "contract" },
        ],
        notes: [{ title: "Contract note", body: "Published v0." }],
        notification: { recipient: "dry-run", projectName: "Personal OS" },
      }),
    ).not.toThrow();

    expect(writebackContribution?.stable).toEqual(
      expect.arrayContaining([
        "agentId",
        "summary",
        "evidenceLinks",
        "artifactUrls",
        "nextRecommendation",
      ]),
    );
    expect(writebackSubmit?.stable).toEqual(
      expect.arrayContaining([
        "resultType",
        "definitionOfDoneMet",
        "needsHumanDecision",
      ]),
    );
    expectUniqueClassification(writebackContribution!);
    expectUniqueClassification(writebackSubmit!);
    expect(() =>
      taskContributionSchema.parse({
        agentId: "codex-autodrive",
        summary: "Contract test contribution.",
        evidenceLinks: ["tests/services/api_stability_contract.test.ts"],
        artifactUrls: ["docs/api_stability_contract_v0.md"],
        nextRecommendation: "Review contract.",
      }),
    ).not.toThrow();
    expect(() =>
      taskSubmitSchema.parse({
        agentId: "codex-autodrive",
        summary: "Contract test submit.",
        evidenceLinks: ["tests/services/api_stability_contract.test.ts"],
        artifactUrls: ["docs/api_stability_contract_v0.md"],
        resultType: "artifact",
        definitionOfDoneMet: true,
        needsHumanDecision: true,
      }),
    ).not.toThrow();

    expect(frontmatter?.stable).toEqual(
      expect.arrayContaining([
        "title",
        "type",
        "created_by",
        "source_type",
        "tags",
        "created_at",
        "task_id",
      ]),
    );
    expectUniqueClassification(frontmatter!);
    expect(() =>
      wikiIngestSchema.parse({
        title: "Personal OS API Stability Contract v0",
        content: "Contract body",
        source_type: "agent-output",
        tags: ["personal-os", "api-contract"],
        frontmatter: {
          title: "Personal OS API Stability Contract v0",
          type: "decision-record",
          created_by: "hermes:worker",
          source_type: "agent-output",
          tags: ["personal-os", "api-contract"],
          created_at: "2026-07-06T01:11:21.797Z",
          task_id: "cmr8iu2mv03bh0jp8d102fxkb",
          agent_id: "codex-autodrive",
          project: "Personal OS / Wiki 知识库升级",
        },
      }),
    ).not.toThrow();
  });

  it("classifies the current agent context and WikiWriteJob response envelopes", () => {
    const contract = readContract();
    const contextResponse =
      contract.surfaces["GET /api/agent/context"].response?.context;
    const wikiWriteJobResponse =
      contract.surfaces["GET /api/wiki-write-jobs"].response?.job;
    const expectedContextFields = [
      "generatedAt",
      "task",
      "searchQueries",
      "queryPlan",
      "requiredRefs",
      "wiki",
      "swarmvault",
      "recentTasks",
      "relatedIdeas",
      "activity",
      "evidence",
      "debug",
      "memoryItems",
      "tokenBudget",
      "budget",
      "cited",
      "omissions",
      "nextAction",
      "tiers",
      "policy",
    ];

    expect(contextResponse?.stable).toEqual(
      expect.arrayContaining([
        "generatedAt",
        "task",
        "searchQueries",
        "wiki",
        "recentTasks",
        "relatedIdeas",
        "activity",
        "evidence",
        "nextAction",
        "tiers",
        "policy",
      ]),
    );
    expect(contextResponse?.experimental).toEqual(
      expect.arrayContaining([
        "swarmvault",
        "queryPlan",
        "requiredRefs",
        "memoryItems",
        "tokenBudget",
        "budget",
        "cited",
        "omissions",
      ]),
    );
    expect(contextResponse?.internal).toContain("debug");
    expect(allFields(contextResponse!).sort()).toEqual(
      expectedContextFields.sort(),
    );
    expectUniqueClassification(contextResponse!);

    expect(wikiWriteJobResponse?.stable).toEqual(
      expect.arrayContaining([
        "id",
        "runId",
        "status",
        "requested",
        "queued",
        "succeeded",
        "failed",
        "taskIds",
        "model",
        "sourcePlatform",
        "summary",
        "startedAt",
        "completedAt",
      ]),
    );
    expect(wikiWriteJobResponse?.experimental).toEqual(
      expect.arrayContaining(["review", "candidate"]),
    );
    expectUniqueClassification(wikiWriteJobResponse!);
  });

  it("does not publish concrete secrets in contract artifacts", () => {
    const combined = `${readFileSync(contractPath, "utf8")}\n${readDoc()}`;
    const forbiddenSecretPatterns = [
      /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/,
      /PERSONAL_OS_(READ_)?TOKEN\s*=/,
      /WIKI_(READ_)?TOKEN\s*=/,
      /SMTP_[A-Z_]*PASSWORD\s*=/,
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    ];

    for (const pattern of forbiddenSecretPatterns) {
      expect(combined).not.toMatch(pattern);
    }
  });
});
