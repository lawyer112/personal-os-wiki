# gate
Format: JSON
Top-level: object
Size: 8
Nested depth: 3

## Schema

- task_id: string
- timestamp: string
- status: string
- actions: array (9 items)
- verifier: object (2 keys)
- ci: object (3 keys)
- deployment: object (4 keys)
- production_regression: object (2 keys)

## Preview

```json
{
  "task_id": "github-radar-cron",
  "timestamp": "2026-06-24T09:24:00Z",
  "status": "pass",
  "actions": [
    {
      "name": "github-radar-intake",
      "cmd": "node scripts/github-radar-intake.mjs --intake --limit=8 --task-id=github-radar-cron",
      "exit_code": 0,
      "result": "repos=8, tasks=0 (dedup), registry=8 entries, wiki_write_status=ok, agentRunId=cmqre4akm000f0jnt81a1kbtx"
    },
    {
      "name": "test-suite",
      "cmd": "npm test",
      "exit_code": 0,
      "result": "78 tests passed (20 test files)"
    },
    {
      "name": "type-check",
      "cmd": "npx tsc --noEmit",
      "exit_code": 0,
      "result": "no type errors"
    },
    {
      "name": "lint",
      "cmd": "npm run lint",
      "exit_code": 0,
      "result": "eslint clean"
    },
    {
      "name": "commit-and-push",
      "cmd": "git add src/lib/validation.ts && git commit -m 'feat(wiki-ingest): ...' && git push origin main",
      "exit_code": 0,
      "result": "commit 6602d1f pushed to github.com/lawyer112/personal-os-wiki"
    },
    {
      "name": "ci-wait",
      "cmd": "poll GitHub Actions run 28068772550",
      "exit_code": 0,
      "result": "conclusion=success"
…
```