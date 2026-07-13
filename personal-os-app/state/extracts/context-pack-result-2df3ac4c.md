# context-pack-result
Format: JSON
Top-level: object
Size: 8
Nested depth: 4

## Schema

- ok: boolean
- targetTaskId: string
- archiveTaskId: string
- out: string
- runDir: string
- taskTitle: string
- gateStatus: string
- intake: object (4 keys)

## Preview

```json
{
  "ok": true,
  "targetTaskId": "cmqqxals8000f0jpj7dgqj12m",
  "archiveTaskId": "cmqqxals8000f0jpj7dgqj12m",
  "out": ".agent-runs/cmqqxals8000f0jpj7dgqj12m",
  "runDir": ".agent-runs/cmqqxals8000f0jpj7dgqj12m",
  "taskTitle": "实现 AgentRun context pack 自动归档 v0",
  "gateStatus": "pass",
  "intake": {
    "ok": true,
    "agentRunId": "cmqr1mg8f00040jpmnjwmgk6b",
    "wiki_write_status": {
      "status": "ok",
      "requested": 1,
      "succeeded": 1,
      "failed": 0,
      "errors": []
    },
    "wiki": [
      {
        "ok": true,
        "title": "AgentRun context pack cmqqxals8000f0jpj7dgqj12m 2026-06-23",
        "status": "created"
      }
    ]
  }
}

```