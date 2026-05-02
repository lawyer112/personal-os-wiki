# API 总览

这份文档是可复制的 API 地图。完整的 Hermes 风格契约见
[`../personal-os-app/docs/HERMES_API.md`](../personal-os-app/docs/HERMES_API.md)。

## 鉴权

Personal OS 使用 Bearer token。

| Token | 用途 |
| --- | --- |
| `PERSONAL_OS_API_TOKEN` | 写接口和 Agent 执行接口。 |
| `PERSONAL_OS_READ_TOKEN` | 只读上下文、今日工作台和规划接口。 |

Personal Wiki 使用独立的读写 token。

| Token | 用途 |
| --- | --- |
| `WIKI_API_TOKEN` | 通过 ingest/update API 写入笔记。 |
| `WIKI_READ_TOKEN` | 读取私有 Wiki 页面和 API。 |

不要把写 token 放进浏览器 URL、截图、日志或公开文档。

## 最小 Personal OS 调用

读取今日工作台：

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_READ_TOKEN" \
  http://localhost:3000/api/today
```

记录一次低成本网页采集：

```text
Open http://localhost:3000/capture
```

粘贴一个原始链接或文本。采集页只写入一个 `InboxItem(status=new)`。
是否立即分类、批处理、每天处理，还是只在用户明确要求时处理，属于外部
Agent 策略。

通过主动 Agent 写入混合输入：

```bash
curl -X POST http://localhost:3000/api/intake \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "sourceType": "manual",
      "sourcePlatform": "demo",
      "rawText": "Demo input: compare the agent queue with my current workflow.",
      "createdBy": "user"
    },
    "agent": {
      "model": "example-agent-model",
      "reasoningSummary": "Classified demo input as one follow-up task."
    },
    "tasks": [
      {
        "title": "Compare the demo agent queue with my workflow",
        "status": "todo",
        "priority": "P2",
        "riskLevel": "low",
        "executionMode": "agent_allowed",
        "agentTags": ["demo", "review"],
        "nextAction": "Write one paragraph with the biggest gap.",
        "definitionOfDone": "A review note is attached to the task."
      }
    ]
  }'
```

让某个 Agent 轮询任务之前，先注册或更新 Agent Profile：

```bash
curl -X POST http://localhost:3000/api/agent-profiles \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "demo-agent",
    "displayName": "Demo Agent",
    "tags": ["demo", "review"],
    "capabilities": ["read_context", "write_contribution", "submit_review"],
    "allowedRiskLevel": "low",
    "canWriteTasks": true,
    "enabled": true
  }'
```

Agent 轮询可认领任务：

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  "http://localhost:3000/api/agent-inbox?agentId=demo-agent&tags=demo,review"
```

认领任务：

```bash
curl -X POST \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"demo-agent","leaseMinutes":30}' \
  "http://localhost:3000/api/tasks/<task-id>/claim"
```

读取任务上下文：

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_READ_TOKEN" \
  "http://localhost:3000/api/agent/context?taskId=<task-id>"
```

提交证据：

```bash
curl -X POST \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "demo-agent",
    "summary": "Compared the queue with the workflow and attached findings.",
    "artifactUrls": ["https://example.com/demo-artifact"],
    "evidenceLinks": ["wiki://demo/demo-launch-checklist.md"],
    "definitionOfDoneMet": true,
    "needsHumanDecision": true
  }' \
  "http://localhost:3000/api/tasks/<task-id>/submit"
```

保存已经交付给用户的日计划：

```bash
curl -X POST http://localhost:3000/api/planner/today \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "morning",
    "timezone": "Asia/Shanghai",
    "mainLine": "Ship the demo agent review loop.",
    "firstAction": "Run the focused test suite and attach the result.",
    "blocked": [],
    "needsDecision": ["Choose whether this task should be public-facing."],
    "deliveredTo": ["telegram"]
  }'
```

## 端点矩阵

| 目的 | Endpoint | Method | Token |
| --- | --- | --- | --- |
| 读取今日工作台 | `/api/today` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| 读取 planner packet | `/api/planner/today?mode=...` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| 保存 planner snapshot | `/api/planner/today` | `POST` | `PERSONAL_OS_API_TOKEN` |
| 读取 planner snapshots | `/api/planner/snapshots` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| 读取 reminder payload | `/api/reminders/today?mode=...` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| 浏览器采集表单 | `/capture` | `GET/POST form action` | 私有应用会话或本地访问 |
| 主动采集混合输入 | `/api/intake` | `POST` | `PERSONAL_OS_API_TOKEN` |
| 创建原始 Inbox item | `/api/inbox/items` | `POST` | `PERSONAL_OS_API_TOKEN` |
| 注册 Agent profile | `/api/agent-profiles` | `GET/POST` | GET 用 read；POST 用 write |
| Agent 轮询任务 | `/api/agent-inbox` | `GET` | `PERSONAL_OS_API_TOKEN` |
| Agent 读取上下文 | `/api/agent/context?taskId=...` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| Agent 认领任务 | `/api/tasks/:id/claim` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Agent 续租心跳 | `/api/tasks/:id/heartbeat` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Agent 写进展 | `/api/tasks/:id/contributions` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Agent 提交工作 | `/api/tasks/:id/submit` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Reviewer 决策 | `/api/tasks/:id/review` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Wiki ingest | `Personal Wiki /api/ingest` | `POST` | `WIKI_API_TOKEN` |

## 响应结构

大多数 JSON API 成功时返回：

```json
{
  "ok": true
}
```

错误返回：

```json
{
  "ok": false,
  "error": "Missing or invalid API token"
}
```

校验错误会包含 `issues` 数组。

## Agent 状态契约

Agent 应把 Personal OS 的任务记录当作唯一工作状态来源：

- 轮询任务前先注册 `AgentProfile`。
- `AgentProfile.capabilities` 当前是给人和未来调度器看的元数据；硬约束是
  profile 是否启用、是否允许写任务、tag 是否匹配、风险等级是否允许。
- 只有 `executionMode=agent_allowed` 且非高风险任务可以被认领。
- heartbeat、contribution 和 submit 都会重新检查任务策略和 Agent profile。
  如果人类把任务改成 `approval_required`，或禁用 profile，旧 lease 就不能
  继续改任务。
- 先认领，再工作。
- 工作时间较长时用 heartbeat 续租。
- lease 过期后不要继续写进展或提交；重新认领后再做。
- 提交时附上证据和产物 URL。
- Agent 提交到 review，不要自己把任务标记为 done。
- 由人类或 reviewer agent 执行 approve、reject、block 或 archive。

这比聊天工作流更严格，目的是让 Agent 工作可审计、可恢复。
