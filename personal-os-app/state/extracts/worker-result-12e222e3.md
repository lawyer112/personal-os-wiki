# worker-result
Format: JSON
Top-level: object
Size: 11
Nested depth: 2

## Schema

- task_id: string
- agent_id: string
- status: string
- summary: string
- artifacts: array (4 items)
- complete_http_status: number
- intake_http_status: number
- readback_http_status: number
- readback_task_status: string
- remaining_risks: array (1 items)
- validation: object (3 keys)

## Preview

```json
{
  "task_id": "cmr009fup01bu0jpkb1koq2h2",
  "agent_id": "obsidianmanager1",
  "status": "completed",
  "summary": "已关闭 Personal OS review 任务，实现 AgentRun context pack 自动归档 v0 的生命周期从 review 推进到 done。",
  "artifacts": [
    ".agent-runs/cmr009fup01bu0jpkb1koq2h2-close/complete-result.json",
    ".agent-runs/cmr009fup01bu0jpkb1koq2h2-close/intake-payload.json",
    ".agent-runs/cmr009fup01bu0jpkb1koq2h2-close/intake-result.json",
    ".agent-runs/cmr009fup01bu0jpkb1koq2h2-close/context-readback.json"
  ],
  "complete_http_status": 200,
  "intake_http_status": 201,
  "readback_http_status": 200,
  "readback_task_status": "done",
  "remaining_risks": [
    "本轮未部署；未改代码，仅关闭已 gate=pass 的任务。"
  ],
  "validation": {
    "lint": "pass",
    "test": "pass",
    "taskDone": true
  }
}
```