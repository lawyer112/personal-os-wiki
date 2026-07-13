# gate
Format: JSON
Top-level: object
Size: 6
Nested depth: 3

## Schema

- taskId: string
- status: string
- verifiedAt: string
- checks: array (3 items)
- synthesizer: object (1 keys)
- residualRisks: array (3 items)

## Preview

```json
{
  "taskId": "cmr3c5vz1016a0jnyp38qp2yc",
  "status": "pass",
  "verifiedAt": "2026-07-02T13:05:30.000Z",
  "checks": [
    {
      "name": "worker-result.json exists",
      "status": "pass"
    },
    {
      "name": "evidence.md exists",
      "status": "pass"
    },
    {
      "name": "definition-of-done met",
      "status": "pass",
      "detail": "Wiki 评估笔记包含：核心能力、与 Personal OS/Wiki 适配点、可吸收设计、风险；子任务已确认（cmr35vrps011r0jny6w6s9x7m, cmr35vrq6011t0jny68jy2rcz）"
    }
  ],
  "synthesizer": {
    "allowed_to_announce_done": true
  },
  "residualRisks": [
    "Node >= 24 需确认",
    "MCP stdio 接入需要包装层",
    "P1 子任务尚未执行"
  ]
}

```