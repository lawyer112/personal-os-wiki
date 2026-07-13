# AgentRun Context Pack：cmqyixt4a00n90jpk3todreos
任务ID：cmqyixt4a00n90jpk3todreos
项目：Personal OS / Wiki 知识库升级
Agent：obsidianmanager1
状态：completed
Gate：pass
## 摘要
评估 rohitg00/agentmemory，产出 source ledger、Wiki 评估证据和两个可吸收子任务建议。
## 决策
吸收设计，不直接安装/部署 agentmemory 本体。
## Gate / 验证
- npm install: pass (.agent-runs/cmqyixt4a00n90jpk3todreos/npm-install.log)
- npm run lint: pass (.agent-runs/cmqyixt4a00n90jpk3todreos/lint.log)
- artifact files: pass (5 files)
## Diff / 代码改动
- 未发现 diff/patch 文件；本轮可能是 Wiki/source-ledger 任务。
## 测试 / 构建证据
- .agent-runs/cmqyixt4a00n90jpk3todreos/lint.log
- .agent-runs/cmqyixt4a00n90jpk3todreos/npm-install.log
## 部署
- 状态：not_needed
- 原因：本轮为 Wiki/source-ledger 评估，无代码改动
## 产物清单
- .agent-runs/cmqyixt4a00n90jpk3todreos/source-ledger/repos.json
- .agent-runs/cmqyixt4a00n90jpk3todreos/source-ledger/evidence.md
- .agent-runs/cmqyixt4a00n90jpk3todreos/source-ledger/adoption-tasks.json
- .agent-runs/cmqyixt4a00n90jpk3todreos/claim-result.json
- .agent-runs/cmqyixt4a00n90jpk3todreos/context-readback.json
- .agent-runs/cmqyixt4a00n90jpk3todreos/gate.json
- .agent-runs/cmqyixt4a00n90jpk3todreos/intake-payload.json
- .agent-runs/cmqyixt4a00n90jpk3todreos/intake-result.json
- .agent-runs/cmqyixt4a00n90jpk3todreos/lint.log
- .agent-runs/cmqyixt4a00n90jpk3todreos/npm-install.log
- .agent-runs/cmqyixt4a00n90jpk3todreos/submit-payload.json
- .agent-runs/cmqyixt4a00n90jpk3todreos/submit-result.json
- .agent-runs/cmqyixt4a00n90jpk3todreos/worker-result.json
## 残余风险
- 外部 benchmark 未本机复现
- 若直接启用 memory provider 可能形成双真相源
## 原始 evidence 摘要
# GitHub 雷达评估：rohitg00/agentmemory

任务：cmqyixt4a00n90jpk3todreos
来源：https://github.com/rohitg00/agentmemory

## 核心能力
- 面向 coding agents 的持久记忆层：自动捕获会话、工具调用和决策，避免每次会话重新解释项目背景。
- 多 Agent 接入：MCP、REST、hooks、skills；README 明确包含 Hermes、Codex、Claude Code、OpenClaw 等接入路径。
- 检索链路：BM25 + vector + graph，以 RRF 融合；强调 token budget 和 top-K 注入。
- 记忆生命周期：working / episodic / semantic / procedural 四层，带 decay、consolidation、auto-forget 和 provenance。
- 可观测性：viewer、session replay、iii console / traces，用于查看记忆写入和召回链路。

## 与 Personal OS / Wiki 的适配点
- Personal OS 已经有 task、AgentRun、activity、wiki candidate；agentmemory 的“自动捕获 + 压缩 + 可追溯召回”可作为设计参考，但不应直接替换 6.37 真相源。
- 最值得吸收的是“session replay + provenance + lifecycle tiering”：把 .agent-runs、task contribution、wiki note、验证结果串成可检索 episode。
- Hermes profile 的跨 Agent 记忆需求可参考其 AGENT_ID / scope 设计，但必须保留现有 Personal OS owner split 和 agent_allowed 风险门。

## 可吸收设计
1. AgentRun context pack：把 worker-result.json、gate.json、diff、测试、部署、风险自动归档成 Wiki note，并在 /api/agent/context.evidence.episodes 返回。
2. 记忆分层：为 context 返回 hot/warm/cold 的同时，给 evidence 增加 provenance 字段：来源 task、AgentRun、Wiki note、activity。
3. 会话回放索引：保存每轮 cron 的 source-ledger、intake payload、验证输出，后续可按 task_id 回放。
4. 低成本检索：先用 Personal OS 数据库 BM25/keyword + recent activity；需要语义召回时再考虑 Wiki 侧 embedding，不引入外部 DB 作为前置条件。

## 不建议直接采用
- 不直接安装为全局 Hermes memory provider：它会引入新的 3111/3113/iii runtime、hooks 和凭据面，可能与 Personal OS/Wiki 真相源冲突。
- 不开启自动 LLM 压缩作为默认：成本、隐私和递归 hook 风险需要单独 gate。
- 不把其 action/lease 系统替代 Personal OS task lease；Personal OS 已经有 agent_allowed、riskLevel、leaseUntil。

## 风险
- README 中 benchmark 和 stars 是外部声明，未在本机复现；只能作为设计线索，不作为采购/迁移依据。
- 引入 MCP memory server 会扩大凭据和私密会话落盘范围；需要最小化、脱敏和本机端口绑定审计。
- 与现有 Personal Wiki 的长期知识边界重叠，若无 owner split 会产生“双真相源”。

## 结论
值得吸收设计，不建议立即部署 agentmemory 本体。下一步应实现 Personal OS 原生的 AgentRun context pack 自动归档 v0，把本轮评估的产物链作为样例。
