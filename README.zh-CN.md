# Personal OS + Personal Wiki

[English README](./README.md)

**不是第二大脑，是推进引擎。**

Personal OS + Personal Wiki 把收藏夹、碎碎念、语音转写、项目进展和 Agent 产物，变成有人认领、有人验收、有证据链的任务。

很多工具只解决“存下来”。这个项目解决的是存下来之后更难的部分：

> 接下来该做什么？谁来做？做到什么程度才算真的推进了？

如果你的痛点是“我收藏了、记录了、也让 Agent 总结了，但最后还是没有产出”，那这里补的是中间缺失的一层：一个本地优先的推进闭环。人可以说得很乱，Agent 不能靠猜，它要面对明确的状态、任务和验收口径工作。

Personal OS + Personal Wiki 是一套本地优先的个人工作系统：

```text
碎片输入 -> 沉淀成 Wiki 知识 -> 抽取可执行任务
  -> Agent 认领执行 -> 人或 Reviewer 复核 -> 结果回写知识库
```

它不是又一个被动笔记软件。它更像一个给你和 Agent 共用的小型作战室：

- 你可以随手丢链接、想法、文件摘要、语音转写、项目更新；
- 值得长期保存的内容进入 Markdown Wiki；
- 需要行动的内容进入任务系统，并带有状态、负责人和验收口径；
- Agent 通过 API 拉任务、认领、心跳续约、提交产物、等待复核；
- 真实 vault、数据库、token、服务器台账和私人任务都不进公开仓库。

## 为什么做这个

收藏夹会吃灰，笔记会变成档案馆，聊天记录会变成雾。Agent 能力越来越强，但如果没有共同的任务状态和证据链，它还是会靠上下文猜，今天说一套，明天又跑偏。

这个项目把边界拆清楚：

- **Personal Wiki 是记忆**：Markdown 笔记、概念、标签、双链、搜索、图谱。
- **Personal OS 是工作状态**：Inbox、Ideas、Tasks、Projects、Today、AgentRun、任务认领、复核和通知 payload。
- **Agent Guide 是合约**：Agent 不靠聊天记录猜流程，而是先读手册，再按 API 工作。

这个项目的核心判断是：个人知识库不应该只帮你记住“看过什么”，还应该帮你判断“什么还没完成、下一步是什么、哪个 Agent 能把它往前顶”。

## 你能得到什么

- 一个 Next.js + Postgres 的 Personal OS：管理 Inbox、想法、任务、项目和 Agent 执行。
- 一个 Python Markdown Wiki：支持入库、搜索、标签、概念、图谱、浏览器页面和读写 token 边界。
- 一套面向 Agent 的任务协议：context、claim、heartbeat、contribution、submit、review。
- 本地优先的安全默认值：私人 vault、数据库、token、cookie、服务器台账都不属于 Git。
- 一套 CI：测试、依赖审计、类型检查、lint、Next build、Docker build、Wiki 编译和 secret scan。

## 两个核心组件

| 组件 | 路径 | 负责什么 |
| --- | --- | --- |
| Personal OS | [`personal-os-app/`](./personal-os-app) | Inbox、Ideas、Tasks、Projects、Today、AgentRun、任务认领、产物提交、通知 payload。 |
| Personal Wiki | [`personal-wiki/`](./personal-wiki) | Markdown vault、入库、搜索、标签、概念、图谱、浏览器页面、Wiki 维护 API。 |
| Agent 手册 | [`docs/AGENT_GUIDE.zh-CN.md`](./docs/AGENT_GUIDE.zh-CN.md) | 告诉 Hermes、Codex、OpenClaw 或其他 Agent 怎么读、写、认领和复核任务。 |
| 开源边界 | [`OPEN_SOURCE_RELEASE.md`](./OPEN_SOURCE_RELEASE.md) | 说明哪些能发 GitHub，哪些必须留在本地。 |

## 系统边界

Personal OS 不是知识库，Personal Wiki 也不是任务系统。它们的分工应该固定下来：

```text
Personal OS = 工作状态
- 原始输入
- 想法池
- 今天任务
- 项目状态
- Agent 运行记录
- 任务认领和复核
- 通知内容

Personal Wiki = 长期知识
- Markdown 笔记
- 标签和概念
- 双链和图谱
- 手册和教程
- 证据、结论、项目背景
```

Agent 的职责是把两边连起来：先查 Personal OS 任务，再读取 Personal Wiki 上下文，然后执行，最后把结果写回任务和知识库。

## 核心流程

```text
用户输入
  |  链接、语音转写、项目想法、服务器观察、临时吐槽
  v
Personal OS /api/intake
  |-- InboxItem：保留原始输入
  |-- Idea：还没成熟的想法
  |-- Task：可执行下一步
  |-- ProjectEvent：项目进展记录
  |-- AgentRun：Agent 当时怎么判断
  |
  +--> Personal Wiki /api/ingest
       |-- Markdown 笔记
       |-- 标签和概念
       |-- 搜索索引
       |-- 图谱关系

其他 Agent
  |-- /api/agent-inbox 拉取任务
  |-- /api/tasks/:id/claim 认领任务
  |-- /api/agent/context 读取上下文
  |-- /api/tasks/:id/heartbeat 执行中心跳续约
  |-- /api/tasks/:id/contributions 写进展
  |-- /api/tasks/:id/submit 提交复核
  v
人或 Reviewer Agent 审核：通过、打回、阻塞、归档
```

## 人怎么用

你不需要一开始就把话说得很结构化。正常用法应该是：

- 看到一个链接，发进去。
- 想到一个项目方向，发进去。
- 今天很迷茫，直接说卡在哪里。
- 某台机器发现一个服务，发进去。
- 一个 Agent 做完事，把产物链接和判断发进去。

系统要做的不是复述你的话，而是拆成：

- `Inbox`：原始记录
- `Wiki`：长期知识
- `Task`：下一步动作
- `Project`：属于哪个项目
- `Review`：哪些需要你拍板

任务文案必须说人话，格式接近：

```text
动词 + 对象 + 验收结果
```

例如：

- 不要写：整理 Wiki
- 应该写：给 3 篇孤立的项目笔记补上“目标、当前状态、下一步、相关任务”四个小节

## Agent 怎么用

Agent 不应该只靠聊天上下文猜。它应该先读手册，再按 API 工作：

- [Agent 使用手册](./docs/AGENT_GUIDE.zh-CN.md)
- [Agent Guide](./docs/AGENT_GUIDE.md)
- [Hermes API 合约](./personal-os-app/docs/HERMES_API.md)

最小任务执行循环：

```text
poll -> claim -> context -> execute -> heartbeat -> contribute -> submit -> review
```

也就是说，Agent 不是“看见任务就偷偷改完”。它要先认领，执行期间保持心跳，提交证据和产物，然后进入复核。

## 本地开发

Personal OS：

```bash
cd personal-os-app
cp .env.example .env
docker compose up -d postgres
npm ci
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Personal Wiki：

```bash
cd personal-wiki
cp .env.example .env
docker compose up -d --build
```

默认地址：

```text
Personal OS:   http://localhost:3000
Personal Wiki: http://localhost:3422
```

## 验证命令

```bash
cd personal-os-app
npm ci
npm run prisma:generate
npm test
npm audit --omit=dev --audit-level=moderate
npx tsc --noEmit
npm run build

cd ../personal-wiki
python -m py_compile api/server.py
```

## GitHub 发布边界

可以提交：

- 源码
- 测试
- 文档
- `.env.example`
- Docker/compose 示例
- 虚构 demo 数据

不能提交：

- `.env`
- token、cookie、SSH key、agent env
- 真实 Wiki vault
- 真实服务器台账、内网 IP、端口、路径、业务映射
- 真实 Inbox、任务、提醒事项、项目历史
- 日志、截图、pid、zip、`.next`、`node_modules`

详细清单见 [`OPEN_SOURCE_RELEASE.md`](./OPEN_SOURCE_RELEASE.md)。

## Wiki 是否要单独开仓库

当前建议：先不要拆，先保持一个 monorepo。

原因很直接：现在 Personal OS、Personal Wiki、Agent 协议还在一起演化。任务认领、上下文读取、Wiki 入库、通知 payload、cookie handoff 都是联动设计。过早拆仓会让安装、文档和 review 成本变高。

什么时候可以拆：

- Personal Wiki 可以脱离 Personal OS 独立安装、独立使用。
- 有开发者只想用 Wiki，不想用 OS。
- API 合约稳定，不再频繁一起改。
- CI、Docker、文档和 demo 都能分别跑通。

详细策略见：

- [Repository Strategy](./docs/REPOSITORY_STRATEGY.md)
- [仓库拆分与开源策略](./docs/REPOSITORY_STRATEGY.zh-CN.md)

## 文档地图

- [架构说明](./docs/ARCHITECTURE.zh-CN.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Agent 使用手册](./docs/AGENT_GUIDE.zh-CN.md)
- [Agent Guide](./docs/AGENT_GUIDE.md)
- [仓库拆分与开源策略](./docs/REPOSITORY_STRATEGY.zh-CN.md)
- [Open Source Release Process](./OPEN_SOURCE_RELEASE.md)
- [Security Policy](./SECURITY.md)
- [Repository Permissions](./docs/PERMISSIONS.md)
- [Contributing](./CONTRIBUTING.md)

## 当前状态

这是一个早期公开版本。它适合给想研究或改造“本地优先 Agent 工作台”的开发者看，但它不是云服务，也不包含你的私人知识库。请把它当作一个可复用引擎，而不是直接托管好的产品。
