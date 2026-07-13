# adoption-tasks
Format: JSON
Top-level: array
Size: 2
Nested depth: 3

## Schema

- (root) array (2)

## Preview

```json
[
  {
    "title": "实现 AgentRun context pack 自动归档 v0",
    "description": "对象是 .agent-runs/<task-id>/ 产物；动作是提取 worker-result、gate、source-ledger、测试、部署和风险并生成 Wiki note；产物是归档入口和一次真实 task_id 回放样例。",
    "status": "todo",
    "priority": "P1",
    "riskLevel": "low",
    "executionMode": "agent_allowed",
    "agentTags": ["personal-os", "personal-wiki", "agent-run", "context-pack"],
    "nextAction": "读取 .agent-runs/cmqyixt4a00n90jpk3todreos/ 下的 worker-result.json、gate.json、source-ledger/evidence.md，生成可通过 /api/intake 写回的 Wiki note。",
    "definitionOfDone": "对真实 task-id 运行后，Wiki note 包含 task_id、gate、diff、测试、部署、残余风险；Personal OS intake 返回 ok；不泄露 token。",
    "estimateMinutes": 120,
    "createdBy": "hermes"
  },
  {
    "title": "给 Personal OS evidence episodes 增加 provenance 字段 v0",
    "description": "对象是 /api/agent/context.evidence.episodes；动作是补充 source task、agentRun、wiki note、activity 的来源引用；产物是 API 字段和回归测试。",
    "status": "todo",
    "priority": "P1",
    "riskLevel": "low",
    "executionMode": "agent_allowed",
    "agentTags": ["personal-os", "agent-context", "provenance"],
    "nextAction": "扩展 agent-context evidence episode 序列化，让每条 episode 能回链到来源对象。",
    "definitionOfDone": "query=agent executable tasks personal os wiki 时，context.evidence.episodes 至少返回 id、type、title、source/provenance；npm test 或 npm run build 通过。",
    "estimateMinutes": 90,
    "createdBy": "hermes"
  }
]

```