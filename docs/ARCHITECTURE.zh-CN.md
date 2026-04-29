# 架构说明

Personal OS + Personal Wiki 的目标不是“做一个更漂亮的笔记软件”，而是做一个本地优先、面向 Agent 的工作操作系统。它要回答的问题是：

```text
一个人随口说的一段想法，怎么变成长期知识、具体任务和可复核产出？
```

## 设计目标

- 用户可以乱说、碎碎念、发链接，不需要一开始就结构化。
- 保留原始输入，未来能追溯“这个任务从哪来”。
- 长期知识落在 Markdown 里，方便人读、人改、diff、迁移。
- 执行状态落在数据库里，方便任务状态、认领、复核和统计。
- 给 Agent 一个稳定协议，而不是每个 Agent 都靠猜。
- 开源仓库只包含可复用引擎，不包含用户真实数据。

## 不做什么

- 不做多租户 SaaS。
- 不把真实私人 vault 发到 GitHub。
- 不让 Agent 绕过复核直接改掉关键数据。
- 不把 Personal OS 当成“会思考的大脑”。Personal OS 是状态和协调层，思考由 Agent 做。

## 组件边界

```text
Personal OS
  执行状态系统
  Postgres-backed
  负责 Inbox、Ideas、Tasks、Projects、AgentRun、Claim、Review

Personal Wiki
  长期知识系统
  Markdown-backed
  负责笔记、标签、概念、搜索索引、图谱、浏览器渲染

Agents
  推理和执行层
  调 API、读上下文、写证据、提交复核
```

这个边界非常关键。任务如果只放 Markdown，就很难处理认领、租约、心跳、复核、打回。知识如果只放数据库，人读起来不舒服，也不方便用 Obsidian、VS Code 或 Git 做长期维护。

## 输入入库流程

```text
用户输入
  v
POST /api/intake
  v
Personal OS 写入：
  - InboxItem：原始输入
  - AgentRun：Agent 当时怎么判断
  - Idea：暂未成熟的想法
  - Task：可执行任务
  - ProjectEvent：项目进展
  - ActivityLog：操作轨迹
  - Notification payload：提醒消息草稿
  |
  +--> Personal Wiki 写入：
       - Markdown 笔记
       - 标签
       - 概念
       - 图谱链接
```

正常情况下，Hermes 或其他入口 Agent 应优先调用 `/api/intake`，因为它能一次性把原始输入、任务、想法、Wiki 笔记和通知 payload 串起来。

## 任务执行流程

```text
Agent 拉取 /api/agent-inbox
  v
Agent 认领任务
  v
Agent 读取 /api/agent/context
  v
Agent 在外部执行
  v
Agent 续租并写 contribution
  v
Agent submit 进入 review
  v
人或 Reviewer Agent 决定：通过、打回、阻塞、拒绝、归档
```

这就是任务认领机制的最小闭环。它不要求所有 Agent 在一个程序里，也不要求 Personal OS 自己执行任务。只要 Agent 遵守协议，就能加入协作。

## 核心数据对象

| 对象 | 所属系统 | 作用 |
| --- | --- | --- |
| InboxItem | Personal OS | 原始输入和来源信息。 |
| Idea | Personal OS | 有价值但还没变成任务的想法。 |
| Task | Personal OS | 可执行任务，包含状态、优先级、下一步和验收标准。 |
| TaskClaim | Personal OS | 哪个 Agent 正在做，租约到什么时候。 |
| TaskContribution | Personal OS | 执行进展、证据链接、产物、下一步建议。 |
| TaskReview | Personal OS | 复核决定和审计记录。 |
| Project | Personal OS | 项目或工作流容器。 |
| ProjectEvent | Personal OS | 项目时间线。 |
| Markdown note | Personal Wiki | 长期可读知识。 |
| Graph edge | Personal Wiki | 笔记、概念和链接之间的关系。 |

## Agent 上下文

Agent 执行任务前必须优先读取：

```text
GET /api/agent/context?taskId=<id>
```

这个接口会返回一个上下文包：

- 任务字段
- 项目状态
- 来源 Inbox
- 之前的贡献
- 产物链接
- 复核记录
- 相关任务和想法
- Wiki 候选笔记
- 执行策略

这样可以避免两个坏情况：

- Agent 盲目扫整个 Wiki，结果上下文太多、跑偏。
- Agent 只看当前聊天，忘了长期知识和历史决策。

## 通知设计

Personal OS 可以生成通知 payload，但不一定自己发送。Telegram、飞书、Mac 上的 Apple 提醒事项、邮件、桌面通知都可以是独立 adapter。

边界应该是：

```text
Personal OS 决定“该说什么”
通知 adapter 决定“发到哪里、怎么发”
```

Apple 提醒事项这类软件应该只是 adapter。它可以镜像或投递 `/api/reminders/today` 和 `/api/planner/today` 的结果，但 Personal OS 仍然是任务真相。

这样以后换 Telegram、飞书、企业微信、邮箱、Apple 提醒事项或本机通知，都不需要重写任务系统。

## 长期记忆边界

Agent 自带长期记忆适合保存稳定偏好和固定操作规则，但不适合作为任务租约、复核决定、提醒 payload 或证据链的真相来源。

产品分工是：

```text
Agent 长期记忆 = 记住这个人
Personal OS   = 管工作状态
Personal Wiki = 存证据和知识
通知 adapter   = 提醒用户
```

详细对比见：[为什么不只是长期记忆](./WHY_NOT_LONG_TERM_MEMORY.zh-CN.md)。

## 安全模型

- token 从环境变量加载。
- token 不通过 URL 传递。
- 写接口需要 bearer token。
- 示例只使用占位符和 localhost。
- vault、日志、上传文件、数据库 dump、生成文件不进 Git。
- 公开发布前必须做 secret scan 和 private-data scan。

## 为什么不是一个系统搞定

只用 Wiki：知识舒服，但任务执行弱。没有天然的认领、心跳、复核、状态流转。

只用数据库：任务舒服，但知识不舒服。长文知识变成 rows，人不爱读，也不方便在 VS Code/Obsidian 里维护。

所以这个项目用两个系统：一个管“记忆”，一个管“推进”。
