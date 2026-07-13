# agent-inbox-before
Format: JSON
Top-level: object
Size: 2
Nested depth: 6

## Schema

- status: number
- body: object (4 keys)

## Preview

```json
{
  "status": 200,
  "body": {
    "ok": true,
    "agentId": "obsidianmanager1",
    "tags": [],
    "tasks": [
      {
        "id": "cmqq2o6he000u0jmjinvl77a4",
        "title": "产出技能入库评估模板 v0",
        "description": "Classic 要求好技能必须先判断能弥补哪些缺口、是否值得吸收，不能只收藏链接。",
        "status": "todo",
        "priority": "P1",
        "riskLevel": "low",
        "executionMode": "agent_allowed",
        "agentTags": [
          "skill",
          "github",
          "wiki",
          "template"
        ],
        "ownerAgent": null,
        "leaseUntil": null,
        "lastHeartbeatAt": null,
        "requiredOutput": "模板字段：候选、弥补缺口、接入位置、执行人、产物、验收标准、风险、不吸收原因。",
        "nextAction": "把 Worker A 的候选评估压缩成可复用模板，写入本地报告并准备同步 Wiki。",
        "definitionOfDone": "以后任一 GitHub repo/skill 入库前都能套用该模板做 review。",
        "dueDate": null,
        "estimateMinutes": 60,
        "createdBy": "hermes",
        "createdAt": "2026-06-23T03:15:58.802Z",
        "updatedAt": "2026-06-23T03:15:58.802Z",
        "completedAt": null,
        "submittedAt": null,
        "projectId": "cmqq290nm00040jmj9jwa98ya",
        "sourceInboxItemId": "cmqq2o5yh000j0jmjus8lrd06",
        "sourceAgentRunId": "cmqq2o63r000l0jmjbrv5nr4z",
        "project": {
          "id": "cmqq290nm00040jmj9jwa98ya",
          "name": "Personal OS / Wiki 知识库升级",
…
```