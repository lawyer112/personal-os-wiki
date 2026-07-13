# worker-result
Format: JSON
Top-level: object
Size: 15
Nested depth: 4

## Schema

- task_id: string
- agent_id: string
- status: string
- started_at: string
- ended_at: string
- summary: string
- changed_files: array (4 items)
- diff_path: string
- diff_stat: string
- commands: array (11 items)
- context_pack: object (6 keys)
- risks: array (3 items)
- blocked_reason: string
- writeback: object (6 keys)
- deployment: object (5 keys)

## Preview

```json
{
  "task_id": "cmqqfl6rk00090jn58kastmq9",
  "agent_id": "obsidianmanager1",
  "status": "blocked_on_deployment",
  "started_at": "2026-06-23T11:09:00.921888+00:00",
  "ended_at": "2026-06-23T11:22:12.460317+00:00",
  "summary": "Implemented AgentRun context pack archiver, added tests, fixed taskUpdateSchema partial PATCH default regression, ran sample dry-run on cmqqb0d7h00050jnsh6q221l1, ran real intake on cmqqfl6hp00070jn5bgoym7dx, and verified the Personal Wiki note contains task_id/gate/diff/tests/deployment/residual risks. Local verification passed; 6.37 deploy is blocked because this cron runtime lacks /data release tree, SSH access, and Docker daemon.",
  "changed_files": [
    "personal-os-app/scripts/archive-agent-run-context-pack.mjs",
    "personal-os-app/tests/services/agent-run-context-pack.test.ts",
    "personal-os-app/src/lib/validation.ts",
    "personal-os-app/tests/services/tasks.test.ts"
  ],
  "diff_path": "diff.patch",
  "diff_stat": ".../scripts/archive-agent-run-context-pack.mjs     | 524 +++++++++++++++++++++\n personal-os-app/src/lib/validation.ts              |  50 +-\n .../tests/services/agent-run-context-pack.test.ts  | 113 +++++\n personal-os-app/tests/services/tasks.test.ts       |  10 +\n 4 files changed, 690 insertions(+), 7 deletions(-)",
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
…
```