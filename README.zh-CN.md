# Personal OS + Personal Wiki

[English README](./README.md)

Personal OS + Personal Wiki 是一个本地优先、面向 Agent 的个人工作台。它的目标不是把笔记堆得更漂亮，而是把用户每天零散输入的想法、链接、语音转写、项目进展和服务器观察，稳定地变成三类东西：

- 可长期阅读的知识
- 可执行、可认领、可验收的任务
- Agent 下次工作前能读取的上下文

一句话说清楚：

```text
碎碎念进来 -> 知识沉淀到 Wiki -> 行动进入 Personal OS -> Agent 认领执行 -> 人或 Reviewer 复核 -> 结果回写知识库
```

这个仓库不是你的私人知识库本体，也不是线上服务的数据备份。它只应该包含可复用的软件引擎：源码、数据库 schema、API 合约、测试、Docker 示例和文档。真实 vault、真实任务、真实服务器台账、token、cookie、日志、截图都不能进 Git。

## 为什么要做这个项目

普通收藏夹和笔记软件最大的问题是：它们帮你“存”，但不帮你“推进”。你可能收藏很多链接，点赞很多帖子，写很多想法，但几天后它们就吃灰了。

这个项目的第一性原理是：

```text
知识库必须服务于产出，尤其是服务于能挣钱、能落地、能推进的项目。
```

所以系统必须做四件事：

- 保留原始输入，不让重要想法丢掉。
- 把值得长期留存的内容整理成 Markdown 知识。
- 把需要行动的部分拆成具体任务，而不是“优化一下”“整理一下”这种废话。
- 让不同 Agent 能按标签获取任务、读取上下文、提交产物、等待复核。

## 两个核心组件

| 组件 | 路径 | 负责什么 |
| --- | --- | --- |
| Personal OS | [`personal-os-app/`](./personal-os-app) | Inbox、Ideas、Tasks、Projects、Today、AgentRun、任务认领、贡献提交、通知 payload。 |
| Personal Wiki | [`personal-wiki/`](./personal-wiki) | Markdown vault、入库、搜索、标签、概念、图谱、浏览器页面、Wiki 维护 API。 |
| Agent 手册 | [`docs/AGENT_GUIDE.zh-CN.md`](./docs/AGENT_GUIDE.zh-CN.md) | 告诉 Hermes、Codex、OpenClaw 或其他 Agent 应该怎么读、写、认领和复核任务。 |
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
  |-- /api/tasks/:id/contributions 写进展
  |-- /api/tasks/:id/submit 提交复核
  v
人或 Reviewer Agent 审核：通过、打回、阻塞、归档
```

## 人怎么用

你不用一开始就把话说得很结构化。正常使用方式应该是：

- 看到一个链接，发进去。
- 想到一个项目方向，发进去。
- 今天很迷茫，直接说现在卡在哪里。
- 某台机器发现一个服务，发进去。
- 一个 Agent 做完了事，把产物链接和判断发进去。

系统要做的不是复述你说的话，而是把它拆成：

- `Inbox`：原始记录
- `Wiki`：长期知识
- `Task`：下一步动作
- `Project`：属于哪个项目
- `Review`：哪些需要你拍板

任务文案必须说人话，格式应该接近：

```text
动词 + 对象 + 验收结果
```

比如：

- 不要写：整理 Wiki
- 应该写：把 3 篇孤立的项目笔记补上“目标、当前状态、下一步、相关任务”四个小节

## Agent 怎么用

Agent 不应该只靠聊天上下文猜。它应该先读手册，再按 API 工作：

- [Agent 使用手册](./docs/AGENT_GUIDE.zh-CN.md)
- [Agent Guide](./docs/AGENT_GUIDE.md)
- [Hermes API 合约](./personal-os-app/docs/HERMES_API.md)

最小任务执行循环：

```text
poll -> claim -> context -> execute -> heartbeat -> contribute -> submit -> review
```

也就是说，Agent 不是“看见任务就偷偷改完”。它要先认领，执行期间续租，提交证据和产物，然后进入复核。

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

什么时候可以拆？

- Personal Wiki 可以脱离 Personal OS 独立安装、独立被别人使用。
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

这棵源码树已经是公开发布候选。它可以继续放在私有 staging 仓库里接受评审，但真正公开时应该从干净的 squash/orphan 历史创建 public 仓库，而不是直接把 private-review 仓库改成 public。剩余发布门槛是 Docker 验证、依赖审计复核、demo 数据复核，以及最后一轮文档 review。
