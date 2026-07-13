# adoption-tasks
Format: JSON
Top-level: array
Size: 4
Nested depth: 3

## Schema

- (root) array (4)

## Preview

```json
[
  {
    "title": "实现 GitHub 雷达 Source Registry 写回 v0",
    "description": "对象是 GitHub 雷达运行结果；动作是保存 repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki 与 Task；产物是可复跑脚本和一次真实写回记录。",
    "status": "todo",
    "priority": "P0",
    "riskLevel": "low",
    "executionMode": "agent_allowed",
    "agentTags": [
      "personal-os",
      "personal-wiki",
      "github-radar",
      "agent-self-improvement"
    ],
    "requiredOutput": "运行 github-radar-intake.mjs --intake 后，生成本地证据目录，并在 Personal OS 出现 Wiki note、ProjectEvent、至少 1 个 agent_allowed 任务；日志不含 token。",
    "nextAction": "对象是 GitHub 雷达运行结果；动作是保存 repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki 与 Task；产物是可复跑脚本和一次真实写回记录。",
    "definitionOfDone": "运行 github-radar-intake.mjs --intake 后，生成本地证据目录，并在 Personal OS 出现 Wiki note、ProjectEvent、至少 1 个 agent_allowed 任务；日志不含 token。",
    "estimateMinutes": 120,
    "createdBy": "hermes"
  },
  {
    "title": "把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0",
    "description": "对象是 Personal OS agent context API；动作是按执行优先级给任务、Wiki、Activity、Idea 分层；产物是 tiers 字段和回归测试。",
    "status": "todo",
    "priority": "P0",
    "riskLevel": "low",
    "executionMode": "agent_allowed",
    "agentTags": [
      "personal-os",
      "personal-wiki",
      "memory-tiering",
      "agent-self-improvement"
    ],
    "requiredOutput": "query=personal os wiki 时返回 tiers.hot、tiers.warm、tiers.cold；hot 含当前 P0/P1 agent_allowed task 或最近阻塞；npm test/tsc/lint/build 通过。",
    "nextAction": "对象是 Personal OS agent context API；动作是按执行优先级给任务、Wiki、Activity、Idea 分层；产物是 tiers 字段和回归测试。",
    "definitionOfDone": "query=personal os wiki 时返回 tiers.hot、tiers.warm、tiers.cold；hot 含当前 P0/P1 agent_allowed task 或最近阻塞；npm test/tsc/lint/build 通过。",
    "estimateMinutes": 120,
    "createdBy": "hermes"
  },
  {
…
```