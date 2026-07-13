# swarmclawai/swarmvault 吸收价值评估

**评估时间：** 2026-07-01  
**任务ID：** cmr29r4v500ec0jnyctviteic  
**来源：** GitHub 雷达 2026-07-01，stars: 592，pushed_at: 2026-06-30T20:28:43Z

---

## 核心定位

SwarmVault 是 Andrej Karpathy LLM Wiki 模式的生产级实现。本地优先，离线可用，三层架构：

- `raw/` — 不可变源文件
- `wiki/` — LLM 生成 + 人工 markdown 知识库
- `swarmvault.schema.md` — 领域规则，人 + LLM 共同维护

npm: `@swarmvaultai/cli`，MIT 协议，Node >= 24。

---

## 与 Personal OS/Wiki 的适配点

| SwarmVault 能力 | Personal OS/Wiki 对应缺口 | 适配度 |
|---|---|---|
| MCP server (stdio) | /api/agent/context 向量召回薄弱 | 高 |
| Hybrid search (FTS + embeddings) | 当前 context API 无语义检索 | 高 |
| Agent Context Pack (token-bounded) | context 输出无 budget/cited/omissions | 高 |
| Agent Task Ledger | .agent-runs/ 只有 JSON，无可视化 | 中 |
| Contradiction detection | Personal Wiki 知识腐化无检测机制 | 中 |
| Typed graph edges (extracted/inferred/ambiguous) | Wiki graph 无 confidence 字段 | 中 |
| Hermes native install | Agent 集成现已支持 | 高（直接可用） |
| Obsidian graph export | 已有 Obsidian vault，可互补 | 中 |

---

## 风险

1. **Node >= 24 依赖**：需确认本机 node 版本
2. **社区规模**：stars=592，维护持续性待观察
3. **冷启动成本**：swarmvault.schema.md 需要人工维护
4. **全量迁移成本高**：不建议替换现有 Personal Wiki，建议作为检索增强层接入

---

## 结论

**值得吸收，分三阶段：**

1. 安装 CLI，quickstart 验证 MCP server 可用性（1-2h）
2. 接入 /api/agent/context MCP 工具层（对应 P0 任务 cmr28q5jt00ca0jnyxm8o03h0）
3. 参考 Agent Context Pack 设计重构 context 输出

---

## 外部来源

- GitHub: https://github.com/swarmclawai/swarmvault
- npm: https://www.npmjs.com/package/@swarmvaultai/cli
- 文档: https://www.swarmvault.ai/docs
