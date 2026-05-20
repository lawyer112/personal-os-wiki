# 人机协同路线图

Personal OS + Personal Wiki 不只是一个知识库。它的产品方向是一个
人机协同工作台：

```text
人的碎片输入
  -> 稳定知识
  -> 明确任务
  -> Agent 认领和执行
  -> 证据和复核
  -> 更新后的知识与项目状态
```

这份文档记录当前系统距离“可靠助理”还差什么。目标不是再做一个聊天记忆，
而是让 Hermes、OpenClaw、Codex 或定时 worker 这类 Agent 能围绕同一个
外部状态层工作。

## 当前已经有的能力

- Inbox 可以保存人的原始输入。
- `/api/intake` 可以一次创建 Inbox、AgentRun、Wiki note、OS note、Task、
  Idea、ProjectEvent 和通知 payload。
- Task 已经有 `nextAction`、`definitionOfDone`、优先级、风险等级、
  `executionMode`、agent tags、owner agent、lease、heartbeat、contribution、
  artifact 和 review。
- AgentProfile 可以登记 tags、capabilities、风险上限、任务写入权限、
  Wiki 写入权限、通知权限和启用状态。
- Agent 可以 poll、claim、heartbeat、contribute、submit，并进入 review。
- Agent poll、claim、heartbeat、contribution、submit 已经会检查任务执行模式、
  风险等级、有效租约和 AgentProfile 的 tags/权限。
- `/api/agent/context` 会返回任务上下文、Wiki 候选、相关 idea、近期任务、
  activity 和执行策略。
- `/api/planner/today` 与 `/api/reminders/today` 可以给定时 worker 和通知
  adapter 生成当天计划与提醒包。
- planner 输出可以保存为 `DailyPlan` 快照，便于后续复盘实际发给用户的计划。
- Personal Wiki 可以保存长期 Markdown 知识和来源证据。

当前缺的不是“再多一个记忆”。缺的是决策和执行控制：现在应该做什么，
哪个 Agent 有资格做，什么证据证明推进了，结果如何反向更新知识库。

## 关键缺口

| 缺口 | 为什么重要 |
| --- | --- |
| Intake 质量主要依赖 Agent 自觉 | 服务端校验字段，但不判断任务是否具体、知识是否应保持 knowledge-only。 |
| 没有一等的 workflow/skill 对象 | 可复用工作方法散落在文档或 Wiki 文字里，还不是可版本化、可调用的执行配方。 |
| DailyPlan 快照还没有展示到 Today 页面 | planner 快照已经持久化，但用户日常界面还看不到历史计划。 |
| 执行策略仍偏粗 | `executionMode` 已经能阻止不安全认领，但还没有完整的授权审批流。 |
| Agent 能力注册表仍是第一阶段 | Profile 已能按 tags、风险和核心权限过滤任务，但 UI 和更细的 capability 匹配还没完成。 |
| Agent 执行不是一等 run | `AgentRun` 更像 intake 分类记录，不是任务执行尝试。 |
| 缺少队列调度策略 | Agent 可以 poll，但除了查询顺序，没有明确的“应该先认领什么”。 |
| Review 还是状态级，不是标准级 | 可以 approve/reject，但没有按任务类型存 checklist 和证据要求。 |
| 通知投递没有闭环 | 已经有通知 payload，但外部 adapter 投递、去重、确认还没有成为一等记录。 |
| Wiki 学习闭环不完整 | 2026-05-13 状态：一期 submit 写 Wiki note、vault 重构、tag registry、迁移和 MOC 生成已完成；复核结论自动沉淀为 Workflow 建议仍属后续工作。 |

## 正确的产品模型

系统应该把人机协同拆成五个对象：

| 对象 | 职责 |
| --- | --- |
| Source | 人或外部工具实际提供了什么。 |
| Knowledge | 稳定事实、项目上下文、决策、流程和证据。 |
| Task | 有下一步动作和完成定义的具体行动。 |
| Execution | 某个 Agent 认领后的执行过程，包括 lease、heartbeat、action、artifact 和 evidence。 |
| Review | 接受、打回、阻塞，或者把结果沉淀回知识库的决定。 |

## 能力模型与后续补强

### 1. Intake Decision Schema

给 `/api/intake` 增加更严格的分类对象：

```json
{
  "inputType": "knowledge_only | idea | project_update | user_task | agent_task | question_answer | noise",
  "actionability": "none | later | today | agent_claimable",
  "confidence": 0.0,
  "why": "short reason",
  "missingInformation": ["..."],
  "safetyNotes": ["..."]
}
```

这样系统不会把每一句碎碎念都硬转成任务。

### 2. Execution Mode

任务已经有执行授权字段：

```text
manual
agent_suggested
agent_allowed
approval_required
blocked_until_user
```

`riskLevel` 说明任务有多危险，`executionMode` 说明 Agent 被允许做到哪一步。

### 3. Agent Capability Registry

AgentProfile 已经支持基础能力注册：

```text
AgentProfile
- id
- displayName
- tags
- capabilities
- allowedRiskLevel
- canWriteWiki
- canWriteTasks
- canTouchFiles
- canSendNotifications
- enabled
```

当前任务 poll/claim 会检查 tag、执行模式、风险等级和核心 profile 权限。
`capabilities` 目前是给人和下一阶段调度器看的元数据，还不是硬性执行约束。

### 4. Task Execution Run

把任务执行尝试变成一等对象：

```text
TaskRun
- id
- taskId
- agentId
- status: claimed | running | submitted | failed | expired | cancelled
- leaseUntil
- startedAt
- completedAt
- summary
- error
```

`TaskClaim`、`TaskContribution`、`TaskArtifact` 可以保留，但 `TaskRun`
应该成为“这次 Agent 到底尝试了什么”的中心记录。

### 5. Agent Action Log

增加结构化动作日志：

```text
AgentActionLog
- taskRunId
- actionType
- toolName
- target
- summary
- riskLevel
- beforeState
- afterState
- artifactUrls
- createdAt
```

这让用户看到“助理到底做了什么”，而不是只看到最终总结。

### 6. Workflow / Skill Notes

把成熟工作方法当成可复用知识：

```text
WorkflowSkill
- title
- purpose
- triggerWhen
- inputs
- steps
- tools
- verification
- failureModes
- lastReviewedAt
- wikiNotePath
```

例如：“OCR 方案评估流程”、“GitHub 发布流程”、“Mac 提醒投递流程”、
“服务器台账整理流程”。这些不是普通文档，而是 Agent 执行前应该读取的
操作规程。

### 7. Daily Plan Snapshot

DailyPlan 已经可以持久化当天计划：

```text
DailyPlan
- date
- mode
- mainLine
- firstAction
- blocked
- needsDecision
- sourcePlannerPacket
- deliveredTo
- createdAt
```

用户应该能追问：“今天早上系统让我做什么？最后有没有推进？”

### 8. Review Criteria

给任务或任务类型增加验收标准：

```text
ReviewCriterion
- taskId
- label
- requiredEvidence
- passed
- reviewerComment
```

这能减少“看起来还行”的模糊复核，让 Agent 自主工作更安全。

## 实施顺序

1. 已完成：收紧 task claim / heartbeat / contribution / submit 的归属和策略规则。
2. 已完成：给 Task 增加 `executionMode`，阻止高风险任务被自动认领。
3. 已完成：增加 `AgentProfile`，让 Agent inbox 按 profile、tag 和风险过滤。
4. 已完成：增加 `DailyPlan`，保存 planner 输出和通知结果。
5. 增加 `TaskRun`，记录任务执行尝试。
6. 增加结构化 `AgentActionLog`。
7. 增加 intake decision schema 和质量评分。
8. 2026-05-13 状态：已增加 `50_skills/` Wiki notes 并接入 ingest/MOC；更完整的 agent context 加载仍属后续工作。
9. 给 Mac、Telegram、飞书等 adapter 增加通知投递记录。
10. 增加 review criteria 和 reviewer dashboard。

## 近期验收场景

下一阶段最小闭环应该证明这个场景：

```text
用户把一个 OCR 方案或来源丢进系统。
Agent 把它分类为项目知识 + 一个 agent-claimable task。
任务链接到 OCR workflow skill 和相关证据笔记。
符合能力的 worker 认领任务。
worker 评估 OCR 来源，记录动作，提交证据。
reviewer approve 或 request changes。
结果更新项目笔记和 workflow skill。
下一次 daily plan 使用这份新知识。
```

这个闭环跑通后，系统就不是被动 Wiki，而是可推进工作的助理工作台。
