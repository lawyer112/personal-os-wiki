# gate
Format: JSON
Top-level: object
Size: 6
Nested depth: 3

## Schema

- taskId: string
- status: string
- synthesizer: object (1 keys)
- verifiedAt: string
- checks: object (4 keys)
- notes: string

## Preview

```json
{
  "taskId": "cmr28q5jt00ca0jnyxm8o03h0",
  "status": "pass",
  "synthesizer": {
    "allowed_to_announce_done": true
  },
  "verifiedAt": "2026-07-04T16:04:00Z",
  "checks": {
    "tsc": { "status": "pass", "errors": 0 },
    "vitest": {
      "status": "pass",
      "total": 145,
      "passed": 145,
      "failed": 0,
      "newTestsAdded": 5
    },
    "tokenLeakCheck": "pass",
    "deployRequired": false
  },
  "notes": "向量召回测试补齐：5 条新测试覆盖 happy path、relevance score 计算、agentmemory merge、降级（vector store 报错）、task-scoped projectId 过滤。全套 145 测试通过。"
}

```