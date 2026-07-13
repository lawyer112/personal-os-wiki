# intake-payload
Format: JSON
Top-level: object
Size: 7
Nested depth: 3

## Schema

- source: object (4 keys)
- agent: object (4 keys)
- project: object (1 keys)
- wikiNotes: array (0 items)
- tasks: array (0 items)
- notes: array (1 items)
- projectEvents: array (1 items)

## Preview

```json
{
  "source": {
    "sourceType": "agent-output",
    "sourcePlatform": "cron/personal-os-agent-executor",
    "rawText": "Cron finalized task cmr009fup01bu0jpkb1koq2h2 by moving review to done after gate=pass artifacts were verified.",
    "createdBy": "hermes"
  },
  "agent": {
    "model": "hermes-cron",
    "classification": {
      "kind": "task-lifecycle-finalization",
      "task_id": "cmr009fup01bu0jpkb1koq2h2",
      "gate_status": "pass"
    },
    "reasoningSummary": "该 AgentRun context pack 自动归档任务已有 worker-result=completed、gate=pass 且 allowed_to_announce_done=true，本轮执行 Personal OS complete 生命周期关闭。",
    "outputSummary": "已调用 /api/tasks/cmr009fup01bu0jpkb1koq2h2/complete；写入本轮收尾 artifacts；读回验证任务不再处于 review。"
  },
  "project": {
    "name": "Personal OS / Wiki 知识库升级"
  },
  "wikiNotes": [],
  "tasks": [],
  "notes": [
    {
      "title": "AgentRun context pack 自动归档任务已关闭：cmr009fup01bu0jpkb1koq2h2",
      "body": "目标：关闭已通过 gate 的 review 任务，避免 Personal OS 面板停留在记录状态。\n操作摘要：调用 complete endpoint 将 cmr009fup01bu0jpkb1koq2h2 标记完成；保留证据在 .agent-runs/cmr009fup01bu0jpkb1koq2h2-close/。\n关键证据：原 worker-result.json=completed；原 gate.json=pass；本轮 complete-result.json 和 context-readback.json。\n验证结果：complete API 返回 ok；npm run lint 通过；npm test 通过。\n剩余风险：npm run build 未在本轮重跑，历史记录显示 DATABASE_URL 环境会阻塞构建期 page data collection。\n下一步：后续 cron 可转入 Personal OS 50 并发基准压测报告任务。"
    }
  ],
  "projectEvents": [
    {
      "title": "关闭 AgentRun context pack 自动归档 v0 任务",
      "body": "cmr009fup01bu0jpkb1koq2h2 已从 review 完成到 done；本轮只做生命周期关闭，不改运行中服务。",
      "eventType": "agent-task-finalized"
    }
  ]
}
```