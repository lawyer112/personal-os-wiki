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
  "generated_at": "2026-06-29T01:13:15.894Z",
  "repos": [
    {
      "full_name": "rohitg00/agentmemory",
      "url": "https://github.com/rohitg00/agentmemory",
      "description": "#1 Persistent memory for AI coding agents based on real-world benchmarks",
      "stars": 24226,
      "pushed_at": "2026-06-28T19:25:19Z",
      "query": "OpenClaw Hermes Codex memory agent",
      "default_branch": "main",
      "score": 70,
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
      "readme_excerpt": "<p align=\"center\"> <img src=\"assets/banner.png\" alt=\"agentmemory — Persistent memory for AI coding agents\" width=\"720\" /> </p> <p align=\"center\"> <strong> Your coding agent remembers everything. No more re-explaining. Built on <a href=\"https://github.com/iii-hq/iii\">iii engine</a> </strong><br/> Persistent memory for Claude Code, GitHub Copilot CLI, Cursor, Gemini CLI, Codex CLI, Hermes, OpenClaw, pi, OpenCode, and a"
    },
    {
      "full_name": "ruvnet/agent-harness-generator",
      "url": "https://github.com/ruvnet/agent-harness-generator",
      "description": "🛠️ The meta-harness for AI agents — scaffold your own focused, branded agent harness with its own npx CLI, MCP server, memory, learning loop, and witness-signed releases. Works with Claude Code, Codex, pi.dev, Hermes, OpenClaw, and RVM (hardware-isolated sandbox).",
      "stars": 343,
…
```