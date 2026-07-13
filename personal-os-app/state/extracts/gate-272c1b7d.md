# gate
Format: JSON
Top-level: object
Size: 6
Nested depth: 3

## Schema

- taskId: string
- verifier: string
- checks: array (6 items)
- status: string
- verifiedAt: string
- residualRisks: array (2 items)

## Preview

```json
{
  "taskId": "cmqqxalrv000c0jpj83y7moe8",
  "verifier": "hermes-coding-lane",
  "checks": [
    {
      "name": "agent-context-unit-tests",
      "status": "pass",
      "evidence": "tests/services/agent-context.test.ts: 7 passed, 7 total",
      "command": "npm test -- --run tests/services/agent-context.test.ts"
    },
    {
      "name": "full-test-suite",
      "status": "pass",
      "evidence": "20 test files passed, 78 tests total",
      "command": "npm test -- --run"
    },
    {
      "name": "tsc",
      "status": "pass",
      "evidence": "npx tsc --noEmit: no errors",
      "command": "npx tsc --noEmit"
    },
    {
      "name": "lint",
      "status": "pass",
      "evidence": "eslint .: no errors after fixing any types in raw-manifest-ingest.test.ts",
      "command": "npm run lint"
    },
    {
      "name": "build",
      "status": "pass",
      "evidence": "next build succeeded with DATABASE_URL=postgresql://localhost:5432/dummy",
      "command": "DATABASE_URL=postgresql://localhost:5432/dummy npm run build",
      "note": "Build requires DATABASE_URL env var; this is a runtime dependency, not a code defect."
    },
    {
      "name": "api-integration",
      "status": "pass",
      "evidence": "GET /api/agent/context?q=agent%20executable%20tasks%20personal%20os%20wiki%20github%20radar returned tiers.hot with 5 P0/P1 agent_allowed tasks, tiers.warm with 1 wiki note, tiers.cold with 1 policy item",
      "command": "curl -s http://192.168.6.37:3100/api/agent/context?q=..."
…
```