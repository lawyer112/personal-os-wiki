# gate
Format: JSON
Top-level: object
Size: 7
Nested depth: 3

## Schema

- task_id: string
- status: string
- checks: array (2 items)
- deployment: object (2 keys)
- residual_risks: array (2 items)
- verified_at: string
- synthesizer: object (1 keys)

## Preview

```json
{
  "task_id": "cmr009fvb01bx0jpk7yhseb6u",
  "status": "pass",
  "checks": [
    {
      "name": "npm test -- tests/services/agent-context.test.ts",
      "status": "pass",
      "summary": "11 tests passed"
    },
    {
      "name": "npm run build",
      "status": "pass",
      "summary": "Next.js production build passed after loading local env with DATABASE_URL"
    }
  ],
  "deployment": {
    "status": "not_deployed",
    "reason": "代码改动已验证，但本轮未执行 6.37 替换/重启；需确认当前部署方式后再滚动。"
  },
  "residual_risks": [
    "工作区已有其它未提交改动，未触碰。",
    "Next.js root inference warning 仍存在，但不阻塞构建。"
  ],
  "verified_at": "2026-06-30T10:22:02.047120+00:00",
  "synthesizer": {
    "allowed_to_announce_done": true
  }
}
```