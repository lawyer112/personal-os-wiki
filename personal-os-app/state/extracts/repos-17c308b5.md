# repos
Format: JSON
Top-level: object
Size: 2
Nested depth: 4

## Schema

- generated_at: string
- repos: array (8 items)

## Preview

```json
{
  "generated_at": "2026-06-24T08:30:24.362Z",
  "repos": [
    {
      "full_name": "swarmclawai/swarmvault",
      "url": "https://github.com/swarmclawai/swarmvault",
      "description": "The local-first LLM Wiki: open-source knowledge graph builder, RAG knowledge base, and agent memory store. Built on Andrej Karpathy's pattern. An Obsidian alternative for personal knowledge management, AI second brain, and durable Claude Code / Codex / OpenClaw memory.",
      "stars": 580,
      "pushed_at": "2026-06-12T10:39:15Z",
      "query": "AI personal knowledge management RAG memory stars:>50",
      "default_branch": "main",
      "score": 65.58,
      "signals": [
        "source-registry",
        "context-pack",
        "memory-tiering",
        "graph-recall",
        "agent-hooks",
        "doctor-next"
      ],
      "signalLabels": [
        "Source Registry / evidence ledger",
        "Agent context pack / task ledger",
        "Hot / warm / cold memory tiering",
        "Graph recall: FTS/vector/community/PPR/episodic traces",
        "Agent lifecycle hooks / MCP integration",
        "Doctor / next-command guidance"
      ],
      "adoption": [
        "把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。",
        "把 .agent-runs/<task-id>/ 自动归档成 Wiki note，包含 gate、diff、测试、部署、风险和下一步。",
        "让 /api/agent/context 输出 tiers.hot、tiers.warm、tiers.cold，优先喂给自驱执行器。"
      ],
      "readme_excerpt": "# SwarmVault <!-- readme-language-nav:start --> **Languages:** [English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) <!-- readme-language-nav:end --> [![npm](https://img.shields.io/npm/v/@swarmvaultai/cli)](https://www.npmjs.com/package/@swarmvaultai/cli) [![npm downloads](https://img.shields.io/npm/dw/@swarmvaultai/cli)](https://www.npmjs.com/package/@swarmvaultai/cli) [![GitHub stars](https://img.shi"
    },
    {
      "full_name": "ruvnet/agent-harness-generator",
      "url": "https://github.com/ruvnet/agent-harness-generator",
      "description": "🛠️ The meta-harness for AI agents — scaffold your own focused, branded agent harness with its own npx CLI, MCP server, memory, learning loop, and witness-signed releases. Works with Claude Code, Codex, pi.dev, Hermes, OpenClaw, and RVM (hardware-isolated sandbox).",
      "stars": 300,
…
```