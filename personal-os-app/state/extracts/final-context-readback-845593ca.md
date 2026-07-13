# final-context-readback
Format: JSON
Top-level: object
Size: 3
Nested depth: 1

## Schema

- ok: boolean
- status: number
- body: string

## Preview

```json
{
  "ok": true,
  "status": 200,
  "body": "{\"ok\":true,\"context\":{\"generatedAt\":\"2026-07-01T04:27:43.391Z\",\"task\":null,\"searchQueries\":[\"cmr006b4p01b90jpk4trb0240 review priority executionMode PATCH 默认值 副作用\"],\"wiki\":{\"status\":\"empty\",\"candidates\":[],\"searchedQueries\":[\"cmr006b4p01b90jpk4trb0240 review priority executionMode PATCH 默认值 副作用\"],\"successfulQueries\":1,\"failedQueries\":[]},\"recentTasks\":[],\"relatedIdeas\":[],\"activity\":[],\"evidence\":{\"episodes\":[{\"type\":\"activity\",\"id\":\"cmr1koxqa00ho0ipouf66hdjp\",\"title\":\"task.updated on task\",\"summary\":\"task.updated task cmr006b4p01b90jpk4trb0240\",\"relevanceScore\":12,\"createdAt\":\"2026-07-01T04:25:55.138Z\"}]},\"nextAction\":\"执行 P0 Agent 任务：部署 WikiWriteJob migration 并启动 Wiki 写队列 worker\",\"tiers\":{\"hot\":[{\"type\":\"task\",\"reason\":\"P0/P1 agent_allowed task ready for execution\",\"id\":\"cmr1kaxne00hc0ipolmjyzdss\",\"title\":\"部署 WikiWriteJob migration 并启动 Wiki 写队列 worker\",\"status\":\"todo\",\"priority\":\"P0\",\"projectName\":\"Personal OS / Wiki 知识库升级\",\"ownerAgent\":null,\"nextAction\":\"在目标环境执行 Prisma migrate deploy，并以 loop 模式启动 `npm run wiki:worker -- --loop`。\",\"definitionOfDone\":\"新 /api/intake 返回 queued；worker 能把 WikiWriteJob 从 queued/retry 推进到 done；/api/wiki-write-jobs 无持续积压。\"},{\"type\":\"task\",\"reason\":\"P0/P1 agent_allowed task ready for execution\",\"id\":\"cmr1k9vde00h20ipo800id8jt\",\"title\":\"部署 WikiWriteJob migration 并启动 Wiki 写队列 worker\",\"status\":\"todo\",\"priority\":\"P0\",\"projectName\":\"Personal OS / Wiki 知识库升级\",\"ownerAgent\":null,\"nextAction\":\"在目标环境执行 Prisma migrate deploy，并以 loop 模式启动 `npm run wiki:worker -- --loop`。\",\"definitionOfDone\":\"新 /api/intake 返回 queued；worker 能把 WikiWriteJob 从 queued/retry 推进到 done；/api/wiki-write-jobs 无持续积压。\"},{\"type\":\"task\",\"reason\":\"P0/P1 agent_allowed task ready for execution\",\"id\":\"cmqsv3ajd003f0jo8vn1upjl1\",\"title\":\"持续运行 CodingPlan 高质量语料库并每日抽样质检\",\"status\":\"doing\",\"priority\":\"P0\",\"projectName\":\"Personal OS / Wiki 知识库升级\",\"ownerAgent\":null,\"nextAction\":\"每4小时由 cron job c8296133830c 触发一次：若管线未运行则启动下一批；把新通过质检的 wiki_ready 笔记写入 Personal Wiki。\",\"definitionOfDone\":\"Cron 执行期结束后，输出统计：processed/pass/review/quarantine/wiki_ingested；抽样 20 篇 Wiki 笔记无思考泄漏、无大段英文、无明显垃圾内容。\"},{\"type\":\"task\",\"reason\":\"P0/P1 agent_allowed task ready for execution\",\"id\":\"cmr1f4s5e006n0ipoko9jhh4a\",\"title\":\"SwarmVault 本地 smoke：验证离线 heuristic 的 Wiki/context/task 产物\",\"status\":\"todo\",\"priority\":\"P1\",\"projectName\":\"Personal OS / Wiki 知识库升级\",\"ownerAgent\":null,\"nextAction\":\"在 .agent-runs/<task-id>/ 下创建临时 fixture vault，仅跑本地/离线命令：init、ingest 小样本 markdown、compile、query、context build、task start/update/finish；记录目录结构、产物质量和失败点。不得安装生产 watcher，不触碰 6.37。\",\"definitionOfDone\":\"产出 smoke-report.md、commands.log、artifact-tree.txt；报告说明 raw/wiki/state/agent 目录是否符合 Personal Wiki 分层、context pack 是否可映射到 AgentRun、task ledger 是否可作为 OS task evidence。\"},{\"type\":\"task\",\"reason\":\"P0/P1 agent_allowed task ready for execution\",\"id\":\"cmr0q7qmy002r0jpommw4ff5h\",\"title\":\"P0：产出 Personal OS 50 并发基准压测报告\",\"status\":\"todo\",\"priority\":\"P1\",\"projectName\":\"Personal OS / Wiki 知识库升级\",\"ownerAgent\":null,\"nextAction\":\"在 .agent-runs/personal-os-concurrency-p0/ 写压测脚本，先只读跑 /api/agent/context c=10/20/50，记录 p50/p95/p99、错误率、Postgres 连接数、Wiki 内存/线程。\",\"definitionOfDone\":\"有 baseline markdown/json 报告；不污染旧 Wiki 数据；不重启 Postgres；结果写回 Personal OS。\"}],\"warm\":[],\"cold\":[{\"type\":\"policy\",\"reason\":\"standing Personal OS / Wiki agent policy\",\"title\":\"Agent context policy\"}]},\"policy\":{\"canReadWiki\":true,\"canSuggestWikiUpdates\":true,\"canAutoArchiveKnowledge\":false,\"mustConfirmDelete\":true,\"maxWikiCandidates\":8,\"note\":\"Personal OS 只做机械检索和规则约束；Hermes 负责判断候选知识是否可用。\"}}}"
}

```