# Agent 作业编排

这份文档描述公开产品层面的 worker 模式。它不包含私有主机名、LAN IP、
个人用户名、真实 Agent profile 或部署资产清单。

## 目标

Personal OS + Personal Wiki 应该给 Agent 一个共享工作面：

```text
混乱输入 -> 分类成知识/任务 -> 可认领工作
  -> Agent 执行 -> 证据 -> 复核 -> Wiki/项目回写
```

系统要避免两类失败：

- Agent 把过期聊天记录当成任务事实来源；
- Agent 做了事，但没有留下可复核的证据轨迹。

## 最小 Worker 集合

一开始不需要很多 Agent 身份。先用一个定时 worker 和一个交互 worker。
只有当权限或故障边界需要拆分时，再增加 worker。

| Worker | 触发 | 主要 API | 权限 |
| --- | --- | --- | --- |
| Intake worker | 人类发送文本、链接、文件或语音转写 | `POST /api/intake`、Wiki ingest | 写 token |
| Planning worker | 早晨、check-in、晚间计划 | `GET /api/planner/today`、`GET /api/reminders/today` | 读 token |
| Task worker | 轮询或手动“交给 Agent” | `GET /api/agent-inbox`、claim/heartbeat/submit | 写 token |
| Notification adapter | planner/reminder payload 生成后 | 外部投递面 | 默认读 token，除非要回写证据 |
| Reviewer worker | 任务提交后 | 读上下文，可选 review | 读或写 token，取决于是否决策 |

小型安装里，同一个 Agent 进程可以运行多个模式。重要的是每个模式都有窄
prompt、窄 schedule 和窄 token。

## 调度模型

调度是 operator 策略，不是 Personal OS 的硬规则。应用负责记录状态；
Agent 决定什么时候值得消耗 token。

被动网页采集应当足够便宜：

```text
/capture -> InboxItem(status=new)
```

这条路径只记录一个原始链接或文本块。它不会分类、抓元数据、写 Wiki、
创建任务或发送通知。worker 可以之后读取 Inbox，再决定是否调用
`/api/intake`。

推荐的低成本起步节奏：

```text
09:30 planner-notify   拉取 planner packet，给用户发短计划。
15:00 reminder-checkin 拉取 reminder payload，提醒停滞事项。
21:30 evening-review   汇总未闭环事项，不发明新优先级。
*/30 task-poll         只有用户启用 agent work 时，轮询可认领任务。
manual/batch capture-review 可选：用户启用后再处理网页采集。
```

planner job 是跟用户说话的。task worker 是处理具体任务的。不要把这两个
职责混在同一个 prompt 里。

如果用户正在主动研究，可以让 capture worker 跑得更频繁。模型成本高时，
就降低频率或改成按需执行。关键是不要默认把每个保存网页都变成立即 LLM
任务。

## 任务认领规则

worker 只能在这些条件同时满足时认领任务：

- task 有匹配的 `agentTags`；
- task status 可认领；
- task 有 definition of done；
- 操作是低风险，或已经明确批准；
- worker 能在 lease 窗口内提交证据。

如果 worker 不确定，应提交 clarification contribution，而不是直接认领或
改任务。

## 权限层级

| 层级 | 允许动作 | Token |
| --- | --- | --- |
| 只读 | Today、planner、reminders、context、notes | `PERSONAL_OS_READ_TOKEN`、Wiki read token |
| 工作执行 | claim、heartbeat、contribution、submit | `PERSONAL_OS_API_TOKEN` |
| 知识写入 | 创建/更新 Wiki note | Wiki write token |
| 外部投递 | Apple Reminders、email、Telegram、飞书 | 默认读 token + 外部应用凭证 |

除非 reminder-only adapter 必须把投递证据写回 Personal OS，否则不要给它写
token。

## Worker Prompt 契约

每个 worker prompt 都应该写清楚：

1. 当前运行模式。
2. 允许调用哪些 API。
3. 禁止哪些动作。
4. 必须提交什么证据。
5. 什么时候停止并请求复核。

以 [Agent Prompt](./AGENT_PROMPT.zh-CN.md) 为基础，再给每个模式追加一小段
角色补丁。

## 证据契约

每次 task submit 至少应包含：

- 做了什么的短摘要；
- 如有产物，附 artifact URL 或文件路径；
- 如更新知识，附 Wiki evidence link；
- definition of done 是否满足；
- 是否仍需要人类决策。

不能因为“通知已经发出”就把任务标成 done。

## 公开部署边界

公开文档只能使用虚构示例。不要发布：

- 私有 LAN IP；
- 真实用户名或家目录；
- SSH 脚本路径；
- 真实 Agent profile 名称；
- Telegram bot 状态；
- 真实 LaunchAgent label；
- 私有服务器清单；
- 客户或业务任务历史。

私有操作笔记应放在私有部署仓库或私有 Wiki vault，不放进公开源码包。
