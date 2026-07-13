# SwarmVault 评估：swarmclawai/swarmvault

task_id: cmqrtcdz0002o0jo8iprtzp0a
generated_at: 2026-06-24T11:00:00Z
created_by: hermes:worker
source_type: agent-output
repo: swarmclawai/swarmvault
stars: 581
forks: 73
license: MIT
language: TypeScript

## 核心能力

1. **本地优先 LLM Wiki**：三层架构（Raw Sources -> Wiki -> Schema），LLM 负责维护，人负责审批。
2. **混合检索**：SQLite FTS5 + 外部 embeddings + RRF（Reciprocal Rank Fusion）融合 + optional rerank。
3. **知识图**：静态 GraphArtifact（nodes/pages/edges/hyperedges），支持社区检测、矛盾检测、 freshness 追踪。
4. **ProviderAdapter**：统一的 embedding/query provider 抽象，支持 ollama / openai-compatible。
5. **审批队列**：compile --approve，新概念先进入 candidates，再人工/规则审批。
6. **上下文包**：token-budgeted handoff（context build --budget 8000），生成可 cited 的上下文。
7. **任务账本**：task start|update|finish|resume，记录为 git-friendly JSON，带 graph evidence。
8. **MCP Server**：支持 30+ agents（Claude Code, Codex, Cursor, OpenClaw 等）。

## 与 Personal OS/Wiki 的适配点

| SwarmVault 能力 | Personal OS 现状 | 适配度 | 说明 |
|---|---|---|---|
| 混合检索（FTS + embeddings + RRF） | 已有 FTS5 + cosine similarity，无 RRF | ⭐⭐⭐⭐ | 直接替换搜索层合并逻辑即可提升排名质量 |
| Retrieval manifest + stale 检查 | 无 manifest，无 stale 检测 | ⭐⭐⭐⭐ | 可迁移为 searchHealth API，自动修复 |
| ProviderAdapter | embedding 调用分散在各处 | ⭐⭐⭐ | 抽象统一，减少重复代码 |
| 审批队列（candidates） | 已有 review 状态任务 | ⭐⭐⭐ | 概念对齐，可借鉴文件级审批流 |
| Token-budgeted context | context API 无 budget 控制 | ⭐⭐⭐ | 可给 /api/agent/context 加 budget 参数 |
| 静态 GraphArtifact | 动态 Prisma + SQLite 查询 | ⭐⭐ | 静态图有性能优势，但引入 compile 步骤和 stale 问题；暂不吸收 |
| MCP Server | 通过 HTTP API 提供上下文 | ⭐⭐ | 生态更广，但 Personal OS 内部 Agent 已有 HTTP 通道，优先级低 |

## 可吸收设计（具体代码/模式）

### 1. RRF 合并搜索（`mergeSearchResults`）
直接复制到 Personal Wiki 搜索服务。当前 Personal Wiki 做 FTS 后，再跑一遍向量相似度，但合并逻辑简单（加权平均）。RRF 是标准做法，不需要调参，且 SwarmVault 已有测试覆盖。

### 2. Retrieval manifest + doctor
`getRetrievalStatus` / `doctorRetrieval` / `writeRetrievalManifest` 可以迁移为 Personal OS 的 `searchHealth` API：
- 记录 index 版本（graphHash）。
- 检测 stale（index 与当前数据不一致）。
- 自动修复（repair: true）。

### 3. EmbeddableItem 构建策略
`buildEmbeddableItems` / `itemTextForPage` / `itemTextForNode` 把图实体转成 embedding 文本的策略：
- page：kind + title + path + sourceType + sourceClass + 前 1200 字符内容。
- node：type + label + sourceClass + language + page title + 前 800 字符内容。
- hyperedge：label + relation + why + node labels。
可直接复用到 Personal Wiki 的 note/concept embedding 文本生成。

### 4. ProviderAdapter 抽象
`resolveEmbeddingProvider` / `createProvider` 的封装方式比 Personal OS 目前的零散 provider 调用更干净。值得把 Personal OS 的 ollama / openai embedding 调用统一成类似 adapter。

## 风险

1. **Node >= 24 要求**：SwarmVault 使用 `node:sqlite`（Node 24+ 内置）。Personal OS 目前 Node 20 + `better-sqlite3`。直接移植需要改驱动层（`DatabaseSync` -> `better-sqlite3`），但 FTS5 语法通用，工作量可控。
2. **耦合文件结构**：SwarmVault 引擎假设 vault 有 `raw/wiki/state/.obsidian/agent` 目录。Personal OS 使用 `data/vault` + 数据库存储，文件结构不同。不能作为 npm 包直接引入，只能手动提取代码。
3. **外部 embedding 依赖**：默认依赖外部 provider（ollama/openai）。Personal OS 已有本地 embedding，但 ProviderAdapter 仍值得吸收。
4. **静态图 vs 动态图**：静态 GraphArtifact 需要 compile 步骤，会引入 stale 问题。Personal OS 目前动态查询性能足够，暂不引入 compile 步骤。
5. **可持续性风险**：581 stars，但 repo 创建于 2026-04-06，仅约 2 个月；作者组织 swarmclawai 是新账号，长期维护存疑。MIT 协议允许 fork，但需评估后续跟进成本。

## 结论

**值得吸收：混合检索设计（RRF + manifest + doctor）和 ProviderAdapter 抽象。**
**不值得直接依赖：SwarmVault 引擎作为库。**

应手动提取可移植代码到 Personal OS / Wiki 代码库，而非引入 `@swarmvaultai/engine` 依赖。

## 下一步（子任务）

1. 吸收 SwarmVault 混合检索设计（RRF + manifest + doctor）到 Personal Wiki。
2. 吸收 SwarmVault ProviderAdapter 抽象到 Personal OS embedding 层。
