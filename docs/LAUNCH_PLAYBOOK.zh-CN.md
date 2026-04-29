# Launch 手册

这个文档用来盯住仓库转化链：

```text
陌生人看到仓库 -> 理解痛点 -> 跑起 demo -> star / fork / 提 issue
```

## README 第一屏标准

README 第一屏在讲架构之前，要先回答四件事：

- 解决什么痛点？
- 60 秒内能看到什么证据？
- 怎么跑起来？
- 和长期记忆、Wiki、任务插件有什么区别？

当前定位句：

```text
让 AI Agent 不再靠聊天记录瞎猜，而是从任务、证据和复核流程里干活。
```

痛点没讲清楚之前，不要先堆组件名。

## 一分钟 demo 故事

视觉证据应该展示这个闭环：

```text
碎碎念 -> Wiki 笔记 -> 任务 -> Agent 认领 -> 提交证据 -> 复核 -> 提醒
```

所有截图和 GIF 必须使用虚构 seed 数据。

适合的 demo 输入：

- 收藏的 GitHub 链接；
- 粗糙语音转写；
- 项目想法；
- 小研究任务；
- 虚构 launch checklist。

不要录真实 vault、真实任务、真实服务器台账、token 或私人提醒事项。

## 一条命令 demo

README 里要保留这个路径：

```bash
docker compose up -d --build
```

Demo 凭据：

```text
Personal OS read token: demo-read-token
Personal Wiki read token: demo-wiki-read-token
```

这个路径只用于快速体验。生产部署仍然要按部署指南设置真实密钥。

## 第一批用户

不要先打泛泛的个人知识管理。那个赛道太拥挤。

第一批用户应该更窄：

- 本地 AI Agent 玩家；
- Codex、Claude Code、Hermes、OpenClaw 和自定义 Agent 用户；
- 同时推进多个项目、多个 Agent 的人；
- 需要任务状态、证据、复核和提醒的人。

## 内容选题

英文：

- I built a local-first task control plane for AI agents
- Why long-term memory is not enough for real agent work
- From Markdown notes to reviewable agent tasks
- Stop asking agents to remember; give them a work queue

中文：

- 我做了一个给 AI Agent 用的个人任务操作系统
- 为什么“长期记忆”不适合当任务系统
- 让 Agent 接任务、心跳、提交证据、等复核
- 别让 Agent 只会聊天，给它一个任务队列

## 发布检查表

- README 第一屏有一句话定位。
- README 有 60 秒视觉证据。
- 根目录 `docker compose up -d --build` 能跑起 demo。
- Issue 模板存在。
- 至少有 5 个 `good first issue`。
- 对比文存在。
- Release 包存在。
- main CI 是绿色。
- 发布周每天保存 GitHub Traffic。

## Traffic 保存

GitHub Traffic 是短滚动窗口，所以发布周每天保存一次：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\save-github-traffic.ps1
```

快照会写入 `metrics/github-traffic/`，并且不会进入 Git。
