# worker-result
Format: JSON
Top-level: object
Size: 14
Nested depth: 3

## Schema

- task_id: string
- agent_id: string
- status: string
- started_at: null
- ended_at: string
- summary: string
- changed_files: array (3 items)
- diff_path: string
- diff_stat: string
- commands: array (15 items)
- risks: array (1 items)
- blocked_reason: null
- writeback: object (7 keys)
- deployment: object (7 keys)

## Preview

```json
{
  "task_id": "cmqqfl6hp00070jn5bgoym7dx",
  "agent_id": "hermes",
  "status": "done",
  "started_at": null,
  "ended_at": "2026-06-23T10:31:39.404501+00:00",
  "summary": "Implemented and deployed /api/agent/context hot/warm/cold tiers to 6.37. Local test/tsc/lint/build passed; remote files were backed up, copied, hash-verified, docker compose rebuilt/restarted personal-os, and production regression confirmed tiers plus compatibility fields.",
  "changed_files": [
    "personal-os-app/src/app/api/agent/context/route.ts",
    "personal-os-app/src/lib/agent-context.ts",
    "personal-os-app/tests/services/agent-context.test.ts"
  ],
  "diff_path": "diff.patch",
  "diff_stat": "personal-os-app/src/app/api/agent/context/route.ts |   2 +-\n personal-os-app/src/lib/agent-context.ts           | 305 ++++++++++++++++++++-\n .../tests/services/agent-context.test.ts           | 111 ++++++++\n 3 files changed, 409 insertions(+), 9 deletions(-)",
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
    },
…
```