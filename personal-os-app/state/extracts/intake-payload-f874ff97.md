# intake-payload
Format: JSON
Top-level: object
Size: 2
Nested depth: 2

## Schema

- source: object (4 keys)
- agent: object (3 keys)

## Preview

```json
{
  "source": {
    "sourceType": "agent-output",
    "sourcePlatform": "cron/agent-self-drive",
    "rawText": "本轮完成 P0 任务 cmr28q5jt00ca0jnyxm8o03h0（向量+episode 混合召回 PoC）的一个可执行子块：新增 agentmemory-client.ts（对本机 agentmemory smart-search 的超时/降级封装）和 embedding-providers.ts（openai-compatible/openai/ollama 三种 embedding provider adapter），把 agentmemory 命中并入 /api/agent/context 的 episode 证据链（combineEpisodes 按 relevanceScore 去重排序，上限 8 条）。新增 20 个单测全部通过，全量测试 94/94 通过，tsc 通过。用真实运行中的 agentmemory 服务（localhost:3111）验证 smart-search 返回真实结果（HTTP 200，含 obsId/score/title）。提交为本地 commit 0dda6ed，分支 codex/multi-agent-claim-next，未 push、未部署到 6.37（该任务 riskLevel=medium 且未完全满足 DoD 中的 token 预算/过期冲突标记要求，仅是可复用的一层，暂不对外宣布任务完成）。",
    "createdBy": "hermes"
  },
  "agent": {
    "model": "hermes-obsidianmanager1-cron",
    "reasoningSummary": "context 中未发现新的可认领 P0/P1 agent_allowed 任务处于 todo/doing/review 且无人占用；选择已有 P0 任务 cmr28q5jt00ca0jnyxm8o03h0（向量+episode 混合召回 PoC）里未完成的一块：接入 agentmemory 作为额外召回腿，补齐 embedding provider 适配层，为后续接入火山 Milvus/VikingDB 做准备。",
    "outputSummary": "新增 src/lib/agentmemory-client.ts、src/lib/embedding-providers.ts 及对应测试；agent-context.ts 的 getQueryAgentContext/getAgentContext 并入 agentmemory episode 召回；20 个新测试通过，94/94 全量测试通过，tsc 通过；本机 agentmemory:3111 smart-search 实测可用；已 commit 未 push 未部署。"
  }
}

```