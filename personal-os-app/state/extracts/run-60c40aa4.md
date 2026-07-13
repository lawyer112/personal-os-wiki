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
- agent_id_used_for_task: string
- repo: string
- artifact_dir: string
- source_context: object (2 keys)
- constraints: array (4 items)

## Preview

```json
{
  "task_id": "cmqq4eqa800340jmjz1go2euo",
  "created_at": "2026-06-23T16:40:36+08:00",
  "updated_at": "2026-06-23T16:51:14+08:00",
  "profile": "obsidianmanager1",
  "agent_id_used_for_task": "hermes",
  "repo": "/Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app",
  "artifact_dir": "/Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq4eqa800340jmjz1go2euo",
  "source_context": {
    "personal_os_context_query": "Personal OS Wiki 自驱执行器 P0 agent_allowed doing todo",
    "council_report": "../../../../.agent-runs/personal-os-evolution-council-20260623/council-report-v1.md"
  },
  "constraints": [
    "no production deploy",
    "no 6.37 service restart",
    "no production database modification",
    "no secrets printed"
  ]
}

```