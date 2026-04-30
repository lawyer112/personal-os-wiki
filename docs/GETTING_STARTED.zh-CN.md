# 快速上手

这份文档用于在本地跑起公开 demo，并理解这个项目的核心闭环：

```text
输入碎片 -> Wiki 记忆 -> 任务 -> Agent 认领 -> 提交证据 -> 复核
```

demo 只使用虚构数据。不要把真实 vault、服务器台账、token、任务历史提交到 Git。

## 最快路径

如果你只是想先看到产品闭环，直接跑根目录 demo：

```bash
git clone https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
docker compose up -d --build
```

打开：

```text
Personal OS:   http://localhost:3000/auth/read
Read token:    demo-read-token

Personal Wiki: http://localhost:3422/auth/read
Read token:    demo-wiki-read-token
```

这条路径会启动 Postgres、Personal Wiki、Personal OS，并写入虚构 seed 数据。

## 前置要求

- Git
- Docker 和 Docker Compose
- Node.js 24 或更新版本，仅本地开发 Personal OS 时需要
- npm，仅本地开发 Personal OS 时需要
- Python 3.11 或更新版本，仅不使用 Docker 跑 Personal Wiki 时需要

如果要判断机器配置、端口、生产 compose、反向代理和备份要求，请先看
[部署指南](./DEPLOYMENT.zh-CN.md)。

## 1. 克隆仓库

```bash
git clone https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
```

## 2. 手动启动 Personal Wiki

```bash
cd personal-wiki
cp .env.example .env
docker compose up -d --build
```

打开：

```text
http://localhost:3422
```

`.env.example` 默认开启读写鉴权。只要你准备把服务暴露到本机之外，就应该把里面的占位 token 换成长随机值。

## 3. 手动启动 Personal OS

```bash
cd ../personal-os-app
cp .env.example .env
docker compose up -d postgres
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

打开：

```text
http://localhost:3000
```

如果要联动 Wiki，把 `personal-os-app/.env` 里的 `WIKI_API_TOKEN` 和 `WIKI_READ_TOKEN` 改成与 `personal-wiki/.env` 一致。

## 4. 你应该看到什么

执行 `npm run prisma:seed` 后，系统会生成一组虚构 demo 数据：

| 页面 | demo 内容 |
| --- | --- |
| Projects | `Acorn Launch Lab` |
| Inbox | `Demo input: collect three customer notes...` |
| Tasks | `Review the fictional launch checklist` |
| Ideas | `Add a demo screenshot after UI polish` |
| Notes | `Demo launch checklist` |
| Activity | `demo.seeded` 和任务贡献记录 |

建议点击路径：

1. 打开 `Today`，看系统认为当前最该处理的工作。
2. 打开 `Capture`，保存一个测试链接，再打开 `Inbox`，确认它只是被记录成一条新输入。
3. 打开 `Tasks`，点进 `Review the fictional launch checklist`。
4. 查看下一步动作、完成定义、Wiki 链接、贡献记录和 artifact。
5. 打开 `Projects`，查看 `Acorn Launch Lab`。
6. 打开 `Ideas`，确认截图想法还停留在想法池，没有被强行变成任务。
7. 打开 Wiki 服务，单独体验 Markdown 入库和浏览。

## 5. 最小 API 测试

使用 `personal-os-app/.env` 里的 token。

```bash
curl -H "Authorization: Bearer <PERSONAL_OS_READ_TOKEN>" \
  http://localhost:3000/api/today
```

写入一条输入：

```bash
curl -X POST http://localhost:3000/api/intake \
  -H "Authorization: Bearer <PERSONAL_OS_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "sourceType": "manual",
      "sourcePlatform": "demo",
      "rawText": "Demo input: compare the agent queue with my current workflow.",
      "createdBy": "user"
    },
    "agent": {
      "model": "example-agent-model",
      "reasoningSummary": "Classified demo input as one follow-up task."
    },
    "tasks": [
      {
        "title": "Compare the demo agent queue with my workflow",
        "status": "todo",
        "priority": "P2",
        "agentTags": ["demo", "review"],
        "nextAction": "Write one paragraph with the biggest gap.",
        "definitionOfDone": "A review note is attached to the task."
      }
    ]
  }'
```

让 Agent 拉取任务：

```bash
curl -H "Authorization: Bearer <PERSONAL_OS_API_TOKEN>" \
  "http://localhost:3000/api/agent-inbox?agentId=demo-agent&tags=demo,review"
```

读取某个任务的上下文：

```bash
curl -H "Authorization: Bearer <PERSONAL_OS_READ_TOKEN>" \
  "http://localhost:3000/api/agent/context?taskId=<task-id>"
```

## 6. API 速查

| 目的 | Endpoint | Token |
| --- | --- | --- |
| 读取今日工作台 | `GET /api/today` | 生产环境需要 read token |
| 保存被动网页采集 | `GET /capture` | 私有应用会话 / 本地访问 |
| 写入混合输入 | `POST /api/intake` | `PERSONAL_OS_API_TOKEN` |
| Agent 拉任务 | `GET /api/agent-inbox` | `PERSONAL_OS_API_TOKEN` |
| Agent 读上下文 | `GET /api/agent/context?taskId=...` | `PERSONAL_OS_READ_TOKEN` |
| Agent 认领任务 | `POST /api/tasks/:id/claim` | `PERSONAL_OS_API_TOKEN` |
| Agent 心跳续约 | `POST /api/tasks/:id/heartbeat` | `PERSONAL_OS_API_TOKEN` |
| Agent 提交产物 | `POST /api/tasks/:id/submit` | `PERSONAL_OS_API_TOKEN` |
| Wiki 入库 | `POST /api/ingest` | `WIKI_API_TOKEN` |

完整协议见：

- [`AGENT_GUIDE.zh-CN.md`](./AGENT_GUIDE.zh-CN.md)
- [`../personal-os-app/docs/HERMES_API.md`](../personal-os-app/docs/HERMES_API.md)

## 7. 常见问题

### Prisma client 缺失

运行：

```bash
npm run prisma:generate
```

### PostgreSQL 连接失败

确认 `personal-os-app/.env` 里的数据库密码和 compose 启动的本地数据库一致。示例配置使用端口 `54329`。

### Wiki 打开后要求鉴权

这是开启读鉴权后的正常行为。使用 `personal-wiki/.env` 里的 `WIKI_READ_TOKEN`，或者在两个服务都配置好之后通过 Personal OS 的 handoff 路由打开。

### 没看到 demo 项目

运行：

```bash
npm run prisma:seed
```

seed 命令会重置 demo 表，并重新创建虚构项目、任务、笔记、想法、贡献、artifact 和活动记录。
