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
- tasks: array (1 items)
- ideas: array (0 items)
- notes: array (0 items)
- projectEvents: array (1 items)
- wiki: array (0 items)
- wiki_write_status: object (5 keys)
- notification: null

## Preview

```json
{"ok":true,"inbox":{"id":"cmr05ep0801fp0jpky9p5i3yo","sourceType":"agent-output","sourcePlatform":"cron/personal-os-agent-executor","sourceMessageId":null,"rawText":"Agent task cmr009fvb01bx0jpk7yhseb6u completed: 给 Personal OS evidence episodes 增加 source/provenance 字段；验证 agent-context 测试和 lint 通过。","sourceUrl":null,"attachments":[],"status":"new","createdBy":"hermes","receivedAt":"2026-06-30T04:30:16.856Z","updatedAt":"2026-06-30T04:30:16.856Z"},"agentRunId":"cmr05ep1301fr0jpkuxoixuoy","project":{"id":"cmqq290nm00040jmj9jwa98ya","name":"Personal OS / Wiki 知识库升级","goal":"保持 Hermes 多 Agent 运行可观测、轻量和可恢复。","status":"active","priority":"P2","currentFocus":"Hermes tool and memory bridge maintenance","createdAt":"2026-06-23T03:04:11.410Z","updatedAt":"2026-06-30T04:30:16.894Z"},"tasks":[{"id":"cmr05ep1f01fu0jpk8gd8cszw","title":"给 Personal OS evidence episodes 增加 provenance 字段 v0","description":null,"status":"review","priority":"P1","riskLevel":"low","executionMode":"manual","agentTags":[],"ownerAgent":null,"leaseUntil":null,"lastHeartbeatAt":null,"requiredOutput":null,"nextAction":"部署到 6.37 后验证 /api/agent/context?q=agent executable tasks personal os wiki 的 evidence.episodes 返回 source/provenance。","definitionOfDone":"context.evidence.episodes 至少返回 id、type、title、source/provenance；npm test 或 npm run build 通过。","dueDate":null,"estimateMinutes":null,"createdBy":"hermes","createdAt":"2026-06-30T04:30:16.899Z","updatedAt":"2026-06-30T04:30:16.899Z","completedAt":null,"submittedAt":null,"projectId":"cmqq290nm00040jmj9jwa98ya","sourceInboxItemId":"cmr05ep0801fp0jpky9p5i3yo","sourceAgentRunId":"cmr05ep1301fr0jpkuxoixuoy","project":{"id":"cmqq290nm00040jmj9jwa98ya","name":"Personal OS / Wiki 知识库升级","goal":"保持 Hermes 多 Agent 运行可观测、轻量和可恢复。","status":"active","priority":"P2","currentFocus":"Hermes tool and memory bridge maintenance","createdAt":"2026-06-23T03:04:11.410Z","updatedAt":"2026-06-30T04:30:16.894Z"},"sourceInboxItem":{"id":"cmr05ep0801fp0jpky9p5i3yo","sourceType":"agent-output","sourcePlatform":"cron/personal-os-agent-executor","sourceMessageId":null,"rawText":"Agent task cmr009fvb01bx0jpk7yhseb6u completed: 给 Personal OS evidence episodes 增加 source/provenance 字段；验证 agent-context 测试和 lint 通过。","sourceUrl":null,"attachments":[],"status":"processing","createdBy":"hermes","receivedAt":"2026-06-30T04:30:16.856Z","updatedAt":"2026-06-30T04:30:16.890Z"},"sourceAgentRun":{"id":"cmr05ep1301fr0jpkuxoixuoy","inboxItemId":"cmr05ep0801fp0jpky9p5i3yo","model":"hermes/default","status":"running","classification":{"kind":"agent-run","task_id":"cmr009fvb01bx0jpk7yhseb6u"},"reasoningSummary":"根据 Personal OS P1 agent_allowed 任务，扩展 /api/agent/context evidence episode 序列化以支持来源回链。","outputSummary":null,"error":null,"startedAt":"2026-06-30T04:30:16.887Z","completedAt":null},"wikiLinks":[],"claims":[],"contributions":[],"artifacts":[],"reviews":[]}],"ideas":[],"notes":[],"projectEvents":[{"id":"cmr05ep1u01fw0jpkkc9sv3ix","projectId":"cmqq290nm00040jmj9jwa98ya","title":"完成 evidence episodes provenance 字段 v0 代码实现","body":"变更文件：src/lib/agent-context.ts, tests/services/agent-context.test.ts。产物：.agent-runs/cmr009fvb01bx0jpk7yhseb6u/worker-result.json, gate.json, diff.patch。验证：DATABASE_URL=<dummy> npm run prisma:generate 通过；npm test -- tests/services/agent-context.test.ts 11/11 通过；npm run lint 通过。部署：未部署。剩余风险：6.37 runtime 尚未替换。","eventType":"agent-run","createdAt":"2026-06-30T04:30:16.914Z","sourceInboxItemId":"cmr05ep0801fp0jpky9p5i3yo","sourceAgentRunId":"cmr05ep1301fr0jpkuxoixuoy"}],"wiki":[],"wiki_write_status":{"status":"skipped","requested":0,"succeeded":0,"failed":0,"errors":[]},"notification":null}
```