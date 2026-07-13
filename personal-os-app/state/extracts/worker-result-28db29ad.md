# worker-result
Format: JSON
Top-level: object
Size: 8
Nested depth: 3

## Schema

- taskId: string
- taskTitle: string
- status: string
- agentId: string
- startedAt: string
- completedAt: string
- summary: string
- steps: array (4 items)

## Preview

```json
{
  "taskId": "cmqq2o6ey000q0jmjcrv03ujr",
  "taskTitle": "修复 Personal Wiki 读接口鉴权：对齐 WIKI_READ_TOKEN",
  "status": "done",
  "agentId": "obsidianmanager1",
  "startedAt": "2026-06-23T22:06:00Z",
  "completedAt": "2026-06-23T22:08:00Z",
  "summary": "Agent 自验证完成：Wiki 读接口已正常工作。无需修改代码或重启服务。",
  "steps": [
    {
      "step": 1,
      "action": "验证 WIKI_READ_TOKEN 调 /api/tags",
      "result": "HTTP 200，返回 72 个 tags",
      "evidence": "node fetch http://192.168.6.37:3422/api/tags with WIKI_READ_TOKEN -> 200"
    },
    {
      "step": 2,
      "action": "验证 WIKI_READ_TOKEN 调 /api/notes",
      "result": "HTTP 200，返回 20 条 notes",
      "evidence": "node fetch http://192.168.6.37:3422/api/notes?limit=1 with WIKI_READ_TOKEN -> 200"
    },
    {
      "step": 3,
      "action": "验证 Personal OS /api/agent/context 返回 Wiki candidates",
      "result": "HTTP 200，返回 2+ 条 Wiki candidates，含 title/path/tags/excerpt",
      "evidence": "node fetch http://192.168.6.37:3100/api/agent/context?q=personal+os+wiki -> ok, candidates.length > 0"
    },
    {
      "step": 4,
      "action": "更新任务状态为 done",
      "result": "PATCH /api/tasks/cmqq2o6ey000q0jmjcrv03ujr -> 200",
      "evidence": "Personal OS API response: status=done"
    }
  ]
}

```