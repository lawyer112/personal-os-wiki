# SwarmVault 吸收评估证据

- **Repo**: swarmclawai/swarmvault
- **Stars**: 593 | **Last pushed**: 2026-06-30 | **License**: MIT
- **Source**: GitHub 雷达 2026-07-02，匹配信号 source-registry
- **评估日期**: 2026-07-02

## 核心能力

SwarmVault 是本地优先的 LLM Wiki + 知识图谱工具，遵循 Karpathy 三层架构：

1. **raw/** — 不可变原始文件
2. **wiki/** — LLM 生成 + 人工编写 Markdown
3. **swarmvault.schema.md** — vault 规则（可与 LLM 共同演化）

关键工具能力：
- `swarmvault mcp` — stdio MCP server，暴露 graph_status/context/task-ledger 等 tools
- `swarmvault context build "<goal>"` — token-bounded agent context pack，含引用链
- `swarmvault task start/update/finish` — task ledger，JSON+MD 归档，可 git commit
- `swarmvault query` + hybrid search（SQLite FTS + embedding）
- `swarmvault install --agent hermes` — Hermes agent 规则安装

## 与 Personal OS/Wiki 的适配点

| 场景 | SwarmVault 作用 |
|------|----------------|
| /api/agent/context 召回增强 | MCP tool 作为 swarmvault.candidates 补充层 |
| .agent-runs 归档 | task ledger 可与 worker-result.json 互补 |
| source registry | sources.json 设计可参考 github-radar source ledger |
| Personal Wiki 知识图谱 | graph export --obsidian 可导出至现有 Obsidian vault |

## 推荐接入路径

1. 先安装 CLI：`npm install -g @swarmvaultai/cli`（需要 Node >= 24）
2. 验证 MCP server：`swarmvault mcp` stdio 可调用
3. 在 Personal OS agent context 服务里增加 SwarmVault MCP tool call
4. 验收：`/api/agent/context?q=code+memory` 返回 `swarmvault.candidates` 字段

## 风险

- Node >= 24 依赖，需确认本机版本
- 与 Personal Wiki 并存需划清边界（作为工具/补充层，非替代品）
- MCP stdio 接入需要包装层

## 结论

**值得接入，建议以 MCP 补充层为切入点（P1 任务已存在）。**
不建议将 SwarmVault 作为 Personal Wiki 替代品；边界清晰时协同价值高。