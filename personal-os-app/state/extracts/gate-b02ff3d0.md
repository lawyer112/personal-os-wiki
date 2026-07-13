# gate
Format: JSON
Top-level: object
Size: 6
Nested depth: 3

## Schema

- task_id: string
- status: string
- verified_at: string
- checks: array (4 items)
- deployment: object (2 keys)
- synthesizer: object (1 keys)

## Preview

```json
{
  "task_id": "cmqyixt4a00n90jpk3todreos",
  "status": "pass",
  "verified_at": "2026-06-30T19:19:14Z",
  "checks": [
    {
      "name": "POST /api/tasks/{id}/review approve",
      "status": "pass",
      "evidence": ".agent-runs/cmqyixt4a00n90jpk3todreos-review-close/review-result.json"
    },
    {
      "name": "POST /api/intake writeback with nested source schema",
      "status": "pass",
      "evidence": ".agent-runs/cmqyixt4a00n90jpk3todreos-review-close/intake-result.json"
    },
    {
      "name": "GET /api/agent/context readback",
      "status": "pass",
      "evidence": ".agent-runs/cmqyixt4a00n90jpk3todreos-review-close/context-readback.json"
    },
    {
      "name": "code validation",
      "status": "not_needed",
      "reason": "本轮只调用 Personal OS API 关闭 review 任务，不修改代码；原任务 gate 已记录 npm install/lint pass。"
    }
  ],
  "deployment": {
    "status": "not_needed",
    "reason": "本轮只关闭 Personal OS review 任务，不改运行时代码。"
  },
  "synthesizer": {
    "allowed_to_announce_done": true
  }
}
```