# gate
Format: JSON
Top-level: object
Size: 6
Nested depth: 3

## Schema

- task_id: string
- status: string
- verified_at: string
- checks: array (5 items)
- deployment: object (2 keys)
- synthesizer: object (1 keys)

## Preview

```json
{
  "task_id": "cmr009fup01bu0jpkb1koq2h2",
  "status": "pass",
  "verified_at": "2026-06-30T22:13:58.722Z",
  "checks": [
    {
      "name": "POST /api/tasks/cmr009fup01bu0jpkb1koq2h2/complete",
      "status": "pass",
      "evidence": ".agent-runs/cmr009fup01bu0jpkb1koq2h2-close/complete-result.json",
      "task_status": "done"
    },
    {
      "name": "POST /api/intake writeback",
      "status": "pass",
      "evidence": ".agent-runs/cmr009fup01bu0jpkb1koq2h2-close/intake-result.json"
    },
    {
      "name": "GET /api/agent/context readback",
      "status": "pass",
      "evidence": ".agent-runs/cmr009fup01bu0jpkb1koq2h2-close/context-readback.json"
    },
    {
      "name": "npm run lint",
      "status": "pass",
      "log": ".agent-runs/cmr009fup01bu0jpkb1koq2h2-close/lint.log"
    },
    {
      "name": "npm test",
      "status": "pass",
      "log": ".agent-runs/cmr009fup01bu0jpkb1koq2h2-close/test.log",
      "summary": "21 files / 83 tests passed"
    }
  ],
  "deployment": {
    "status": "not_needed",
    "reason": "只执行 Personal OS 任务生命周期关闭和写回，不改代码、不改运行中服务。"
  },
  "synthesizer": {
    "allowed_to_announce_done": true
  }
…
```