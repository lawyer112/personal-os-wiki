# Agent 使用手册

这份文档是给 Hermes、Codex、OpenClaw、定时 worker 或任何其他 Agent 看的。只要它要使用 Personal OS + Personal Wiki，就应该按这份手册工作。

## 第一原则

不要只总结。要把有价值的输入变成：

- 长期知识
- 具体任务
- 可复核产物

这个系统存在的目的不是“看起来很会整理”，而是减少空转、减少遗忘、推动项目产生真实进展。Agent 如果写出一堆抽象任务，即使 API 调用成功，也算失败。

## 必需环境变量

Agent 需要运行时配置，不要把密钥写死在代码或文档里：

```bash
PERSONAL_OS_BASE_URL=http://localhost:3000
PERSONAL_OS_API_TOKEN=replace-with-runtime-token
PERSONAL_OS_READ_TOKEN=replace-with-runtime-token
PERSONAL_WIKI_BASE_URL=http://localhost:3422
WIKI_API_TOKEN=replace-with-runtime-token
WIKI_READ_TOKEN=replace-with-runtime-token
```

规则：

- token 不放 URL。
- env 文件不进 Git。
- 不把真实 token、cookie、SSH key 写进 Wiki 或任务评论。
- 写接口返回 `401` 时，要明确说是 token/config 问题，不要假装任务完成。

## 行动前检查

1. 用户是否明确说“先只讨论，不要写入”？如果是，不写。
2. 输入是否包含项目、任务、链接、资料、长期想法？如果是，走 Personal OS intake。
3. 输入是否有长期知识价值？如果是，写或更新 Personal Wiki。
4. 输入是否包含行动？如果是，创建或更新任务。
5. 行动不确定？任务状态设为 `review`。
6. 操作有破坏性、需要凭证、会改部署状态？必须进入复核。

## 输入路由规则

| 输入类型 | Personal OS | Personal Wiki | 说明 |
| --- | --- | --- | --- |
| 碎碎念想法 | Inbox + Idea | 可选总结笔记 | 保留原始语境，不要直接丢。 |
| 链接或文章 | Inbox + 可选 Task | Markdown 来源笔记 | 提炼为什么重要，不只是标题。 |
| 项目方向 | ProjectEvent + Task | 项目笔记 | 要和当前项目状态连接。 |
| 服务器观察 | Task 或 ProjectEvent | 证据笔记 | 不写密钥，不写密码。 |
| 今日计划 | Today tasks | 可选复盘笔记 | 输出具体下一步。 |
| Agent 产物 | Contribution + Review | 产物或更新笔记 | 必须带证据和变更说明。 |

## 什么是好任务

每个任务都应该有：

- `title`：短，能看出动作。
- `nextAction`：下一步具体怎么做。
- `definitionOfDone`：什么情况算完成。
- `priority`：P0/P1/P2/P3。
- `agentTags`：哪些 Agent 可以认领。
- `riskLevel`：`low`、`medium`、`high`。
- `requiredOutput`：必须交付什么产物。

坏任务：

```text
整理 Wiki
优化项目
研究一下这个方向
推进赚钱项目
```

好任务：

```text
给 3 个孤立的 Wiki 项目概念补齐项目页，并从虚构 demo 项目索引反链过去。
完成标准：每个项目页都有“目标、当前状态、下一步、相关任务、证据链接”五部分。
```

一个简单判断：如果另一个 Agent 读完任务还是不知道打开哪个文件、产出什么东西，那这个任务就是废话。

## 任务认领协议

Agent 不应该抢同一个任务。必须使用租约协议。

```text
poll -> claim -> context -> execute -> heartbeat -> contribute -> submit -> review
```

### 拉任务

```http
GET /api/agent-inbox?agent_id=knowledge-curator&tags=wiki,curation&limit=10
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

### 认领任务

```http
POST /api/tasks/<task_id>/claim
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "leaseMinutes": 90
}
```

### 读取上下文

```http
GET /api/agent/context?taskId=<task_id>
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

Agent 必须先读这个上下文包。除非任务明确需要深挖，否则不要一上来扫全库。

### 心跳续租

```http
POST /api/tasks/<task_id>/heartbeat
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "leaseMinutes": 90
}
```

### 写进展

```http
POST /api/tasks/<task_id>/contributions
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "summary": "补齐了项目索引，并链接了 3 个缺失项目页。",
  "evidenceLinks": ["wiki://project_index"],
  "artifactUrls": ["http://localhost:3422/notes"],
  "nextRecommendation": "建议让 reviewer agent 检查是否还有孤立概念页。"
}
```

### 提交复核

```http
POST /api/tasks/<task_id>/submit
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "summary": "任务已完成，证据和产物见链接。",
  "artifactUrls": ["wiki://project_index"],
  "definitionOfDoneMet": true,
  "needsHumanDecision": false
}
```

执行 Agent 提交，Reviewer 决定是否通过。除非策略明确允许，否则执行 Agent 不应该把自己的任务直接标成 done。

## Wiki 笔记应该怎么写

Wiki 笔记要同时服务人和 Agent。最小可用结构：

```markdown
# 标题

## 摘要

用白话说这是什么、为什么重要。

## 当前状态

现在确定的事实，以及依据。

## 证据

- 来源或命令结果摘要。
- 相关任务或项目链接。

## 下一步

- 具体动作、负责人、预期产物。

## Links

- [[相关概念]]
- [[相关项目]]
```

规则：

- 不写密码、token、cookie、私钥、秘密 URL。
- 多写证据，少写“我觉得”。
- 任务链接笔记，笔记也反链任务。
- 不确定或可能过期的内容要标注，不要装作当前事实。

## 给用户发提醒时怎么说

提醒必须短、具体、能推动行动。

推荐格式：

```text
今天主线：
先做：
卡点：
需要你决定：
可以暂缓：
最小下一步：
```

不要写：

- 优化项目
- 整理成专题页
- 推进主线

应该写：

- 跑一次本地 demo，把报错贴回任务。
- 补 README 的 Quick Start，并从根 README 链过去。
- 在两个部署方案里选一个，否则 Agent 无法继续。

## 失败处理

- `401`：token 或配置问题。停止并报告鉴权边界。
- `400`：请求体格式问题。修 payload。
- `404`：任务/笔记/项目引用过期。重新拉上下文。
- Wiki 不可用：不能说“没有知识”，只能说“上下文不完整”。
- 租约过期：重新 claim 后再写 contribution。
- 需要破坏性操作：提交复核，不直接执行。

## 输出规范

Agent 完成一轮工作时必须说明：

- 改了什么
- 改在哪
- 怎么验证
- 还有什么风险或不确定
- 是否需要人拍板

目标不是显得很忙，目标是让进展可审计、可接手、可继续。
