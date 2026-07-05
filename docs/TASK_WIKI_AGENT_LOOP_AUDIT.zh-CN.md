# Task / Wiki / Agent Loop Audit

日期：2026-07-05

## 结论

Personal OS 的任务协议不是空配置，核心链路已经存在并通过了本地测试与线上最小冒烟：

```text
intake 创建任务 -> agent-inbox 返回可执行任务 -> Agent claim
  -> heartbeat -> contribution -> submit review -> reviewer archive/done
```

这回答了当前最关键的问题：任务可以被 Agent 认领，指定 Agent profile 可以认领，认领后可以写回心跳、贡献、提交和 review 结果，完成或归档后会从 agent inbox / 今日任务面板移出。

但还有四个重要缺口：

1. Personal OS 本身不主动调度 Agent，外部 Hermes / Claude Code / Codex worker 必须轮询 `agent-inbox` 并执行协议。
2. OS 不会自动从 Wiki 全库挖潜在任务；`/api/intake` 接收的是上游 Agent 已经提炼好的 `tasks[]` 和 `wikiNotes[]`。
3. 任务面板能显示 execution trail 和 Wiki 链接，但列表卡片没有强展示 `ownerAgent / leaseUntil / heartbeat`，不利于一眼判断谁正在干活。
4. 火山/字节向量库没有接入当前运行链路；代码里只有 schema、文档和关键词扩展提到 vector / VolcengineRetriever。

## 已验证

### 本地测试

在 `personal-os-app` 执行：

```bash
npm test
```

结果：

```text
Test Files  22 passed (22)
Tests       93 passed (93)
```

重点覆盖：

- `tests/routes/agent-task-protocol.test.ts`
  - claim / heartbeat / contribution / submit / review / complete route 转发
  - read token 不能写任务协议状态
- `tests/services/agent-tasks.test.ts`
  - list agent inbox
  - claim lease
  - concurrent claim conflict
  - reject non-agent-allowed task
  - reject high risk auto-claim
  - heartbeat
  - contribution / artifact write
  - submit to review
  - approve to done
  - reject back to todo
  - request_changes / block / archive 状态映射
- `tests/services/tasks.test.ts`
  - create task
  - persist explicit Wiki links
  - complete task
  - reopen task
- `tests/routes/intake-wiki-fallback.test.ts`
  - Wiki write failure does not block OS task writes
  - successful Wiki writes become `TaskWikiLink` on tasks created by the same intake
- `tests/scripts/agent-helpers.test.ts`
  - heartbeat helper help output
  - smoke helper dry-run plan without token / network
- `tests/services/agent-context.test.ts`
  - Wiki candidates
  - query planning
  - agent run episode recall
  - hot / warm / cold tiers

### 线上最小闭环

对 `http://192.168.6.37:3100` 执行了一条低风险合成任务，未输出任何 token。

测试任务：

```text
task_id: cmr76rpjp01at0jp8qmes1zdt
title: Codex E2E task protocol smoke 2026-07-05T02-42-46-810Z
agent: codex-e2e-verifier
final_status: archived
```

最新一次复验：

```text
task_id: cmr78dvrs01ge0jp8kzmbn4vu
agent: codex-e2e-verifier
final_status: archived
inbox_after_contains_task: false
```

步骤结果：

| Step | HTTP | Result |
| --- | ---: | --- |
| upsert profile | 201 | ok |
| intake create task | 201 | ok |
| agent inbox before claim | 200 | ok, returned the task |
| claim task | 200 | task became `doing` |
| heartbeat task | 200 | owner remained `codex-e2e-verifier` |
| write contribution | 201 | contribution created |
| submit task | 200 | task became `review` |
| review archive | 200 | task became `archived` |
| read final task | 200 | final status `archived` |
| agent inbox after archive | 200 | archived task not returned |

## 代码证据

### 数据模型

`personal-os-app/prisma/schema.prisma` includes:

- `Task.ownerAgent`
- `Task.leaseUntil`
- `Task.lastHeartbeatAt`
- `Task.executionMode`
- `Task.agentTags`
- `TaskClaim`
- `TaskContribution`
- `TaskArtifact`
- `TaskReview`
- `TaskWikiLink`

### Agent 协议

`personal-os-app/src/lib/agent-tasks.ts` implements:

- `listAgentInboxTasks`
- `claimTask`
- `heartbeatTask`
- `addTaskContribution`
- `submitTask`
- `reviewTask`

`personal-os-app/src/app/api/` exposes:

- `GET /api/agent-inbox`
- `POST /api/tasks/[id]/claim`
- `POST /api/tasks/[id]/heartbeat`
- `POST /api/tasks/[id]/contributions`
- `POST /api/tasks/[id]/submit`
- `POST /api/tasks/[id]/review`
- `POST /api/tasks/[id]/complete`

Script helpers:

- `personal-os-app/scripts/agent-run-next.mjs` can poll and claim the next task.
- `personal-os-app/scripts/agent-heartbeat.mjs` can renew a long-running task lease.
- `personal-os-app/scripts/agent-writeback.mjs` can write contribution / submit / approve.
- `personal-os-app/scripts/agent-protocol-smoke.mjs` can run a reusable live smoke test for profile / intake / inbox / claim / heartbeat / contribution / submit / review archive.

### Wiki / Task 联动

`personal-os-app/src/app/api/intake/route.ts`:

- creates `InboxItem`;
- starts and completes `AgentRun`;
- writes `wikiNotes[]` through Personal Wiki ingest;
- creates `tasks[]`;
- attaches successful Wiki writes as `TaskWikiLink`;
- records `wiki_write_status`.

Important boundary: intake does not mine Wiki by itself. It persists task candidates supplied by the upstream Agent.

Another boundary: `updateTask` currently ignores `wikiLinks` updates. TaskWikiLink creation is supported at task creation time, but ongoing relink / unlink maintenance is not implemented through the generic task PATCH path.

### 前端面板

`personal-os-app/src/components/TaskInspector.tsx` displays:

- task details;
- Agent execution trail;
- claims;
- contributions;
- artifacts;
- reviews;
- bound Wiki links.

`personal-os-app/src/components/TaskStatusControls.tsx` and `ReviewTaskCard.tsx` support manual status changes including `archived`.

Current UX gap: archive / ignore is one click and has no explicit confirm step, even though agent context policy says `mustConfirmDelete: true`.

## GitHub 调研吸收点

近期对照项目：

- [`block/agent-task-queue`](https://github.com/block/agent-task-queue)
  - Absorb: queue capacity, avoiding concurrent expensive operations, explicit queue names.
  - Do not copy directly: it is a queue primitive, not a task evidence/review control plane.
- [`tasksmd/tasks.md`](https://github.com/tasksmd/tasks.md)
  - Absorb: vendor-neutral task format, linter, agent-native next-task loop.
  - Do not replace DB with it unless a file-based offline mode is needed.
- [`SamurAIGPT/llm-wiki-agent`](https://github.com/SamurAIGPT/llm-wiki-agent)
  - Absorb: source ingest boundary, wiki lint, contradiction detection, graph build.
  - Gap relative to us: no first-class task claim / evidence / review state.
- [`matheusbgodoi/obsidian-agentic-rag`](https://github.com/matheusbgodoi/obsidian-agentic-rag)
  - Absorb: local hybrid search, separate keyword / semantic / full note tools, status endpoint.
  - Keep as retrieval inspiration, not product center.

## Vector / 火山向量库判断

Current state:

- No production code calls a Volcengine / ByteDance vector API.
- No environment variable in `personal-os-app/.env.example` or `docker-compose.prod.yml` configures a vector provider.
- `agent-context.ts` only uses `VolcengineRetriever` and `火山方舟 向量` as query expansion terms.
- `schemas/classic-knowledge-object-manifest.schema.json` includes embedding metadata, but this is manifest structure, not runtime retrieval.

Decision:

Do not leave "vector database" as a pretend dependency. Pick one:

1. Implement it as an optional hybrid retrieval adapter with smoke test, benchmark, citations, and fallback.
2. Remove or hide provider-specific references until there is a working adapter.

Recommended next step: keep vector as optional, but rename current provider-specific wording to neutral `optionalEmbeddingRetriever` unless a real Volcengine adapter is added.

## Next Engineering Tasks

本次 PR 已完成的 P0：

- Add route-level tests for the full protocol endpoints, not only service-level tests.
- Add a route-level test for successful intake creating `TaskWikiLink` from a successful Wiki ingest result.
- Add tests for `reviewTask` decisions: `request_changes`, `block`, and `archive`.
- Add a scripted live smoke command for `profile -> intake -> inbox -> claim -> heartbeat -> contribution -> submit -> review`.
- Add a heartbeat helper to the agent script layer.

剩余 P0：

- Make task archive / ignore require explicit confirmation in UI.
- Show `ownerAgent`, lease expiry, and stale heartbeat state on task cards.

P1:

- Add an Agent worker runbook: how Codex / Claude Code / Hermes should poll, claim, heartbeat, submit, and write evidence.
- Add an `/api/agent/context` retrieval benchmark with at least 10 real queries comparing keyword-only vs hybrid candidates.
- Decide whether Volcengine vector is implemented or removed from visible runtime expectations.

P2:

- Add Wiki-to-task extraction as a separate upstream worker, not hidden inside OS read APIs.
- Add stale lease recovery UI and activity filters.
- Add GitHub ecosystem notes to the release checklist.
