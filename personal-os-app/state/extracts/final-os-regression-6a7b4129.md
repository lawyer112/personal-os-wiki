# final-os-regression
Format: JSON
Top-level: object
Size: 11
Nested depth: 2

## Schema

- completed_task_id: string
- completed_status: string
- completedAt: string
- followup_task_id: string
- followup_status: string
- followup_priority: string
- followup_executionMode: string
- followup_agentTags: array (6 items)
- followup_in_agent_inbox: boolean
- remaining_agent_inbox_count: number
- completed_task_still_in_agent_inbox: boolean

## Preview

```json
{
  "completed_task_id": "cmqq2o6lz000w0jmj9mfh4cer",
  "completed_status": "done",
  "completedAt": "2026-06-23T14:14:14.046Z",
  "followup_task_id": "cmqqqgfgm001r0jocadvkeqzz",
  "followup_status": "todo",
  "followup_priority": "P1",
  "followup_executionMode": "agent_allowed",
  "followup_agentTags": [
    "wiki",
    "personal-wiki",
    "manifest",
    "raw",
    "ingest",
    "script"
  ],
  "followup_in_agent_inbox": true,
  "remaining_agent_inbox_count": 3,
  "completed_task_still_in_agent_inbox": false
}

```