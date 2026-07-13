# worker-result
Format: JSON
Top-level: object
Size: 8
Nested depth: 2

## Schema

- taskId: string
- agentId: string
- startedAt: string
- completedAt: string
- status: string
- summary: string
- artifacts: array (3 items)
- nextRecommendation: string

## Preview

```json
{
  "taskId": "cmqqxalsj000i0jpjtjlqncdo",
  "agentId": "obsidianmanager1",
  "startedAt": "2026-06-24T03:00:00.000Z",
  "completedAt": "2026-06-24T03:01:30.000Z",
  "status": "completed",
  "summary": "实现了 Personal OS /api/agent/context 的 episode 召回 v0。在 AgentContextPack 中新增 evidence.episodes 字段，从 Wiki candidates、ActivityLog、Task contributions 和 AgentRun 中召回历史记录作为可复用 episode。包含新增测试 3 个，全部 77 个测试通过。tsc 和 eslint 无错误。",
  "artifacts": [
    ".agent-runs/cmqqxalsj000i0jpjtjlqncdo/diff.patch",
    ".agent-runs/cmqqxalsj000i0jpjtjlqncdo/worker-result.json",
    ".agent-runs/cmqqxalsj000i0jpjtjlqncdo/gate.json"
  ],
  "nextRecommendation": "部署到 6.37 并做生产回归；后续可扩展为从 AgentRun 数据库直接查询全局 episode。"
}

```