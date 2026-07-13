# worker-result
Format: JSON
Top-level: object
Size: 8
Nested depth: 2

## Schema

- task_id: string
- agent_id: string
- status: string
- summary: string
- artifacts: array (4 items)
- review_status: string
- intake_http_status: number
- remaining_risks: array (1 items)

## Preview

```json
{
  "task_id": "cmqyixt4a00n90jpk3todreos",
  "agent_id": "obsidianmanager1",
  "status": "completed",
  "summary": "关闭 P0 GitHub 雷达 agentmemory 评估任务，并修正 /api/intake 写回结构完成归档。",
  "artifacts": [
    ".agent-runs/cmqyixt4a00n90jpk3todreos-review-close/review-result.json",
    ".agent-runs/cmqyixt4a00n90jpk3todreos-review-close/intake-payload.json",
    ".agent-runs/cmqyixt4a00n90jpk3todreos-review-close/intake-result.json",
    ".agent-runs/cmqyixt4a00n90jpk3todreos-review-close/context-readback.json"
  ],
  "review_status": "done",
  "intake_http_status": 201,
  "remaining_risks": [
    "外部 benchmark 未本机复现；不直接安装 agentmemory，避免双真相源。"
  ]
}
```