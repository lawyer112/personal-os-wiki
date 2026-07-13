# worker-result
Format: JSON
Top-level: object
Size: 8
Nested depth: 2

## Schema

- taskId: string
- agentId: string
- startedAt: string
- completedAt: string
- summary: string
- artifacts: array (6 items)
- verification: object (2 keys)
- nextRecommendation: string

## Preview

```json
{
  "taskId": "memory-vector-backfill-cron",
  "agentId": "obsidianmanager1",
  "startedAt": "2026-07-04T01:00:00Z",
  "completedAt": "2026-07-04T01:01:58Z",
  "summary": "Backfilled recent P0/P1 Personal OS tasks into MemoryItem table and verified /api/agent/context returns vector episodes",
  "artifacts": [
    "scripts/memory-vector-eval.mts",
    "scripts/backfill-memory-items.mjs",
    "src/lib/memory-vector-store.ts",
    "src/lib/agent-context.ts",
    "tests/memory-vector-store.test.ts",
    "tests/services/agent-context.test.ts"
  ],
  "verification": {
    "tests": "npm run test (115 passed)",
    "contextEndpoint": "GET /api/agent/context?q=memory%20vector%20recall returns P0 task cmr28q5jt00ca0jnyxm8o03h0 in hot tier"
  },
  "nextRecommendation": "Seed MemoryItem table with real task/activity rows and run scripts/memory-vector-eval.mts --seed --limit=50"
}

```