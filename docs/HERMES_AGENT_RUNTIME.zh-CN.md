# Hermes Agent 运行时接入说明

这份文档只描述 Hermes 运行时怎么接入 Personal OS + Personal Wiki。真实 token
只应该放在运行环境或私有进程管理配置里，不要写进 Git、Wiki 笔记、任务评论或截图。

## 当前 .28 局域网预览

如果 Hermes 和浏览器在 `192.168.6.x` 局域网内，当前预览环境使用：

```bash
PERSONAL_OS_BASE_URL=http://192.168.6.28:3100
PERSONAL_WIKI_BASE_URL=http://192.168.6.28:3422
```

必需的运行时变量：

```bash
PERSONAL_OS_API_TOKEN=<personal-os-write-token>
PERSONAL_OS_READ_TOKEN=<personal-os-read-token>
WIKI_API_TOKEN=<personal-wiki-write-token>
WIKI_READ_TOKEN=<personal-wiki-read-token>
AGENT_ID=hermes
AGENT_TAGS=wiki,curation,review,personal-os
```

规则：

- read token 只用于读取 Today、任务上下文、Wiki 搜索和提醒 payload。
- write token 才能写入 Inbox、认领任务、心跳、提交 contribution、写 Wiki。
- token 走 `Authorization: Bearer ...` header，不放 URL。
- 如果接口返回 `401`，停止并报告鉴权配置问题，不要假装完成。
- 当前 `.28` 是预览环境；迁入真实知识库前，需要先备份并轮换 demo token。

## Hermes 默认工作循环

Hermes 不应该靠网页按钮工作，而是按 API 协议推进：

```text
poll -> claim -> context -> execute -> heartbeat -> contribute -> submit -> review
```

最小请求序列：

```http
GET /api/agent-inbox?agentId=hermes&tags=wiki,curation,review,personal-os
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

```http
POST /api/tasks/<task_id>/claim
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
Content-Type: application/json

{
  "agentId": "hermes",
  "leaseMinutes": 90
}
```

```http
GET /api/agent/context?taskId=<task_id>
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

```http
POST /api/tasks/<task_id>/contributions
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
Content-Type: application/json

{
  "agentId": "hermes",
  "summary": "完成了什么，证据在哪里，剩余风险是什么。",
  "evidenceLinks": ["wiki://..."],
  "artifactUrls": ["http://192.168.6.28:3422/..."],
  "nextRecommendation": "下一步具体动作。"
}
```

```http
POST /api/tasks/<task_id>/submit
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
Content-Type: application/json

{
  "agentId": "hermes",
  "summary": "按 definitionOfDone 检查后的提交说明。",
  "artifactUrls": ["wiki://..."],
  "definitionOfDoneMet": true,
  "needsHumanDecision": false
}
```

## 输入路由

Hermes 接到用户输入后先判断意图：

| 输入 | 写入位置 | 规则 |
| --- | --- | --- |
| 临时想法、待判断事项 | Personal OS Inbox/Idea | 保留原始语境，后续再决定是否变任务 |
| 明确行动、阻塞、等待、项目推进 | Personal OS Task/ProjectEvent | 必须有 nextAction 和 definitionOfDone |
| 长期资料、文章、链接、项目背景 | Personal Wiki | 写成人能读、Agent 能引用的 Markdown |
| 同时包含知识和行动 | 两边都写 | Wiki 存知识，OS 存执行状态 |
| 不确定是否该做 | Task `review` | 交给人或 reviewer agent 决定 |

## Wiki 写入边界

Hermes 写 Wiki 时使用：

```http
POST /api/ingest
Authorization: Bearer <WIKI_API_TOKEN>
Content-Type: application/json
```

笔记至少包含：

- `title`
- `content`
- `source_type`
- `tags`
- `metadata.agent_id`
- `metadata.task_id`，如果这次输出来自任务

不要把每一条聊天都变成 Wiki。只有稳定背景、证据、项目知识、可复用流程和任务产物才进 Wiki。

## 给 Hermes 的短提示词

可以把这段放到 Hermes 的 system/developer prompt，完整协议仍以
`docs/AGENT_PROMPT.zh-CN.md` 和 `docs/AGENT_GUIDE.zh-CN.md` 为准。

```text
你是 Hermes，使用 Personal OS + Personal Wiki 工作。

Personal OS 是执行状态：Inbox、Idea、Project、Task、Today、review queue、agent run。
Personal Wiki 是长期知识：Markdown vault、搜索、标签、概念、图谱、证据。

你必须从环境变量读取 PERSONAL_OS_BASE_URL、PERSONAL_WIKI_BASE_URL 和 token。
token 只能通过 Authorization: Bearer header 使用，不能写进 URL、Wiki、任务评论或日志。

默认循环是 poll -> claim -> context -> execute -> heartbeat -> contribute -> submit -> review。
不要靠聊天记录猜任务状态；先读 /api/agent-inbox 和 /api/agent/context。
不要批准自己的工作；完成后提交 evidence 和 definitionOfDone 检查，等待人或 reviewer agent 复核。

只有明确有长期价值的内容才写 Wiki；只有有具体 nextAction 和 definitionOfDone 的事项才变成任务。
遇到 401、破坏性操作、生产部署、凭证或不可逆文件改动时，停止并报告边界。
```
