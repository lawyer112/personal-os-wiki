# 人机协同公开边界

Personal OS + Personal Wiki 的方向是和 Agent 联动，而不是替代 Agent。
公开仓库只记录可复用的边界：

```text
人类输入
  -> 长期知识
  -> 明确任务
  -> Agent 认领和执行
  -> 证据和复核
  -> 更新知识和项目状态
```

## 公开契约

- Personal OS 管工作状态：Inbox、Project、Task、认领、租约、贡献、
  产物、复核、planner packet 和 reminder payload。
- Personal Wiki 管长期知识：Markdown 笔记、证据、来源记录、标签、
  概念、链接和图谱数据。
- Hermes、OpenClaw、Codex、Claude Code 或定时 worker 这类 Agent
  都通过公开 API 契约执行任务。
- 通知 adapter 只负责把 planner/reminder payload 投递到 Telegram、飞书、
  Apple 提醒事项、邮件或桌面通知。

## 可以放公开仓库的内容

稳定 API、安全规则、虚构 demo、可测试的本地流程、实现边界。

## 不放公开仓库的内容

私人产品判断、商业落地计划、客户特定工作流、真实部署拓扑、私人任务历史、
详细运营路线图。这些内容应放在私有仓库或私有 Wiki vault。

当前公开 API 请看：

- [Agent 使用手册](./AGENT_GUIDE.zh-CN.md)
- [Agent 提示词](./AGENT_PROMPT.zh-CN.md)
- [API 概览](./API_OVERVIEW.zh-CN.md)
- [维护手册](./MAINTENANCE_MANUAL.zh-CN.md)
