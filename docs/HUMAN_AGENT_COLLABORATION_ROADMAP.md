# Human-Agent Collaboration Boundary

Personal OS + Personal Wiki is meant to work with agents, not replace them.
The public repository documents the reusable boundary:

```text
human input
  -> durable knowledge
  -> explicit tasks
  -> agent claim and execution
  -> evidence and review
  -> updated knowledge and project state
```

## Public Contract

- Personal OS owns work state: inbox, projects, tasks, claims, leases,
  contributions, artifacts, reviews, planner packets, and reminder payloads.
- Personal Wiki owns durable knowledge: Markdown notes, evidence, source
  records, tags, concepts, links, and graph data.
- Agents such as Hermes, OpenClaw, Codex, Claude Code, or scheduled workers
  execute work through the documented API contract.
- Notification adapters deliver planner/reminder payloads to Telegram, Feishu,
  Apple Reminders, email, or desktop notifications.

## What Belongs Here

Public docs can describe stable APIs, safety rules, fake demos, testable local
workflows, and implementation boundaries.

## What Does Not Belong Here

Private product bets, commercial rollout plans, customer-specific workflows,
real deployment topology, private task history, and detailed operating
roadmaps belong in a private repository or private Wiki vault.

For the current public API surface, read:

- [Agent Guide](./AGENT_GUIDE.md)
- [Agent Prompt](./AGENT_PROMPT.md)
- [API Overview](./API_OVERVIEW.md)
- [Maintenance Manual](./MAINTENANCE_MANUAL.md)
