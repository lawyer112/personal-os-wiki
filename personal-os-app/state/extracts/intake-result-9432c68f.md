# intake-result
Format: JSON
Top-level: object
Size: 11
Nested depth: 5

## Schema

- ok: boolean
- inbox: object (11 keys)
- agentRunId: string
- project: object (8 keys)
- tasks: array (3 items)
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
    "id": "cmr35vrpa011k0jnynq057yza",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/github-radar-evaluation",
    "sourceMessageId": null,
    "rawText": "SwarmVault 评估完成：值得吸收，分三阶段进行。核心能力：本地优先 LLM Wiki、混合检索、MCP server、Agent Task Ledger。",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-07-02T07:06:52.030Z",
    "updatedAt": "2026-07-02T07:06:52.030Z"
  },
  "agentRunId": "cmr35vrpe011m0jnyn4qe2qp4",
  "project": {
    "id": "cmr1xndbz00170jnybuk3m9q3",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "提升 Codex、Hermes 与 Personal Wiki 的长期记忆、上下文召回和任务闭环能力。",
    "status": "active",
    "priority": "P0",
    "currentFocus": "GitHub 外部方案转成 Agent 自驱执行闭环",
    "createdAt": "2026-07-01T10:28:37.055Z",
    "updatedAt": "2026-07-02T07:06:52.039Z"
  },
  "tasks": [
    {
      "id": "cmr35vrps011r0jny6w6s9x7m",
      "title": "安装 SwarmVault CLI 并验证 MCP server 可用性",
      "description": "依赖：无。动作：确认 node >= 24 版本；npm install -g @swarmvaultai/cli；swarmvault quickstart /Users/xingqiwu/Documents/New\\ project\\ 5/personal-os-wiki/personal-os-app --no-serve；swarmvault mcp 启动验证；写 gate.json 记录结果。",
      "status": "todo",
      "priority": "P1",
      "riskLevel": "low",
      "executionMode": "agent_allowed",
      "agentTags": [
        "personal-os",
        "personal-wiki",
        "swarmvault",
        "agent-self-improvement"
…
```