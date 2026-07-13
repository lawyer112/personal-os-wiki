# adoption-tasks
Format: JSON
Top-level: array
Size: 3
Nested depth: 3

## Schema

- (root) array (3)

## Preview

```json
[
  {
    "title": "安装 SwarmVault CLI 并验证 MCP server 可用性",
    "priority": "P1",
    "owner": "agent",
    "executionMode": "agent_allowed",
    "estimatedMinutes": 60,
    "actions": [
      "确认 node >= 24 版本",
      "npm install -g @swarmvaultai/cli",
      "swarmvault quickstart /Users/xingqiwu/Documents/New\\ project\\ 5/personal-os-wiki/personal-os-app --no-serve",
      "swarmvault mcp 启动验证",
      "写 gate.json 记录结果"
    ],
    "definitionOfDone": "swarmvault mcp 能正常 stdio 启动，graph_status/context tools 可调用；写 .agent-runs/swarmvault-mcp-smoke/gate.json"
  },
  {
    "title": "接入 SwarmVault MCP 到 /api/agent/context 作为 hybrid search 补充层",
    "priority": "P1",
    "owner": "agent",
    "executionMode": "agent_allowed",
    "estimatedMinutes": 120,
    "dependsOn": "安装 SwarmVault CLI 并验证 MCP server 可用性",
    "actions": [
      "在 Personal OS agent context 服务里增加 SwarmVault MCP tool call",
      "query=代码 x 记忆 时同时查 SwarmVault graph + Personal OS episodic",
      "合并返回 tiers.hot 里的 swarmvault candidates",
      "新增集成测试"
    ],
    "definitionOfDone": "/api/agent/context?q=code+memory 返回 swarmvault.candidates 字段；npm test 通过"
  },
  {
    "title": "参考 SwarmVault Agent Context Pack 设计重构 context 输出 budget/cited/omissions",
    "priority": "P2",
    "owner": "agent",
    "executionMode": "agent_allowed",
    "estimatedMinutes": 120,
    "actions": [
      "研究 swarmvault context build 输出格式",
      "为 /api/agent/context 增加 budget 参数和 omissions 字段",
…
```