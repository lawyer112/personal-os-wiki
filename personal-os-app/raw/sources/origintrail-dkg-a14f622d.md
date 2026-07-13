# OriginTrail/dkg 评估报告

## 信息摘要
- URL: https://github.com/OriginTrail/dkg
- Score: 55.16 (GitHub 雷达)
- 版本: DKG V10 (release candidate on testnet)
- 定位: 去中心化知识基础设施，多 agent AI 记忆层

## 核心设计

### 1. 三层记忆架构
| 层级 | 范围 | 成本 | 信任 | 持久性 |
|---|---|---|---|---|
| Working Memory (WM) | 私有 | 免费 | 自证 | 本地，重启保留 |
| Shared Working Memory (SWM) | 对等体可见 | 免费 | 自证 + gossip 复制 | TTL 限制 |
| Verifiable Memory (VM) | 永久链上 | TRAC 代币 | 自证 → 背书 → 共识验证 | 永久 |

### 2. Knowledge Asset (KA)
- RDF triples 组成
- Merkle proof 捆绑
- 区块链锚定
- 内容不可篡改，可通过重计算验证

### 3. Context Graph
- 作用域知识域（类似 "project"）
- 可配置访问和治理
- 支持 M-of-N 多签名
- 可划分子图

### 4. MCP 集成
- 已经实现 MCP server (`@origintrail-official/dkg-mcp`)
- 支持 Cursor、Claude Code、Claude Desktop、Windsurf、VSCode + Copilot、Cline、Codex CLI
- 提供 tools: `dkg_knowledge_asset_create`, `dkg_knowledge_asset_write`, `dkg_memory_search`
- 设置流程: `dkg mcp setup` 幂等性一键配置

### 5. 森林设计
- Hermes/OpenClaw/ElizaOS 适配器
- 本地节点 + 对等网络
- 无中央权威、无 API 网关

## 与 Personal OS / Wiki 的映射

### 已有对齐
- DKG 三层记忆 → Personal OS 已有 hot/warm/cold context tiering，但没有明确的晋升逻辑
- Context Graph → Personal Wiki 已有项目分类，但没有细粒度的作用域控制和共享机制

### 缺失对齐
- 去中心化 vs 本地中心化: Personal OS/Wiki 是本地优先的单体架构，不需要区块链和 TRAC
- 验证机制: 我们没有加密学验证需求，信任基于环境控制
- Gossip 协议: 局域网/本地场景不需要对等网络层

## 可吸收组件（按优先级）

### P1: 实现 Personal OS / Wiki 的 MCP Server
- **为什么**: DKG 的 MCP 集成是其最成熟的设计。Personal OS/Wiki 应该提供自己的 MCP server，让 Claude Code、Codex 等工具可以直接查询任务、写入 Wiki、提取知识。
- **验证方式**: 在 Claude Desktop 或 VSCode 中配置 MCP server，运行 `tools/list` 并调用查询任务和写入笔记。
- **拒绝理由**: 无。这是明确的能力补全。

### P2: 为 Wiki 引入 Context Graph 概念
- **为什么**: 当前 Wiki 的项目分类是平面的。可以引入作用域控制（比如某些笔记只对特定 Agent 可见）和子图分区。
- **验证方式**: 在 frontmatter 中增加 `scope`、`visibility`、`subgraph` 字段，让 /api/agent/context 可以按作用域过滤。
- **拒绝理由**: 我们当前没有多 Agent 协作事实，这是过度设计，可以先做前期调研。

### P3: 引入图谱检索方法
- **为什么**: DKG 提供了 community detection、PPR、episodic traces 等 graph recall 方法。这可以增强 Wiki 的检索能力，让不仅仅是关键词匹配，还能通过关系推理。
- **验证方式**: 尝试在 Personal Wiki 中引入基于链接的 graph recall（如笔记间的双向链接）。
- **拒绝理由**: 当前没有充足的图数据，需要先建立笔记间的关系网络。

## 拒绝吸收的组件

1. **区块链锚定 / TRAC 代币**: Personal OS/Wiki 是本地优先的单体系统，不需要密码学验证和永久链上存储。
2. **Gossip 对等网络**: 局域网/本地场景不需要对等网络。
3. **M-of-N 签名验证**: 目前没有多签名治理场景。

## 总体结论

**部分吸收，优先级 P1 (MCP Server) > P2 (Context Graph) > P3 (Graph Recall)**

OriginTrail/dkg 的最大价值不在于去中心化本身，而在于它作为多 agent 记忆层的设计思路：三层记忆、作用域控制、MCP 接口。这些设计可以被拆解并吸收进本地优先的 Personal OS/Wiki 架构中，而不需要区块链层。

## 后续任务

1. **P1**: 实现 Personal OS / Wiki MCP Server v0（提供 tools/list + dkg_memory_search 类似接口）
2. **P2**: 调研 Context Graph 作用域设计，在 Wiki frontmatter 中增加 scope 字段
3. **P3**: 评估图谱检索方法的本地实现可行性

## 利用率评分
- 直接可贡献设计: 8/10（三层记忆、MCP、Context Graph）
- 直接可贡献代码: 2/10（大部分代码绑定于区块链协议和对等网络）
- 整体推荐度: 推荐吸收设计思路，不推荐引入代码依赖
