# intake-result
Format: JSON
Top-level: object
Size: 11
Nested depth: 6

## Schema

- ok: boolean
- inbox: object (11 keys)
- agentRunId: string
- project: object (8 keys)
- tasks: array (1 items)
- ideas: array (0 items)
- notes: array (0 items)
- projectEvents: array (1 items)
- wiki: array (1 items)
- wiki_write_status: object (7 keys)
- notification: null

## Preview

```json
{
  "ok": true,
  "inbox": {
    "id": "cmr2mewbb00mt0jnyn80k63f8",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/github-radar",
    "sourceMessageId": null,
    "rawText": "GitHub 雷达运行：筛选 8 个 repo，生成 1 个候选任务。",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-07-01T22:01:52.151Z",
    "updatedAt": "2026-07-01T22:01:52.151Z"
  },
  "agentRunId": "cmr2mewbe00mv0jnyxdrbyues",
  "project": {
    "id": "cmr1xndbz00170jnybuk3m9q3",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "提升 Codex、Hermes 与 Personal Wiki 的长期记忆、上下文召回和任务闭环能力。",
    "status": "active",
    "priority": "P0",
    "currentFocus": "GitHub 外部方案转成 Agent 自驱执行闭环",
    "createdAt": "2026-07-01T10:28:37.055Z",
    "updatedAt": "2026-07-01T22:01:52.158Z"
  },
  "tasks": [
    {
      "id": "cmr2mewbo00n00jnyo4vhlwfs",
      "title": "GitHub 雷达 2026-07-01：评估 swarmclawai/swarmvault 的吸收价值",
      "description": "本轮雷达发现 swarmclawai/swarmvault（stars: 592, pushed_at: 2026-06-30T20:28:43Z）。描述：The local-first LLM Wiki: open-source knowledge graph builder, RAG knowledge base, and agent memory store. Built on Andrej Karpathy's pattern. An Obsidian alternative for personal knowledge management, AI second brain, and durable Claude Code / Codex / OpenClaw memory.。匹配信号：source-registry。把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。",
      "status": "todo",
      "priority": "P0",
      "riskLevel": "low",
      "executionMode": "agent_allowed",
      "agentTags": [
        "personal-os",
        "personal-wiki",
        "github-radar",
        "agent-self-improvement"
…
```