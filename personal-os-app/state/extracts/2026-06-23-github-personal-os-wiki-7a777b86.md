# 2026-06-23 GitHub 知识雷达：Personal OS / Wiki 自驱改进候选

## 结论

这轮不是只找链接。已经把可吸收方案压成 4 个 Agent 可执行任务，写入 Personal OS。优先吸收的是执行闭环，不是换技术栈。

## 已检索来源

- swarmclawai/swarmvault — https://github.com/swarmclawai/swarmvault — local-first LLM Wiki；raw/wiki/schema 三层；context packs；agent task ledger；approval queue；doctor/next；graph-first hooks
- topoteretes/cognee — https://github.com/topoteretes/cognee — AI memory platform；remember/recall/forget/improve；KG+vector；session memory sync permanent graph；OpenClaw/Claude Code 集成
- adoresever/graph-memory — https://github.com/adoresever/graph-memory — OpenClaw graph memory；FTS5/vector + community expansion + PPR；episodic traces；75% context compression；gm_search/gm_record/gm_stats/gm_maintain
- mnemon-dev/mnemon — https://github.com/mnemon-dev/mnemon — LLM-supervised persistent memory；host LLM 判断，binary 做存储/检索/decay；remember/link/recall；Hermes setup 支持
- willynikes2/knowledge-base-server — https://github.com/willynikes2/knowledge-base-server — Obsidian source of truth + SQLite/FTS retrieval；capture→classify→promote→synthesize；hot/warm/cold memory；session/fix capture；16 MCP tools
- neo4j-labs/agent-memory — https://github.com/neo4j-labs/agent-memory — graph-native memory for AI agents；conversation + context graph backed by Neo4j
- 0xK3vin/MegaMemory — https://github.com/0xK3vin/MegaMemory — persistent project knowledge graph for coding agents；MCP server + semantic search
- Tencent/WeKnora — https://github.com/Tencent/WeKnora — raw docs → queryable RAG + autonomous reasoning agent + self-maintaining Wiki

## 应立即吸收的设计

### 1. Source Registry + Evidence Note

来自 SwarmVault / knowledge-base-server。每次 GitHub 雷达不能只发链接，必须形成：source 记录、证据摘要、采纳/暂缓判断、落地任务。

验收标准：一次雷达运行至少输出 `repos.json`、`evidence.md`、`adoption-tasks.json`，并通过 `/api/intake` 写回 Wiki + Task。

### 2. Hot / Warm / Cold 上下文分层

来自 knowledge-base-server。Personal OS `/api/agent/context` 目前像候选列表，不够像执行上下文。需要把结果分为：

- hot：当前项目任务、最近 AgentRun、阻塞、今天必须推进
- warm：已验证流程、项目决策、近期复盘
- cold：原始资料、GitHub 来源、长期知识

验收标准：`/api/agent/context` 返回 tiers 字段；自驱执行器优先消费 hot，再查 warm/cold。

### 3. Agent Task Ledger / Context Pack

来自 SwarmVault。现在 `.agent-runs/<task-id>/` 有产物，但没有被系统化索引进 Wiki/OS。需要让每个 AgentRun 自动形成 context pack：目标、证据、diff、测试、部署、风险、下一步。

验收标准：任务完成时自动生成 Wiki note，并关联 task_id、agentRunId、artifact 路径、gate 状态。

### 4. Recall 质量升级：FTS + Graph + Episode

来自 graph-memory / Cognee / Mnemon。当前 Personal Wiki 图谱有基础能力，但自驱执行器没有强制使用图谱和历史 episode。先做 v0：上下文接口返回“最近同类任务的完成证据”和“可复用流程”。

验收标准：给定 query=`wiki write failed`，context 返回最近修复记录、相关 Wiki note、可执行 runbook，而不是空候选。

## 执行方案改动

- 自驱执行器不能只看任务列表；如果没有可执行任务，必须触发 GitHub 雷达，把外部方案转成内部任务。
- GitHub 雷达不能只周报；必须写入 OS/Wiki，并产出 Agent 可执行任务。
- 对内部 Personal OS / Wiki 且 gate=pass 的任务，继续部署和回归；不要把 review 推给 Classic。
- 每个外部项目只允许沉淀“可执行设计”，不沉淀泛泛链接。

## 暂不吸收

- 直接引入 Neo4j：现阶段会加重部署复杂度，先用现有 Postgres/SQLite/FTS + Wiki graph。
- 直接替换 Personal Wiki 为 SwarmVault/Cognee：当前目标是吸收设计，不是迁移系统。
- 让 Classic 手动筛项目：这是 Agent 责任。