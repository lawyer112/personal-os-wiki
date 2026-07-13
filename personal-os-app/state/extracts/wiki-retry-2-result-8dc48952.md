# wiki-retry-2-result
Format: JSON
Top-level: object
Size: 11
Nested depth: 3

## Schema

- ok: boolean
- inbox: object (11 keys)
- agentRunId: string
- project: object (8 keys)
- tasks: array (0 items)
- ideas: array (0 items)
- notes: array (0 items)
- projectEvents: array (1 items)
- wiki: array (1 items)
- wiki_write_status: object (5 keys)
- notification: null

## Preview

```json
{
  "ok": true,
  "inbox": {
    "id": "cmqqfnnvf000z0jn5kh32hd5t",
    "sourceType": "agent-output",
    "sourcePlatform": "telegram",
    "sourceMessageId": null,
    "rawText": "第二次补写 GitHub 雷达 Wiki note：使用生产允许的 created_by/source_type/tag/task_id。",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-06-23T09:19:29.691Z",
    "updatedAt": "2026-06-23T09:19:29.691Z"
  },
  "agentRunId": "cmqqfnnxt00110jn53l8q6jvf",
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
    "status": "active",
    "priority": "P0",
    "currentFocus": "把 GitHub 外部方案转成自驱执行闭环",
    "createdAt": "2026-06-23T03:04:11.410Z",
    "updatedAt": "2026-06-23T09:19:29.962Z"
  },
  "tasks": [],
  "ideas": [],
  "notes": [],
  "projectEvents": [
    {
      "id": "cmqqfno5t00140jn53b3apkz3",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "title": "GitHub 雷达 Wiki 记录已按生产规则补写",
      "body": "使用 created_by=hermes:worker、source_type=agent-output、task_id=cmqqfl6ge00050jn5l2cdt228 重试 GitHub 雷达 Wiki 写入。",
      "eventType": "wiki-write-retry",
      "createdAt": "2026-06-23T09:19:30.065Z",
      "sourceInboxItemId": "cmqqfnnvf000z0jn5kh32hd5t",
      "sourceAgentRunId": "cmqqfnnxt00110jn53l8q6jvf"
    }
…
```