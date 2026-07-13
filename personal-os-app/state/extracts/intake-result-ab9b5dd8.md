# intake-result
Format: JSON
Top-level: object
Size: 11
Nested depth: 4

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
    "id": "cmqrc0bfa000e0jql3inydgkp",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/github-radar",
    "sourceMessageId": null,
    "rawText": "GitHub 雷达运行：筛选 8 个 repo，生成 0 个候选任务。",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-06-24T00:25:07.798Z",
    "updatedAt": "2026-06-24T00:25:07.798Z"
  },
  "agentRunId": "cmqrc0bfx000g0jql23o9baq6",
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
    "status": "active",
    "priority": "P0",
    "currentFocus": "GitHub 外部方案转成 Agent 自驱执行闭环",
    "createdAt": "2026-06-23T03:04:11.410Z",
    "updatedAt": "2026-06-24T00:25:07.827Z"
  },
  "tasks": [],
  "ideas": [],
  "notes": [],
  "projectEvents": [
    {
      "id": "cmqrc0bgc000j0jqlge5a9wxk",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "title": "GitHub 雷达已生成可执行吸收候选",
      "body": "筛选 8 个 repo；主要信号：source-registry, context-pack, memory-tiering, graph-recall, agent-hooks, doctor-next",
      "eventType": "github-radar",
      "createdAt": "2026-06-24T00:25:07.836Z",
      "sourceInboxItemId": "cmqrc0bfa000e0jql3inydgkp",
      "sourceAgentRunId": "cmqrc0bfx000g0jql23o9baq6"
    }
…
```