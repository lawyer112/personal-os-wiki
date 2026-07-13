# worker-result
Format: JSON
Top-level: object
Size: 7
Nested depth: 3

## Schema

- task_id: string
- profile: string
- model: string
- run_at: string
- actions: array (4 items)
- blockers: array (1 items)
- next_recommendation: string

## Preview

```json
{
  "task_id": "agent-context-next-action-20260624",
  "profile": "obsidianmanager1",
  "model": "kimi-k2.7-code",
  "run_at": "2026-06-24T07:05:00+08:00",
  "actions": [
    {
      "step": 1,
      "action": "run github-radar-intake.mjs --intake --skip-seen --limit=8 --task-id=github-radar-cron",
      "result": "0 new repos, 0 new tasks (all deduplicated), registry total=8, intake ok, agentRunId=cmqr94810001m0js0jsf3ump9"
    },
    {
      "step": 2,
      "action": "verify uncommitted nextAction changes: tsc + tests + lint",
      "result": "tsc clean, 78 tests passed (20 test files), lint clean"
    },
    {
      "step": 3,
      "action": "commit nextAction changes to src/lib/agent-context.ts and tests/services/agent-context.test.ts",
      "result": "commit 649e9cd pushed to https://github.com/lawyer112/personal-os-wiki.git main"
    },
    {
      "step": 4,
      "action": "attempt deploy to 6.37 via SSH",
      "result": "SSH blocked (Permission denied publickey,password); deployment skipped, needs Classic SSH key"
    }
  ],
  "blockers": [
    "SSH to 6.37 blocked — cannot run docker compose build/up or copy files. Needs Classic SSH key or deploy webhook."
  ],
  "next_recommendation": "Provide SSH key for 6.37 to enable automated Docker deployment; or set up a deploy webhook that pulls from GitHub on push."
}

```