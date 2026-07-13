# run
Format: JSON
Top-level: object
Size: 9
Nested depth: 2

## Schema

- task_id: string
- created_at: string
- updated_at: string
- profile: string
- lane: string
- repo: string
- worktree: string
- artifact_dir: string
- constraints: array (3 items)

## Preview

```json
{
  "task_id": "hermes-e2e-os-canary",
  "created_at": "2026-06-23T11:32:28+08:00",
  "updated_at": "2026-06-23T11:33:29+08:00",
  "profile": "config-assistant",
  "lane": "codex",
  "repo": "/Users/xingqiwu/Documents/New project 2",
  "worktree": "/Users/xingqiwu/Documents/New project 2/.agent-runs/hermes-e2e-os-canary/worktree",
  "artifact_dir": "/Users/xingqiwu/Documents/New project 2/.agent-runs/hermes-e2e-os-canary",
  "constraints": [
    "do not expose secrets",
    "record stdout, stderr, exit code, diff, and verification",
    "do not announce final completion unless gate.json passes"
  ]
}

```