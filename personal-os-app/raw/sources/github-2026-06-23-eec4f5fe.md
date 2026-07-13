# GitHub 知识雷达 2026-06-23

## 结论

本轮输出不是链接列表，而是可执行吸收判断。优先吸收 Source Registry、Context Pack、Hot/Warm/Cold Context、Graph Recall、Agent Hooks。

## 已筛选项目

### swarmclawai/swarmvault
- URL: https://github.com/swarmclawai/swarmvault
- Score: 65.58
- Signals: Source Registry / evidence ledger；Agent context pack / task ledger；Hot / warm / cold memory tiering；Graph recall: FTS/vector/community/PPR/episodic traces；Agent lifecycle hooks / MCP integration；Doctor / next-command guidance
- Why: The local-first LLM Wiki: open-source knowledge graph builder, RAG knowledge base, and agent memory store. Built on Andrej Karpathy's pattern. An Obsidian alternative for personal knowledge management, AI second brain, and durable Claude Code / Codex / OpenClaw memory.
- Absorb:
  - 把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。
  - 把 .agent-runs/<task-id>/ 自动归档成 Wiki note，包含 gate、diff、测试、部署、风险和下一步。
  - 让 /api/agent/context 输出 tiers.hot、tiers.warm、tiers.cold，优先喂给自驱执行器。

### ruvnet/agent-harness-generator
- URL: https://github.com/ruvnet/agent-harness-generator
- Score: 65.29
- Signals: Source Registry / evidence ledger；Agent context pack / task ledger；Hot / warm / cold memory tiering；Graph recall: FTS/vector/community/PPR/episodic traces；Agent lifecycle hooks / MCP integration；Doctor / next-command guidance
- Why: 🛠️ The meta-harness for AI agents — scaffold your own focused, branded agent harness with its own npx CLI, MCP server, memory, learning loop, and witness-signed releases. Works with Claude Code, Codex, pi.dev, Hermes, OpenClaw, and RVM (hardware-isolated sandbox).
- Absorb:
  - 把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。
  - 把 .agent-runs/<task-id>/ 自动归档成 Wiki note，包含 gate、diff、测试、部署、风险和下一步。
  - 让 /api/agent/context 输出 tiers.hot、tiers.warm、tiers.cold，优先喂给自驱执行器。

### itechmeat/open-second-brain
- URL: https://github.com/itechmeat/open-second-brain
- Score: 65.09
- Signals: Source Registry / evidence ledger；Agent context pack / task ledger；Hot / warm / cold memory tiering；Graph recall: FTS/vector/community/PPR/episodic traces；Agent lifecycle hooks / MCP integration；Doctor / next-command guidance
- Why: Local-first 🧠 memory for Hermes Agent that lives in your Obsidian vault and remembers project context. Nightly 😴 dream passes turn repeat corrections into confirmed preferences with measurable confidence. Adapters ship for Claude Code, Codex, and OpenClaw, with an MCP server for anything else.
- Absorb:
  - 把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。
  - 把 .agent-runs/<task-id>/ 自动归档成 Wiki note，包含 gate、diff、测试、部署、风险和下一步。
  - 让 /api/agent/context 输出 tiers.hot、tiers.warm、tiers.cold，优先喂给自驱执行器。

### Zhonghao1995/agentic-swmm-workflow
- URL: https://github.com/Zhonghao1995/agentic-swmm-workflow
- Score: 65.01
- Signals: Source Registry / evidence ledger；Agent context pack / task ledger；Hot / warm / cold memory tiering；Graph recall: FTS/vector/community/PPR/episodic traces；Agent lifecycle hooks / MCP integration；Doctor / next-command guidance
- Why: Agentic SWMM is an automated, auditable, and memory-informed framework for reproducible stormwater modelling, integrating QGIS and EPA SWMM through the aiswmm runtime, reusable Skills, and MCP interfaces, with QA verification, provenance tracking, calibration support, and Codex, Hermes, Claude code as well as OpenClaw compatibility
- Absorb:
  - 把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。
  - 把 .agent-runs/<task-id>/ 自动归档成 Wiki note，包含 gate、diff、测试、部署、风险和下一步。
  - 让 /api/agent/context 输出 tiers.hot、tiers.warm、tiers.cold，优先喂给自驱执行器。

### Walliiee/agent-harness
- URL: https://github.com/Walliiee/agent-harness
- Score: 65
- Signals: Source Registry / evidence ledger；Agent context pack / task ledger；Hot / warm / cold memory tiering；Graph recall: FTS/vector/community/PPR/episodic traces；Agent lifecycle hooks / MCP integration；Doctor / next-command guidance
- Why: A drop-in self-improving memory + operations harness for AI agents (OpenClaw / Hermes / Claude Code / Codex). Layered memory, autonomous drift-fixing loop, evals, and one-command DR. Templates + scripts, no secrets.
- Absorb:
  - 把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。
  - 把 .agent-runs/<task-id>/ 自动归档成 Wiki note，包含 gate、diff、测试、部署、风险和下一步。
  - 让 /api/agent/context 输出 tiers.hot、tiers.warm、tiers.cold，优先喂给自驱执行器。

### willynikes2/knowledge-base-server
- URL: https://github.com/willynikes2/knowledge-base-server
- Score: 61.17
- Signals: Source Registry / evidence ledger；Agent context pack / task ledger；Hot / warm / cold memory tiering；Graph recall: FTS/vector/community/PPR/episodic traces；Agent lifecycle hooks / MCP integration；Doctor / next-command guidance
- Why: Make every AI agent you use smarter. Persistent memory with SQLite FTS5, MCP server, Obsidian sync, and self-learning intelligence pipeline.
- Absorb:
  - 把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。
  - 把 .agent-runs/<task-id>/ 自动归档成 Wiki note，包含 gate、diff、测试、部署、风险和下一步。
  - 让 /api/agent/context 输出 tiers.hot、tiers.warm、tiers.cold，优先喂给自驱执行器。

### EverMind-AI/EverOS
- URL: https://github.com/EverMind-AI/EverOS
- Score: 60
- Signals: Source Registry / evidence ledger；Hot / warm / cold memory tiering；Graph recall: FTS/vector/community/PPR/episodic traces；Agent lifecycle hooks / MCP integration；Doctor / next-command guidance
- Why: Self-evolving memory across Agent and platform. The one portable memory layer for every agent they use - Claude Code, Codex, OpenClaw, Hermes, and more
- Absorb:
  - 把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。
  - 让 /api/agent/context 输出 tiers.hot、tiers.warm、tiers.cold，优先喂给自驱执行器。
  - 给 context 检索加入同类任务 episode 和图谱邻接证据，避免空候选和重复踩坑。

### mnemon-dev/mnemon
- URL: https://github.com/mnemon-dev/mnemon
- Score: 55.36
- Signals: Source Registry / evidence ledger；Hot / warm / cold memory tiering；Graph recall: FTS/vector/community/PPR/episodic traces；Agent lifecycle hooks / MCP integration；Doctor / next-command guidance
- Why: LLM-supervised persistent memory for AI agents — graph-based recall, cross-session knowledge, single binary. Works with Claude Code, OpenClaw, and any CLI agent.
- Absorb:
  - 把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。
  - 让 /api/agent/context 输出 tiers.hot、tiers.warm、tiers.cold，优先喂给自驱执行器。
  - 给 context 检索加入同类任务 episode 和图谱邻接证据，避免空候选和重复踩坑。

## 已生成 Agent 任务

- 实现 GitHub 雷达 Source Registry 写回 v0 — 运行 github-radar-intake.mjs --intake 后，生成本地证据目录，并在 Personal OS 出现 Wiki note、ProjectEvent、至少 1 个 agent_allowed 任务；日志不含 token。
- 把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0 — query=personal os wiki 时返回 tiers.hot、tiers.warm、tiers.cold；hot 含当前 P0/P1 agent_allowed task 或最近阻塞；npm test/tsc/lint/build 通过。
- 实现 AgentRun context pack 自动归档 v0 — 对真实 task-id 运行后，Wiki note 包含 task_id、gate、diff、测试、部署、残余风险；Personal OS 返回 201；不泄露 token。
- 给 Personal OS context 增加同类任务 episode 召回 v0 — query=wiki write failed 时返回最近修复记录、相关 Wiki note、可执行 runbook；新增测试通过。

## Classic 需要做

无。Agent 负责继续执行、验证、写回。