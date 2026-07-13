# gate
Format: JSON
Top-level: object
Size: 9
Nested depth: 4

## Schema

- task_id: string
- status: string
- reviewer: object (3 keys)
- verifier: object (3 keys)
- wiki_writeback: object (3 keys)
- deployment: object (5 keys)
- production_regression: object (2 keys)
- synthesizer: object (3 keys)
- writeback: object (3 keys)

## Preview

```json
{
  "task_id": "cmqqfl6rk00090jn58kastmq9",
  "status": "pass",
  "reviewer": {
    "status": "pass",
    "findings": [],
    "notes": "Deployment completed on 6.37 via ub37 SSH. Docker build and up succeeded. Production regression verified: /api/today, /api/agent/context, /api/tasks all return 200 ok. PATCH partial update preserves priority/executionMode (taskUpdateSchema regression fixed)."
  },
  "verifier": {
    "status": "pass",
    "commands": [
      {
        "cmd": "node --check scripts/archive-agent-run-context-pack.mjs",
        "exit_code": 0,
        "evidence": "artifacts/node-check-context-pack.log"
      },
      {
        "cmd": "npm test -- tests/services/agent-run-context-pack.test.ts tests/services/tasks.test.ts",
        "exit_code": 0,
        "evidence": "artifacts/test-context-pack-tasks.log"
      },
      {
        "cmd": "npm test",
        "exit_code": 0,
        "evidence": "artifacts/npm-test.log"
      },
      {
        "cmd": "npx tsc --noEmit",
        "exit_code": 0,
        "evidence": "artifacts/tsc.log"
      },
      {
        "cmd": "npm run lint",
        "exit_code": 0,
        "evidence": "artifacts/lint.log"
      },
      {
        "cmd": "npm run build",
        "exit_code": 0,
        "evidence": "artifacts/build.log"
…
```