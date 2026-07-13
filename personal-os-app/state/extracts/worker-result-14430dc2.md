# worker-result
Format: JSON
Top-level: object
Size: 9
Nested depth: 4

## Schema

- taskId: string
- title: string
- executedAt: string
- repo: string
- stars: number
- pushedAt: string
- evaluation: object (6 keys)
- status: string
- outputFiles: array (3 items)

## Preview

```json
{
  "taskId": "cmr29r4v500ec0jnyctviteic",
  "title": "GitHub 雷达 2026-07-01：评估 swarmclawai/swarmvault 的吸收价值",
  "executedAt": "2026-07-01T19:05:00.000Z",
  "repo": "swarmclawai/swarmvault",
  "stars": 592,
  "pushedAt": "2026-06-30T20:28:43Z",
  "evaluation": {
    "coreCabilities": [
      "本地优先 LLM Wiki：raw/wiki/schema 三层架构（Karpathy 模式），离线可用",
      "知识图谱构建：typed edges (extracted/inferred/ambiguous)，矛盾检测，社区聚类",
      "混合检索：SQLite FTS + 语义 embedding，支持 rerank",
      "Agent Context Pack：token-bounded 上下文打包，写入 wiki/context/",
      "MCP server：stdio 协议，暴露 graph query/update/context/task-ledger 等工具",
      "30+ 输入格式：PDF/docx/epub/srt/代码/URL/YouTube/音频/图片等",
      "Hermes Agent 集成支持：swarmvault install --agent hermes",
      "Agent Task Ledger：swarmvault task start/update/finish，git-friendly JSON + markdown",
      "Obsidian 图谱导出：带 Breadcrumbs/Juggl frontmatter，Dataview dashboard"
    ],
    "fitWithPersonalOS": {
      "score": "高",
      "reasons": [
        "MCP server 可直接接入 Personal OS agent context 管道，补充 Wiki 检索层",
        "三层架构（raw/wiki/schema）与 Personal OS/Wiki 分工天然匹配",
        "hybrid search 可补强当前 /api/agent/context 向量召回缺失（对应 P0 任务 cmr28q5jt00ca0jnyxm8o03h0）",
        "Agent Task Ledger 可作为 .agent-runs/ 的可视化层或替代",
        "Hermes 原生集成支持，无需自定义 adapter",
        "offline/local 优先，不依赖外部 API key，适合本机 6.37 部署"
      ]
    },
    "absorbableDesigns": [
      {
        "design": "三层知识架构模式",
        "absorb": "参考 raw/wiki/schema 分层，强化 Personal Wiki 的 source ledger 设计"
      },
      {
        "design": "MCP server stdio 接口",
        "absorb": "考虑为 Personal Wiki 暴露 MCP endpoint，供 Agent 直接 tool-call"
      },
      {
…
```