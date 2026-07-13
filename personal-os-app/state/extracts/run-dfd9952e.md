# run
Format: JSON
Top-level: object
Size: 8
Nested depth: 2

## Schema

- task_id: string
- created_at: string
- updated_at: string
- profile: string
- agent_id_used_for_task: string
- repo: string
- artifact_dir: string
- constraints: array (4 items)

## Preview

```json
{
  "task_id": "cmqqb0d7h00050jnsh6q221l1",
  "created_at": "2026-06-23T16:19:58+08:00",
  "updated_at": "2026-06-23T16:19:58+08:00",
  "profile": "obsidianmanager1",
  "agent_id_used_for_task": "hermes",
  "repo": "/Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app",
  "artifact_dir": "/Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqqb0d7h00050jnsh6q221l1",
  "constraints": [
    "no production deploy",
    "no 6.37 service restart",
    "no production database modification",
    "no secrets printed"
  ]
}

```