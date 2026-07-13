# writeback-response
Format: JSON
Top-level: object
Size: 11
Nested depth: 3

## Schema

- ok: boolean
- inbox: object (11 keys)
- agentRunId: string
- project: object (8 keys)
- tasks: array (0 items)
- ideas: array (0 items)
- notes: array (0 items)
- projectEvents: array (1 items)
- wiki: array (1 items)
- wiki_write_status: object (5 keys)
- notification: null

## Preview

```json
{"ok":true,"inbox":{"id":"cmqqptnec00190jocybfg0d9u","sourceType":"agent-cron","sourcePlatform":"hermes","sourceMessageId":"cron-cmqq2o6lz000w0jmj9mfh4cer-20260623T135135Z","rawText":"obsidianmanager1 自驱执行 Personal OS task cmqq2o6lz000w0jmj9mfh4cer，产出 _raw + manifest 增量入库试验 v0。","sourceUrl":null,"attachments":[],"status":"new","createdBy":"hermes","receivedAt":"2026-06-23T14:04:05.172Z","updatedAt":"2026-06-23T14:04:05.172Z"},"agentRunId":"cmqqptnfb001b0joc5764ve9m","project":{"id":"cmqq290nm00040jmj9jwa98ya","name":"Personal OS / Wiki 知识库升级","goal":"让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。","status":"active","priority":"P0","currentFocus":"Personal OS / Wiki 自驱闭环生产化","createdAt":"2026-06-23T03:04:11.410Z","updatedAt":"2026-06-23T13:23:07.623Z"},"tasks":[],"ideas":[],"notes":[],"projectEvents":[{"id":"cmqqptnfo001d0jocf64hzsgm","projectId":"cmqq290nm00040jmj9jwa98ya","title":"完成 _raw + manifest 增量入库试验 v0","body":"产出 raw-source-manifest JSON Schema、ingest/skip/update 三路径样例、simulate-raw-manifest-ingest.mjs 和验证日志。artifact_dir: .agent-runs/cmqq2o6lz000w0jmj9mfh4cer；gate_status: pass。","eventType":"agent-output","createdAt":"2026-06-23T14:04:05.220Z","sourceInboxItemId":"cmqqptnec00190jocybfg0d9u","sourceAgentRunId":"cmqqptnfb001b0joc5764ve9m"}],"wiki":[{"ok":true,"title":"_raw + manifest 增量入库试验 v0 — 2026-06-23","status":"created","url":"http://192.168.6.37:3100/api/wiki/open?next=%2Fhttp%3A%2F%2F192.168.6.37%3A3422%2Fnote%3Fpath%3D30_projects%252FPersonal-OS-Wiki-%25E7%259F%25A5%25E8%25AF%2586%25E5%25BA%2593%25E5%258D%2587%25E7%25BA%25A7%252F_raw-manifest-%25E5%25A2%259E%25E9%2587%258F%25E5%2585%25A5%25E5%25BA%2593%25E8%25AF%2595%25E9%25AA%258C-v0-2026-06-23.md"}],"wiki_write_status":{"status":"ok","requested":1,"succeeded":1,"failed":0,"errors":[]},"notification":null}
```