# worker-result
Format: JSON
Top-level: object
Size: 6
Nested depth: 3

## Schema

- task_id: string
- run_at: string
- agent: string
- steps: array (10 items)
- related_tasks: array (3 items)
- artifacts: array (6 items)

## Preview

```json
{
  "task_id": "github-radar-cron",
  "run_at": "2026-06-24T09:24:00Z",
  "agent": "obsidianmanager1",
  "steps": [
    {
      "step": 1,
      "action": "call /api/agent/context",
      "result": "ok, no agent-executable P0/P1 tasks found; 3 review tasks in approval_required"
    },
    {
      "step": 2,
      "action": "run github-radar-intake.mjs --intake --limit=8 --task-id=github-radar-cron",
      "result": "8 repos scanned, 0 new tasks (dedup), intake ok, wiki_write ok"
    },
    {
      "step": 3,
      "action": "verify repo health",
      "result": "78 tests pass, tsc clean, lint clean"
    },
    {
      "step": 4,
      "action": "commit uncommitted validation.ts frontmatter change",
      "result": "commit 6602d1f pushed to origin main"
    },
    {
      "step": 5,
      "action": "wait for CI",
      "result": "CI run 28068772550 conclusion=success"
    },
    {
      "step": 6,
      "action": "backup remote release dir",
      "result": "backup /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260624-013744"
    },
    {
      "step": 7,
      "action": "clone latest code and copy to remote release",
      "result": "cloned 6602d1f to /tmp/personal-os-wiki-deploy, copied to 8ade72d/personal-os-app"
    },
…
```