# worker-result
Format: JSON
Top-level: object
Size: 9
Nested depth: 3

## Schema

- task_id: string
- run_at: string
- agent: string
- steps: array (6 items)
- related_tasks: array (4 items)
- artifacts: array (5 items)
- wiki_note: string
- remaining_risk: string
- outcome: string

## Preview

```json
{
  "task_id": "github-radar-cron",
  "run_at": "2026-07-01T13:00:00Z",
  "agent": "obsidianmanager1",
  "steps": [
    {"step": 1, "action": "call /api/agent/context?q=agent executable tasks personal os wiki", "result": "ok, no wiki candidates; no P0/P1 agent_allowed pending tasks"},
    {"step": 2, "action": "check /api/tasks for owner=agent status=todo/doing/review", "result": "0 pending; only 1 demo task, already status=done"},
    {"step": 3, "action": "run github-radar-intake.mjs --intake --limit=8 --task-id=github-radar-cron", "result": "8 repos scanned, registry 16->17 (+1 new), 4 candidate tasks generated (dedup 4->4, all new), intake ok"},
    {"step": 4, "action": "verify Personal OS write", "result": "4 new tasks created under project 'Personal OS / Wiki 知识库升级' (P0 x2, P1 x2), 1 ProjectEvent created"},
    {"step": 5, "action": "verify Wiki write", "result": "wiki-write-job queued then completed; GET /api/wiki-write-jobs?status=queued returns 0; note confirmed via /api/notes search"},
    {"step": 6, "action": "confirm no token leakage", "result": "grep on repos.json/evidence.md/adoption-tasks.json found no bearer/token strings"}
  ],
  "related_tasks": [
    "cmr23a5v6005l0jnyxujhw83y",
    "cmr23a5vp005n0jnyysgdn3pk",
    "cmr23a5w1005p0jnytk7f1ntr",
    "cmr23a5wc005r0jnyy3u1exxc"
  ],
  "artifacts": [
    ".agent-runs/github-radar-20260701/repos.json",
    ".agent-runs/github-radar-20260701/evidence.md",
    ".agent-runs/github-radar-20260701/adoption-tasks.json",
    ".agent-runs/github-radar-20260701/intake-payload.json",
    ".agent-runs/github-radar-20260701/intake-result.json"
  ],
  "wiki_note": "vault/20_notes/2026-07-01/github-知识雷达-2026-07-01-personal-os-wiki-自驱候选-2.md",
  "remaining_risk": "4 new candidate tasks (github-radar generated) are still status=todo, ownerAgent=null — not yet claimed/executed by any agent. Next cron run should pick one and implement it instead of running the radar again if tasks remain unclaimed.",
  "outcome": "success"
}

```