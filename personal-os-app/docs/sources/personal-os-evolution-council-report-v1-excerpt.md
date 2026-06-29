# Personal OS / Wiki 多模型优化会议报告 v1 — manifest source excerpt

Original source: `private-source/personal-os-evolution-council-report-v1.md`
Captured for portable repo/6.37 verification: 2026-06-23.

## 总结论

不迁移工具。吸收模式：manifest、context-pack、hybrid retrieval、memory promotion gate、freshness lint、self-improving skill patch flow。

P0 先做 4 件事：
1. 修 `/api/intake + wikiNotes`：Wiki 写失败不能拖垮 Inbox/Task/AgentRun。
2. 做 `wikiClient.read/write`：读 token 和写 token 分离，禁止业务代码直接 fetch Wiki。
3. 定义 Knowledge Object Manifest：所有知识对象必须有 id/type/source/hash/freshness/sensitivity。
4. 做 task/project 级 context-pack：Agent 不扫全库，只拿带来源、预算、freshness 的小上下文包。

## Codex P0 建议

- P0-1: 先定义 Knowledge Object Manifest，而不是先接工具。 — 所有 task/project/status/evidence/decision/SOP/project_hub 都必须有 id、type、source_path、owner、created_at、updated_at、freshness_ttl、confidence、sensitivity、supersedes、embedding_version、hash。
- P0-2: 建立 raw / curated 双层：/data/knowledge 是证据层，Personal Wiki 是编译层。 — Wiki/Hub 可以由 AI 生成，但必须引用 /data/knowledge 或人工事实源；生成内容不能反向覆盖证据层。
- P0-3: 默认检索走 hybrid RAG baseline，GraphRAG 只作为二阶段增强。 — 先实现 BM25 + embedding + metadata filter + rerank + citation；只有跨项目综合、主题发现、决策依赖图才使用 graph compiler。
- P0-4: 做 MCP context-pack，而不是让 agent 直接扫全库。 — 按 project_id/task_id 输出小包：current_state、decisions、evidence_digest、relevant_sops、open_questions、freshness_warnings、source_manifest。
- P0-5: 所有 memory 写入走 promotion gate。 — session observation 先进入 inbox；只有有来源、可复核、可删除、可过期的内容才能 promoted 到 semantic/procedural memory。
- P0-6: 把 self-improving skills 做成 PR/patch 流，而不是自动学习。 — agent 只能提出 SOP/skill diff proposal；必须带 evidence、失败案例、适用范围、验收项和回滚方式。
- P0-7: freshness lint 必须进最小验证链路。 — 至少检查 source missing、hash changed、ttl expired、decision superseded、owner missing、broken link、sensitivity violation。

## 综合路线图 excerpt

| 优先级 | 任务 | 产物 | 验收 |
|---|---|---|---|
| P0 | 修 intake/wikiNotes 降级链路 | 改代码 + 测试 | curl 带 wikiNotes 返回 201 或结构化 wiki_error |
| P0 | 统一 Wiki client 读写 token | wikiClient.read/write + grep 禁止直 fetch | 读写单测 + /api/agent/context 返回 wiki candidates |
| P0 | Knowledge Object Manifest | manifest schema + lint 规则 | 每个知识对象都有 source/hash/freshness/sensitivity |
| P1 | /data/knowledge manifest + search | manifest.jsonl + SQLite FTS5/ripgrep search endpoint | 已知关键词 P95 < 300ms，返回 source path |
