# 为什么不只是长期记忆？

Personal OS + Personal Wiki 不是要替代 Agent 自带的长期记忆。它解决的是另一个问题。

长期记忆让 Agent 更懂用户；这个项目让人和多个 Agent 共享一套可检查、可认领、可复核的工作系统。

## 一句话区别

| 问题 | Agent 长期记忆 | Personal OS + Personal Wiki |
| --- | --- | --- |
| 主要用途 | 记住稳定偏好、背景事实、常用上下文。 | 管当前工作状态、长期知识、任务归属、证据和复核。 |
| 谁能看 | 通常是当前 Agent 或产品自己的记忆界面。 | 用户、Hermes、Codex、Reviewer Agent、定时 worker、本地工具都能看。 |
| 能不能当任务真相 | 不适合。它可以记住任务，但通常没有租约、状态和复核。 | 适合。任务有状态、优先级、下一步、认领、心跳、贡献和 review。 |
| 其他 Agent 能不能接着干 | 取决于记忆是否暴露、是否解释正确。 | 可以。Agent 通过 API 拉任务、认领、读上下文、提交证据、等复核。 |
| 能不能审计 | 较弱。记忆可能被摘要、隐藏、过期，也不好 diff。 | 较强。Markdown、DB 记录、活动日志、产物和 review 都是显式的。 |
| 应该存什么 | 稳定用户偏好和固定操作规则。 | Inbox 原始痕迹、项目状态、Wiki 证据、未完成任务、复核结果、提醒 payload。 |
| 主要失败方式 | Agent 把过期记忆当成当前事实。 | 任务写得太抽象，或通知 adapter 没接上，导致系统看起来有状态但推不动。 |

## 边界

Agent 长期记忆适合放这些：

- 偏好的语言和表达风格
- 稳定的个人规则
- 常用工具入口
- “以后别再问我这个”的偏好
- 不常变化的约束

Personal OS + Personal Wiki 适合放这些：

- 哪些工作没完成
- 今天最该推进什么
- 哪个 Agent 认领了任务
- 什么证据能证明任务推进了
- 某条笔记支持哪个项目
- 该给用户发什么提醒
- 哪篇 Wiki 或来源支撑了某个判断

实践规则：

```text
长期记忆记住“这个人”。
Personal OS 管“工作状态”。
Personal Wiki 保存“证据和知识”。
通知 adapter 负责“提醒用户”。
```

## Hermes、提醒事项和 Mac adapter

Hermes 是推理和编排层。Personal OS 是外部状态层。Telegram、飞书、Apple 提醒事项、桌面通知都是 adapter。

目标闭环是：

```text
用户发来碎碎念、链接、语音转写或项目想法
  -> Hermes 判断它是什么
  -> POST /api/intake
  -> Personal OS 创建 Inbox / Idea / Task / ProjectEvent / Notification payload
  -> Personal Wiki 保存长期 Markdown 知识
  -> Hermes 或定时 worker 调 /api/planner/today 或 /api/reminders/today
  -> Telegram / 飞书 / Apple 提醒事项 / 桌面通知 adapter 发提醒
  -> Worker Agent 拉 /api/agent-inbox，认领任务，提交证据，进入复核
```

当前仓库已经有：

- `/api/reminders/today`：返回可发送的提醒 payload。
- `/api/planner/today`：返回更完整的计划包，让 Hermes 判断今天该推进什么。
- `/api/notifications/telegram`：生成 Telegram 风格通知 payload。
- Agent 协议文档：拉任务、认领、心跳、提交、复核。

当前仓库还没有内置 Apple 提醒事项写入器。这个应该是 Mac 侧 adapter，而不是任务真相本身。Mac 上的 worker 可以定时拉
`/api/reminders/today` 或 `/api/planner/today`，再写入 Apple 提醒事项、飞书、Telegram、邮件或桌面通知。

Mac 侧具体操作契约见：[Mac Agent Adapter 操作手册](./MAC_AGENT_ADAPTER.zh-CN.md)。

## 为什么不是重复造轮子

如果这个项目只是“总结笔记”，那它确实是在重复长期记忆和 LLM Wiki 工具。

真正不同的是执行协议：

- Inbox 保留原始输入。
- Wiki 保存长期知识和证据。
- Task 写清下一步和完成标准。
- Claim 避免多个 Agent 重复做同一件事。
- Heartbeat 让长任务可见。
- Contribution 绑定证据和产物。
- Review 判断任务到底算不算完成。
- Reminder/Planner 负责催办和规划，但不替代任务真相。

这些是普通长期记忆不提供的。

## 设计约束

不要让这个项目漂成“更聪明的记忆桶”。

每个有价值的功能至少要改善下面一件事：

- 找到未完成工作
- 把输入变成可执行任务
- 给 Agent 一个安全工作协议
- 绑定证据
- 支持复核
- 在正确时间提醒用户

如果一个功能只是多存一点文字，却不能推动工作，它应该留在 Wiki 层或外部长期记忆系统里，不应该塞进 Personal OS。
