# gate
Format: JSON
Top-level: object
Size: 7
Nested depth: 2

## Schema

- task_id: string
- status: string
- synthesizer: object (1 keys)
- checks: object (9 keys)
- dod_met: string
- residual_risk: string
- verified_at: string

## Preview

```json
{
  "task_id": "cmr35vrq6011t0jny68jy2rcz",
  "status": "pass",
  "synthesizer": { "allowed_to_announce_done": true },
  "checks": {
    "tsc_clean": true,
    "new_file_swarmvault_mcp_client": true,
    "agent_context_imports_swarmvault": true,
    "swarmvault_candidates_field_in_type": true,
    "getQueryAgentContext_calls_swarmvault": true,
    "getAgentContext_calls_swarmvault": true,
    "tests_3_pass": true,
    "full_suite_97_pass": true,
    "no_token_in_output": true
  },
  "dod_met": "/api/agent/context 类型定义新增 swarmvault.candidates 字段；searchSwarmVaultContext() 通过 MCP stdio 调用 SwarmVault context tool；getQueryAgentContext 和 getAgentContext 均并行调用；npm test 97 passed；tsc clean。",
  "residual_risk": "SwarmVault graph 当前为空（stale=true，未 swarmvault compile），实际召回依赖后续对项目目录执行 compile。AGENT_CONTEXT_SWARMVAULT_ENABLED 未在 .env.production 中启用，需 Classic 手动 opt-in。",
  "verified_at": "2026-07-03T07:11:00Z"
}

```