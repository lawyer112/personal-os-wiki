# worker-result
Format: JSON
Top-level: object
Size: 8
Nested depth: 3

## Schema

- taskId: string
- title: string
- status: string
- startedAt: string
- completedAt: string
- artifacts: array (4 items)
- summary: string
- nextRecommendation: string

## Preview

```json
{
  "taskId": "cmqqxalrv000c0jpj83y7moe8",
  "title": "把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0",
  "status": "completed",
  "startedAt": "2026-06-24T02:16:00Z",
  "completedAt": "2026-06-24T02:22:00Z",
  "artifacts": [
    {
      "type": "code",
      "path": "src/lib/agent-context.ts",
      "description": "Added AgentContextTierItem, AgentContextTiers types and buildContextTiers function to sort tasks/wiki/ideas/activity into hot/warm/cold tiers"
    },
    {
      "type": "code",
      "path": "src/app/api/agent/context/route.ts",
      "description": "Pass prisma to getQueryAgentContext so keyword queries can fetch P0/P1 agent_allowed tasks from the database"
    },
    {
      "type": "test",
      "path": "tests/services/agent-context.test.ts",
      "description": "Regression tests for keyword tiering and current-task tiering"
    },
    {
      "type": "lint-fix",
      "path": "tests/services/raw-manifest-ingest.test.ts",
      "description": "Replaced explicit any types with inline object types to satisfy eslint"
    }
  ],
  "summary": "Implemented hot/warm/cold tiering in /api/agent/context. Hot tier contains current task + P0/P1 agent_allowed tasks or recent blockers. Warm tier contains matched Wiki notes (top 3 or score>=30), related tasks, and P0/P1 ideas. Cold tier contains lower-priority items and the standing agent policy. All tests pass. tsc clean. lint clean. build passes with DATABASE_URL.",
  "nextRecommendation": "Deploy to 6.37 and verify /api/agent/context?q=personal%20os%20wiki returns tiers with hot tasks."
}
```