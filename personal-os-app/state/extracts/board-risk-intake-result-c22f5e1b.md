# board-risk-intake-result
Format: JSON
Top-level: object
Size: 3
Nested depth: 1

## Schema

- ok: boolean
- status: number
- body: string

## Preview

```json
{
  "ok": true,
  "status": 201,
  "body": "{\"ok\":true,\"inbox\":{\"id\":\"cmr1kr8nr00hp0ipotpsepwd2\",\"sourceType\":\"agent-output\",\"sourcePlatform\":\"cron/personal-os-agent-executor\",\"sourceMessageId\":null,\"rawText\":\"补充记录：任务 cmr006b4p01b90jpk4trb0240 已通过 PATCH 推进到 review；发现 PATCH schema 默认值会把 priority/executionMode 改为 P2/manual，需要后续修复。\",\"sourceUrl\":null,\"attachments\":[],\"status\":\"new\",\"createdBy\":\"hermes\",\"receivedAt\":\"2026-07-01T04:27:42.615Z\",\"updatedAt\":\"2026-07-01T04:27:42.615Z\"},\"agentRunId\":\"cmr1kr8or00hr0ipomfhkclos\",\"project\":{\"id\":\"cmqq290nm00040jmj9jwa98ya\",\"name\":\"Personal OS / Wiki 知识库升级\",\"goal\":\"保持 Hermes 多 Agent 运行可观测、轻量和可恢复。\",\"status\":\"active\",\"priority\":\"P0\",\"currentFocus\":\"高并发 Agent 写 Wiki 时入口快速返回，Wiki 写入后台串行处理。\",\"createdAt\":\"2026-06-23T03:04:11.410Z\",\"updatedAt\":\"2026-07-01T04:14:46.836Z\"},\"tasks\":[],\"ideas\":[],\"notes\":[],\"projectEvents\":[{\"id\":\"cmr1kr8p000ht0ipoiejr2wqc\",\"projectId\":\"cmqq290nm00040jmj9jwa98ya\",\"title\":\"任务看板推进到 review，并发现 PATCH 默认值副作用\",\"body\":\"cmr006b4p01b90jpk4trb0240 已从 todo 推进到 review。注意：PATCH 仅传 status/nextAction/definitionOfDone，但读回 priority=P2、executionMode=manual（原为 P1/agent_allowed），说明 taskUpdateSchema/taskCreateSchema.partial 默认值有副作用。证据：.agent-runs/cmr006b4p01b90jpk4trb0240/artifacts/task-board-advance.json。\",\"eventType\":\"agent-task-risk\",\"createdAt\":\"2026-07-01T04:27:42.660Z\",\"sourceInboxItemId\":\"cmr1kr8nr00hp0ipotpsepwd2\",\"sourceAgentRunId\":\"cmr1kr8or00hr0ipomfhkclos\"}],\"wiki\":[],\"wiki_write_status\":{\"status\":\"skipped\",\"requested\":0,\"succeeded\":0,\"failed\":0,\"errors\":[]},\"notification\":null}"
}

```