# SwarmVault MCP Integration Implementation Plan

Task ID: cmr35vrq6011t0jny68jy2rcz
Started: 2026-07-03T07:05:15Z

## Goal
接入 SwarmVault MCP 到 /api/agent/context 作为 hybrid search 补充层

## Implementation Steps

1. Create `src/lib/swarmvault-mcp-client.ts`
   - MCP stdio client wrapper
   - Call context/search tools via MCP
   - Map results to SwarmVaultContextHit type
   - Environment-based enable/disable toggle

2. Update `src/lib/agent-context.ts`
   - Import swarmvault client
   - Add swarmvault.candidates field to AgentContextPack type
   - Call swarmvault in parallel with wiki/agentmemory
   - Merge results into evidence.episodes

3. Add tests in `tests/services/swarmvault-mcp-client.test.ts`
   - Test MCP client initialization
   - Test context search mapping
   - Test disabled behavior
   - Test error fallback

4. Update `.env.example` with AGENT_CONTEXT_SWARMVAULT_* vars

5. Run verification:
   - npm test
   - Manual curl test with ?q=code+swarmvault

## Environment Variables
- AGENT_CONTEXT_SWARMVAULT_ENABLED=true/false
- AGENT_CONTEXT_SWARMVAULT_PROJECT_ROOT (default: cwd)
- AGENT_CONTEXT_SWARMVAULT_LIMIT (default: 5, max: 10)
- AGENT_CONTEXT_SWARMVAULT_TIMEOUT_MS (default: 2000, max: 5000)

## DoD
/api/agent/context?q=code+memory 返回 swarmvault.candidates 字段；npm test 通过
