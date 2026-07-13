# worker-result
Format: JSON
Top-level: object
Size: 16
Nested depth: 4

## Schema

- taskId: string
- taskTitle: string
- agentId: string
- timestamp: string
- status: string
- summary: string
- changedFiles: array (2 items)
- observedRelatedWorkingTreeChanges: array (5 items)
- exampleResponseShape: object (3 keys)
- tests: array (4 items)
- residualRisk: string
- deployed: boolean
- deployment: object (5 keys)
- productionEvidence: array (5 items)
- followUpTask: object (3 keys)
- updatedAt: string

## Preview

```json
{
  "taskId": "cmqq2o6gt000s0jmjpc2aqnbp",
  "taskTitle": "准备 /api/intake 带 wikiNotes 500 的本地补丁和回归测试",
  "agentId": "obsidianmanager1",
  "timestamp": "2026-06-23T09:23:56.139217+00:00",
  "status": "deployed",
  "summary": "/api/intake wikiNotes fallback regression is verified and deployed to 6.37. Local focused/full tests, lint and Next build passed; 6.37 personal-os was rebuilt/restarted; production /api/intake with wikiNotes+task returned 201 with structured Wiki error instead of failing the OS write; canary task archived; original task approved done; deployment Wiki record written with explicit frontmatter.",
  "changedFiles": [
    "tests/routes/intake-wiki-fallback.test.ts",
    "tests/services/wiki-ingest.test.ts"
  ],
  "observedRelatedWorkingTreeChanges": [
    "src/lib/wiki-client.ts",
    "src/lib/wiki-ingest.ts",
    "src/app/wiki/page.tsx",
    "vitest.config.ts",
    "tests/services/wiki-client.test.ts"
  ],
  "exampleResponseShape": {
    "ok": true,
    "tasks": [
      {
        "id": "task_1",
        "title": "OS fallback task",
        "status": "todo"
      }
    ],
    "wiki": [
      {
        "ok": false,
        "title": "Wiki fallback demo",
        "error": "Personal Wiki returned 500"
      }
    ]
  },
  "tests": [
    {
      "name": "focused intake/wiki fallback tests",
      "command": "npm test -- --run tests/routes/intake-wiki-fallback.test.ts tests/services/wiki-ingest.test.ts tests/services/wiki-client.test.ts",
      "status": "pass",
…
```