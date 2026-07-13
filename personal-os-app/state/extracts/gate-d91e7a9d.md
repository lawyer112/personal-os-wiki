# gate
Format: JSON
Top-level: object
Size: 8
Nested depth: 4

## Schema

- task_id: string
- status: string
- reviewer: object (3 keys)
- verifier: object (3 keys)
- deployment: object (4 keys)
- synthesizer: object (3 keys)
- writeback: object (3 keys)
- production_regression: object (2 keys)

## Preview

```json
{
  "task_id": "cmqqfl6hp00070jn5bgoym7dx",
  "status": "pass",
  "reviewer": {
    "status": "pass",
    "findings": [],
    "notes": "Code diff is scoped to agent-context service, route wiring, and agent-context tests; compatibility fields are preserved."
  },
  "verifier": {
    "status": "pass",
    "commands": [
      {
        "cmd": "npm test -- tests/services/agent-context.test.ts",
        "exit_code": 0,
        "evidence": "artifacts/test-agent-context.log"
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
        "cmd": "npm test",
        "exit_code": 0,
        "evidence": "artifacts/npm-test.log"
      },
      {
        "cmd": "DATABASE_URL=postgresql://user:<stub>@127.0.0.1:5432/personal_os_build_stub npm run build",
        "exit_code": 0,
        "evidence": "artifacts/build-with-database-url-stub.log"
      }
    ],
    "screenshots": []
  },
  "deployment": {
…
```