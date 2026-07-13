commit 47e3637dfb306e33c55cff580bb521e4fb28f947
Author: Hermes Agent <agent@hermes.local>
Date:   Wed Jun 24 07:31:05 2026 +0800

    feat(manifest,context-pack,raw-ingest): commit pending tests, scripts, schemas and docs
    
    - tests/services/knowledge-manifest.test.ts + schemas + examples + lint script
    - tests/services/agent-run-context-pack.test.ts for archive script
    - tests/services/raw-manifest-ingest.test.ts + scripts/raw-manifest-ingest.mjs
    - docs/CLASSIC_KNOWLEDGE_OBJECT_MANIFEST.md
    
    All 78 tests pass. tsc clean. lint clean.
    Relates to tasks:
    - cmqq4eqmy00380jmjf78xn01y (knowledge manifest MVP)
    - cmqq4eqex00360jmjgnurl9li (context-pack API v0)
    - cmqq2o6nj000y0jmj0hqetodk (28T knowledge asset catalog)

 .../docs/CLASSIC_KNOWLEDGE_OBJECT_MANIFEST.md      |  79 +++++
 ...sonal-os-evolution-council-report-v1-excerpt.md |  33 ++
 .../decision.classic-knowledge-object.json         |  62 ++++
 .../sop.classic-knowledge-object.json              |  62 ++++
 .../task.classic-knowledge-object.json             |  62 ++++
 .../classic-knowledge-object-manifest.schema.json  | 373 +++++++++++++++++++++
 .../lint-classic-knowledge-object-manifest.mjs     | 299 +++++++++++++++++
 personal-os-app/scripts/raw-manifest-ingest.mjs    | 258 ++++++++++++++
 .../.raw-manifest-registry.json                    |  10 +
 .../fixtures/raw-manifest-ingest/ingest-source.md  |   3 +
 .../tests/fixtures/raw-manifest-ingest/ingest.json |  66 ++++
 .../fixtures/raw-manifest-ingest/skip-source.md    |   3 +
 .../tests/fixtures/raw-manifest-ingest/skip.json   |  66 ++++
 .../fixtures/raw-manifest-ingest/update-source.md  |   3 +
 .../tests/fixtures/raw-manifest-ingest/update.json |  66 ++++
 .../tests/services/agent-run-context-pack.test.ts  | 113 +++++++
 .../tests/services/knowledge-manifest.test.ts      | 128 +++++++
 .../tests/services/raw-manifest-ingest.test.ts     |  96 ++++++
 18 files changed, 1782 insertions(+)
diff --git a/personal-os-app/docs/CLASSIC_KNOWLEDGE_OBJECT_MANIFEST.md b/personal-os-app/docs/CLASSIC_KNOWLEDGE_OBJECT_MANIFEST.md
new file mode 100644
index 0000000..017f90c
--- /dev/null
+++ b/personal-os-app/docs/CLASSIC_KNOWLEDGE_OBJECT_MANIFEST.md
@@ -0,0 +1,79 @@
+# Classic Knowledge Object Manifest v0
+
+This manifest is the first guardrail for turning Classic's Personal OS / Wiki records into reusable knowledge objects without losing evidence.
+
+Source: `docs/sources/personal-os-evolution-council-report-v1-excerpt.md`, excerpted from `/Users/xingqiwu/.agent-runs/personal-os-evolution-council-20260623/council-report-v1.md` lines 6-14, 31-38 and 121-126.
+
+## Scope
+
+Use this schema for:
+
+- `task`
+- `project`
+- `evidence`
+- `decision`
+- `sop`
+- `project_hub`
+- `status`
+- `context_pack`
+- `agent_run`
+- `idea`
+- `note`
+
+## Required traceability
+
+Every object must carry:
+
+- `id`: stable typed id, for example `task:<personal-os-task-id>`.
+- `type`: one of the supported knowledge object types.
+- `source_path`: canonical local source path, or `null` only for speculative drafts.
+- `hash`: `sha256` or `sha1` content hash of `source_path`; must be `null` for speculative objects without a source.
+- `freshness`: captured time, TTL, `valid_until`, and last check state.
+- `sensitivity`: public/internal/private/secret boundary plus allowed uses.
+- `owner`: Classic / agent / system / external owner.
+- `confidence`: `verified`, `inferred`, or `speculative`.
+- `relationships`: project/task/run links plus supersession links.
+
+Objects without a source are not facts. They must set:
+
+```json
+{
+  "source_path": null,
+  "hash": null,
+  "confidence": "speculative"
+}
+```
+
+## Files
+
+- Schema: `schemas/classic-knowledge-object-manifest.schema.json`
+- Examples:
+  - `examples/knowledge-objects/task.classic-knowledge-object.json`
+  - `examples/knowledge-objects/decision.classic-knowledge-object.json`
+  - `examples/knowledge-objects/sop.classic-knowledge-object.json`
+- Lint script: `scripts/lint-classic-knowledge-object-manifest.mjs`
+- Portable source excerpt: `docs/sources/personal-os-evolution-council-report-v1-excerpt.md`
+
+## Lint checks
+
+The lint script implements the minimum checks from the council report:
+
+1. `required-field-missing`: object lacks required manifest fields.
+2. `source-missing`: `source_path` does not exist.
+3. `hash-changed`: current source file hash differs from manifest hash.
+4. `ttl-expired`: `freshness.valid_until` is past due.
+5. `owner-missing`: `owner.type` or `owner.id` is absent.
+6. `decision-superseded`: a decision has `superseded_by` but is not marked `lifecycle.status=superseded`.
+7. `sensitivity-violation`: secret-bearing objects are not marked `secret`, or secret objects are allowed into unsafe uses.
+8. `no-source-must-be-speculative`: no-source objects are not explicitly speculative.
+
+## Local verification
+
+From `personal-os-app`:
+
+```bash
+node scripts/lint-classic-knowledge-object-manifest.mjs examples/knowledge-objects/*.json
+npm test -- tests/services/knowledge-manifest.test.ts
+```
+
+This is a schema/manifest guardrail. It does not write the production database. The source excerpt is checked into the repo so the shipped examples can be linted both locally and on 6.37.
diff --git a/personal-os-app/docs/sources/personal-os-evolution-council-report-v1-excerpt.md b/personal-os-app/docs/sources/personal-os-evolution-council-report-v1-excerpt.md
new file mode 100644
index 0000000..a9cd847
--- /dev/null
+++ b/personal-os-app/docs/sources/personal-os-evolution-council-report-v1-excerpt.md
@@ -0,0 +1,33 @@
+# Personal OS / Wiki 多模型优化会议报告 v1 — manifest source excerpt
+
+Original source: `/Users/xingqiwu/.agent-runs/personal-os-evolution-council-20260623/council-report-v1.md`
+Captured for portable repo/6.37 verification: 2026-06-23.
+
+## 总结论
+
+不迁移工具。吸收模式：manifest、context-pack、hybrid retrieval、memory promotion gate、freshness lint、self-improving skill patch flow。
+
+P0 先做 4 件事：
+1. 修 `/api/intake + wikiNotes`：Wiki 写失败不能拖垮 Inbox/Task/AgentRun。
+2. 做 `wikiClient.read/write`：读 token 和写 token 分离，禁止业务代码直接 fetch Wiki。
+3. 定义 Classic Knowledge Object Manifest：所有知识对象必须有 id/type/source/hash/freshness/sensitivity。
+4. 做 task/project 级 context-pack：Agent 不扫全库，只拿带来源、预算、freshness 的小上下文包。
+
+## Codex P0 建议
+
+- P0-1: 先定义 Classic Knowledge Object Manifest，而不是先接工具。 — 所有 task/project/status/evidence/decision/SOP/project_hub 都必须有 id、type、source_path、owner、created_at、updated_at、freshness_ttl、confidence、sensitivity、supersedes、embedding_version、hash。
+- P0-2: 建立 raw / curated 双层：/data/knowledge 是证据层，Personal Wiki 是编译层。 — Wiki/Hub 可以由 AI 生成，但必须引用 /data/knowledge 或人工事实源；生成内容不能反向覆盖证据层。
+- P0-3: 默认检索走 hybrid RAG baseline，GraphRAG 只作为二阶段增强。 — 先实现 BM25 + embedding + metadata filter + rerank + citation；只有跨项目综合、主题发现、决策依赖图才使用 graph compiler。
+- P0-4: 做 MCP context-pack，而不是让 agent 直接扫全库。 — 按 project_id/task_id 输出小包：current_state、decisions、evidence_digest、relevant_sops、open_questions、freshness_warnings、source_manifest。
+- P0-5: 所有 memory 写入走 promotion gate。 — session observation 先进入 inbox；只有有来源、可复核、可删除、可过期的内容才能 promoted 到 semantic/procedural memory。
+- P0-6: 把 self-improving skills 做成 PR/patch 流，而不是自动学习。 — agent 只能提出 SOP/skill diff proposal；必须带 evidence、失败案例、适用范围、验收项和回滚方式。
+- P0-7: freshness lint 必须进最小验证链路。 — 至少检查 source missing、hash changed、ttl expired、decision superseded、owner missing、broken link、sensitivity violation。
+
+## 综合路线图 excerpt
+
+| 优先级 | 任务 | 产物 | 验收 |
+|---|---|---|---|
+| P0 | 修 intake/wikiNotes 降级链路 | 改代码 + 测试 | curl 带 wikiNotes 返回 201 或结构化 wiki_error |
+| P0 | 统一 Wiki client 读写 token | wikiClient.read/write + grep 禁止直 fetch | 读写单测 + /api/agent/context 返回 wiki candidates |
+| P0 | Classic Knowledge Object Manifest | manifest schema + lint 规则 | 每个知识对象都有 source/hash/freshness/sensitivity |
+| P1 | /data/knowledge manifest + search | manifest.jsonl + SQLite FTS5/ripgrep search endpoint | 已知关键词 P95 < 300ms，返回 source path |
diff --git a/personal-os-app/examples/knowledge-objects/decision.classic-knowledge-object.json b/personal-os-app/examples/knowledge-objects/decision.classic-knowledge-object.json
new file mode 100644
index 0000000..b9e10c2
--- /dev/null
+++ b/personal-os-app/examples/knowledge-objects/decision.classic-knowledge-object.json
@@ -0,0 +1,62 @@
+{
+  "schema_version": "classic-knowledge-object-manifest/v0",
+  "id": "decision:personal-os-wiki-no-tool-migration-20260623",
+  "type": "decision",
+  "title": "Personal OS / Wiki 不迁移工具，只吸收可复用模式",
+  "summary": "多模型会议决定不迁移到 OpenDeepWiki、Basic Memory、Mem0 或 GraphRAG 全量方案；优先吸收 manifest、context-pack、hybrid retrieval、memory promotion gate、freshness lint、self-improving skill patch flow。",
+  "source_path": "docs/sources/personal-os-evolution-council-report-v1-excerpt.md",
+  "source_url": null,
+  "source_type": "agent-output",
+  "hash": {
+    "algorithm": "sha256",
+    "value": "f36131f5b3214688b6756603d5190b3d64cbb6e76b9a6615a7b9f921816dc6c3"
+  },
+  "freshness": {
+    "status": "fresh",
+    "captured_at": "2026-06-23T12:03:08+08:00",
+    "valid_until": "2026-09-21T00:00:00+08:00",
+    "ttl_days": 90,
+    "last_checked_at": "2026-06-23T16:40:00+08:00",
+    "stale_reason": null
+  },
+  "sensitivity": {
+    "level": "private",
+    "contains_secrets": false,
+    "allowed_uses": ["agent_context", "wiki_index", "task_execution"],
+    "handling_notes": "Internal project decision; cite source before using in public docs."
+  },
+  "owner": {
+    "type": "classic",
+    "id": "classic"
+  },
+  "created_at": "2026-06-23T12:03:08+08:00",
+  "updated_at": "2026-06-23T16:40:00+08:00",
+  "confidence": "verified",
+  "lifecycle": {
+    "status": "active",
+    "review_policy": "classic_review_required",
+    "reviewed_at": null,
+    "reviewed_by": null
+  },
+  "relationships": {
+    "project_ids": ["cmqq290nm00040jmj9jwa98ya"],
+    "task_ids": ["cmqq4eqa800340jmjz1go2euo"],
+    "source_run_ids": ["personal-os-evolution-council-20260623"],
+    "supersedes": [],
+    "superseded_by": [],
+    "related_ids": ["task:cmqq4eqa800340jmjz1go2euo", "sop:wiki-raw-curated-boundary-20260623"]
+  },
+  "embedding": {
+    "version": "not-indexed-v0",
+    "content_hash": null,
+    "indexed_at": null
+  },
+  "content": {
+    "format": "markdown",
+    "uri": "personal-wiki://30_projects/Personal-OS-Wiki-知识库升级/agent-council-decisions",
+    "excerpt": "不迁移工具。吸收模式：manifest、context-pack、hybrid retrieval、memory promotion gate、freshness lint、self-improving skill patch flow。"
+  },
+  "lint": {
+    "waivers": []
+  }
+}
diff --git a/personal-os-app/examples/knowledge-objects/sop.classic-knowledge-object.json b/personal-os-app/examples/knowledge-objects/sop.classic-knowledge-object.json
new file mode 100644
index 0000000..43aee97
--- /dev/null
+++ b/personal-os-app/examples/knowledge-objects/sop.classic-knowledge-object.json
@@ -0,0 +1,62 @@
+{
+  "schema_version": "classic-knowledge-object-manifest/v0",
+  "id": "sop:wiki-raw-curated-boundary-20260623",
+  "type": "sop",
+  "title": "Raw / curated 双层知识边界",
+  "summary": "将 /data/knowledge 作为证据层，Personal Wiki 作为编译层；Wiki 或 Hub 可由 Agent 生成，但必须引用 /data/knowledge 或人工事实源，生成内容不能反向覆盖证据层。",
+  "source_path": "docs/sources/personal-os-evolution-council-report-v1-excerpt.md",
+  "source_url": null,
+  "source_type": "agent-output",
+  "hash": {
+    "algorithm": "sha256",
+    "value": "f36131f5b3214688b6756603d5190b3d64cbb6e76b9a6615a7b9f921816dc6c3"
+  },
+  "freshness": {
+    "status": "fresh",
+    "captured_at": "2026-06-23T12:03:08+08:00",
+    "valid_until": "2026-09-21T00:00:00+08:00",
+    "ttl_days": 90,
+    "last_checked_at": "2026-06-23T16:40:00+08:00",
+    "stale_reason": null
+  },
+  "sensitivity": {
+    "level": "private",
+    "contains_secrets": false,
+    "allowed_uses": ["agent_context", "wiki_index", "task_execution"],
+    "handling_notes": "Local operational SOP; do not treat generated Wiki pages as primary evidence."
+  },
+  "owner": {
+    "type": "agent",
+    "id": "hermes"
+  },
+  "created_at": "2026-06-23T12:03:08+08:00",
+  "updated_at": "2026-06-23T16:40:00+08:00",
+  "confidence": "verified",
+  "lifecycle": {
+    "status": "active",
+    "review_policy": "classic_review_required",
+    "reviewed_at": null,
+    "reviewed_by": null
+  },
+  "relationships": {
+    "project_ids": ["cmqq290nm00040jmj9jwa98ya"],
+    "task_ids": ["cmqq4eqa800340jmjz1go2euo"],
+    "source_run_ids": ["personal-os-evolution-council-20260623"],
+    "supersedes": [],
+    "superseded_by": [],
+    "related_ids": ["task:cmqq4eqa800340jmjz1go2euo", "decision:personal-os-wiki-no-tool-migration-20260623"]
+  },
+  "embedding": {
+    "version": "not-indexed-v0",
+    "content_hash": null,
+    "indexed_at": null
+  },
+  "content": {
+    "format": "markdown",
+    "uri": "personal-wiki://sop/raw-curated-knowledge-boundary",
+    "excerpt": "建立 raw / curated 双层：/data/knowledge 是证据层，Personal Wiki 是编译层。"
+  },
+  "lint": {
+    "waivers": []
+  }
+}
diff --git a/personal-os-app/examples/knowledge-objects/task.classic-knowledge-object.json b/personal-os-app/examples/knowledge-objects/task.classic-knowledge-object.json
new file mode 100644
index 0000000..fd3bbf7
--- /dev/null
+++ b/personal-os-app/examples/knowledge-objects/task.classic-knowledge-object.json
@@ -0,0 +1,62 @@
+{
+  "schema_version": "classic-knowledge-object-manifest/v0",
+  "id": "task:cmqq4eqa800340jmjz1go2euo",
+  "type": "task",
+  "title": "定义 Classic Knowledge Object Manifest v0",
+  "summary": "为 Personal OS / Wiki 知识对象定义可追溯的 manifest schema，要求任务、项目、证据、决策、SOP、Hub 都具备 source_path、hash、freshness、sensitivity 等字段。",
+  "source_path": "docs/sources/personal-os-evolution-council-report-v1-excerpt.md",
+  "source_url": null,
+  "source_type": "agent-output",
+  "hash": {
+    "algorithm": "sha256",
+    "value": "f36131f5b3214688b6756603d5190b3d64cbb6e76b9a6615a7b9f921816dc6c3"
+  },
+  "freshness": {
+    "status": "fresh",
+    "captured_at": "2026-06-23T12:03:08+08:00",
+    "valid_until": "2026-09-21T00:00:00+08:00",
+    "ttl_days": 90,
+    "last_checked_at": "2026-06-23T16:40:00+08:00",
+    "stale_reason": null
+  },
+  "sensitivity": {
+    "level": "private",
+    "contains_secrets": false,
+    "allowed_uses": ["agent_context", "wiki_index", "task_execution"],
+    "handling_notes": "Local Classic project metadata; do not publish without review."
+  },
+  "owner": {
+    "type": "agent",
+    "id": "hermes"
+  },
+  "created_at": "2026-06-23T12:03:08+08:00",
+  "updated_at": "2026-06-23T16:40:00+08:00",
+  "confidence": "verified",
+  "lifecycle": {
+    "status": "active",
+    "review_policy": "classic_review_required",
+    "reviewed_at": null,
+    "reviewed_by": null
+  },
+  "relationships": {
+    "project_ids": ["cmqq290nm00040jmj9jwa98ya"],
+    "task_ids": ["cmqq4eqa800340jmjz1go2euo"],
+    "source_run_ids": ["personal-os-evolution-council-20260623"],
+    "supersedes": [],
+    "superseded_by": [],
+    "related_ids": ["decision:personal-os-wiki-no-tool-migration-20260623", "sop:wiki-raw-curated-boundary-20260623"]
+  },
+  "embedding": {
+    "version": "not-indexed-v0",
+    "content_hash": null,
+    "indexed_at": null
+  },
+  "content": {
+    "format": "markdown",
+    "uri": "personal-os://tasks/cmqq4eqa800340jmjz1go2euo",
+    "excerpt": "Classic Knowledge Object Manifest：所有知识对象必须有 id/type/source/hash/freshness/sensitivity。"
+  },
+  "lint": {
+    "waivers": []
+  }
+}
diff --git a/personal-os-app/schemas/classic-knowledge-object-manifest.schema.json b/personal-os-app/schemas/classic-knowledge-object-manifest.schema.json
new file mode 100644
index 0000000..edfdd57
--- /dev/null
+++ b/personal-os-app/schemas/classic-knowledge-object-manifest.schema.json
@@ -0,0 +1,373 @@
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://classic.local/schemas/classic-knowledge-object-manifest.schema.json",
+  "title": "Classic Knowledge Object Manifest v0",
+  "description": "A provenance-first manifest for Classic knowledge objects. Every task, project, evidence, decision, SOP, status record, context pack, and project hub must carry source_path, hash, freshness, and sensitivity metadata; objects without a source must be explicitly marked speculative.",
+  "type": "object",
+  "additionalProperties": false,
+  "required": [
+    "schema_version",
+    "id",
+    "type",
+    "title",
+    "summary",
+    "source_path",
+    "source_url",
+    "source_type",
+    "hash",
+    "freshness",
+    "sensitivity",
+    "owner",
+    "created_at",
+    "updated_at",
+    "confidence",
+    "lifecycle",
+    "relationships"
+  ],
+  "properties": {
+    "schema_version": {
+      "const": "classic-knowledge-object-manifest/v0"
+    },
+    "id": {
+      "type": "string",
+      "minLength": 3,
+      "pattern": "^(task|project|evidence|decision|sop|project_hub|status|context_pack|agent_run|idea|note):[A-Za-z0-9._:/#-]+$",
+      "description": "Stable object id prefixed by object type, for example task:<personal-os-task-id>."
+    },
+    "type": {
+      "type": "string",
+      "enum": [
+        "task",
+        "project",
+        "evidence",
+        "decision",
+        "sop",
+        "project_hub",
+        "status",
+        "context_pack",
+        "agent_run",
+        "idea",
+        "note"
+      ]
+    },
+    "title": {
+      "type": "string",
+      "minLength": 1,
+      "maxLength": 200
+    },
+    "summary": {
+      "type": "string",
+      "minLength": 1,
+      "maxLength": 2000
+    },
+    "source_path": {
+      "type": ["string", "null"],
+      "minLength": 1,
+      "description": "Canonical local source path. Relative paths are resolved from the lint command working directory. Null is allowed only for speculative objects."
+    },
+    "source_url": {
+      "type": ["string", "null"],
+      "format": "uri",
+      "description": "Optional external or app URL for the source."
+    },
+    "source_type": {
+      "type": "string",
+      "enum": [
+        "agent-output",
+        "human-input",
+        "wiki-note",
+        "repo-file",
+        "system-log",
+        "api-response",
+        "web",
+        "unknown"
+      ]
+    },
+    "hash": {
+      "description": "Content hash of source_path. Null is allowed only when source_path is null and confidence is speculative.",
+      "oneOf": [
+        {
+          "type": "object",
+          "additionalProperties": false,
+          "required": ["algorithm", "value"],
+          "properties": {
+            "algorithm": {
+              "type": "string",
+              "enum": ["sha256", "sha1"]
+            },
+            "value": {
+              "type": "string",
+              "pattern": "^[a-f0-9]{40}$|^[a-f0-9]{64}$"
+            }
+          }
+        },
+        {
+          "type": "null"
+        }
+      ]
+    },
+    "freshness": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["status", "captured_at", "valid_until", "ttl_days", "last_checked_at"],
+      "properties": {
+        "status": {
+          "type": "string",
+          "enum": ["fresh", "stale", "unknown"]
+        },
+        "captured_at": {
+          "type": "string",
+          "format": "date-time"
+        },
+        "valid_until": {
+          "type": ["string", "null"],
+          "format": "date-time"
+        },
+        "ttl_days": {
+          "type": ["integer", "null"],
+          "minimum": 1,
+          "maximum": 3650
+        },
+        "last_checked_at": {
+          "type": ["string", "null"],
+          "format": "date-time"
+        },
+        "stale_reason": {
+          "type": ["string", "null"],
+          "maxLength": 500
+        }
+      }
+    },
+    "sensitivity": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["level", "contains_secrets", "allowed_uses", "handling_notes"],
+      "properties": {
+        "level": {
+          "type": "string",
+          "enum": ["public", "internal", "private", "secret"]
+        },
+        "contains_secrets": {
+          "type": "boolean"
+        },
+        "allowed_uses": {
+          "type": "array",
+          "items": {
+            "type": "string",
+            "enum": [
+              "agent_context",
+              "wiki_index",
+              "task_execution",
+              "public_docs",
+              "local_only"
+            ]
+          },
+          "minItems": 1,
+          "uniqueItems": true
+        },
+        "handling_notes": {
+          "type": "string",
+          "maxLength": 1000
+        }
+      }
+    },
+    "owner": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["type", "id"],
+      "properties": {
+        "type": {
+          "type": "string",
+          "enum": ["classic", "agent", "system", "external"]
+        },
+        "id": {
+          "type": "string",
+          "minLength": 1
+        }
+      }
+    },
+    "created_at": {
+      "type": "string",
+      "format": "date-time"
+    },
+    "updated_at": {
+      "type": "string",
+      "format": "date-time"
+    },
+    "confidence": {
+      "type": "string",
+      "enum": ["verified", "inferred", "speculative"]
+    },
+    "lifecycle": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["status", "review_policy"],
+      "properties": {
+        "status": {
+          "type": "string",
+          "enum": ["draft", "active", "superseded", "archived", "rejected"]
+        },
+        "review_policy": {
+          "type": "string",
+          "enum": ["classic_review_required", "agent_review_allowed", "auto_generated_draft"]
+        },
+        "reviewed_at": {
+          "type": ["string", "null"],
+          "format": "date-time"
+        },
+        "reviewed_by": {
+          "type": ["string", "null"]
+        }
+      }
+    },
+    "relationships": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["project_ids", "task_ids", "source_run_ids", "supersedes", "superseded_by", "related_ids"],
+      "properties": {
+        "project_ids": {
+          "type": "array",
+          "items": { "type": "string", "minLength": 1 },
+          "uniqueItems": true
+        },
+        "task_ids": {
+          "type": "array",
+          "items": { "type": "string", "minLength": 1 },
+          "uniqueItems": true
+        },
+        "source_run_ids": {
+          "type": "array",
+          "items": { "type": "string", "minLength": 1 },
+          "uniqueItems": true
+        },
+        "supersedes": {
+          "type": "array",
+          "items": { "type": "string", "minLength": 1 },
+          "uniqueItems": true
+        },
+        "superseded_by": {
+          "type": "array",
+          "items": { "type": "string", "minLength": 1 },
+          "uniqueItems": true
+        },
+        "related_ids": {
+          "type": "array",
+          "items": { "type": "string", "minLength": 1 },
+          "uniqueItems": true
+        }
+      }
+    },
+    "embedding": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["version", "content_hash", "indexed_at"],
+      "properties": {
+        "version": {
+          "type": "string",
+          "minLength": 1
+        },
+        "content_hash": {
+          "type": ["string", "null"],
+          "pattern": "^[a-f0-9]{64}$"
+        },
+        "indexed_at": {
+          "type": ["string", "null"],
+          "format": "date-time"
+        }
+      }
+    },
+    "content": {
+      "type": "object",
+      "additionalProperties": false,
+      "required": ["format", "uri", "excerpt"],
+      "properties": {
+        "format": {
+          "type": "string",
+          "enum": ["markdown", "json", "plain_text", "external"]
+        },
+        "uri": {
+          "type": "string",
+          "minLength": 1
+        },
+        "excerpt": {
+          "type": "string",
+          "minLength": 1,
+          "maxLength": 2000
+        }
+      }
+    },
+    "lint": {
+      "type": "object",
+      "additionalProperties": false,
+      "properties": {
+        "waivers": {
+          "type": "array",
+          "items": {
+            "type": "object",
+            "additionalProperties": false,
+            "required": ["code", "reason", "expires_at"],
+            "properties": {
+              "code": { "type": "string", "minLength": 1 },
+              "reason": { "type": "string", "minLength": 1 },
+              "expires_at": { "type": ["string", "null"], "format": "date-time" }
+            }
+          }
+        }
+      }
+    }
+  },
+  "allOf": [
+    {
+      "if": {
+        "properties": {
+          "source_path": { "type": "null" }
+        },
+        "required": ["source_path"]
+      },
+      "then": {
+        "properties": {
+          "confidence": { "const": "speculative" },
+          "hash": { "type": "null" }
+        },
+        "required": ["confidence", "hash"]
+      }
+    },
+    {
+      "if": {
+        "properties": {
+          "source_path": { "type": "string" }
+        },
+        "required": ["source_path"]
+      },
+      "then": {
+        "properties": {
+          "hash": { "type": "object" }
+        }
+      }
+    },
+    {
+      "if": {
+        "properties": {
+          "sensitivity": {
+            "type": "object",
+            "properties": {
+              "contains_secrets": { "const": true }
+            },
+            "required": ["contains_secrets"]
+          }
+        },
+        "required": ["sensitivity"]
+      },
+      "then": {
+        "properties": {
+          "sensitivity": {
+            "type": "object",
+            "properties": {
+              "level": { "const": "secret" }
+            }
+          }
+        }
+      }
+    }
+  ]
+}
diff --git a/personal-os-app/scripts/lint-classic-knowledge-object-manifest.mjs b/personal-os-app/scripts/lint-classic-knowledge-object-manifest.mjs
new file mode 100644
index 0000000..641c512
--- /dev/null
+++ b/personal-os-app/scripts/lint-classic-knowledge-object-manifest.mjs
@@ -0,0 +1,299 @@
+#!/usr/bin/env node
+import crypto from "node:crypto";
+import fs from "node:fs";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+
+const REQUIRED_TOP_LEVEL_FIELDS = [
+  "schema_version",
+  "id",
+  "type",
+  "title",
+  "summary",
+  "source_path",
+  "source_url",
+  "source_type",
+  "hash",
+  "freshness",
+  "sensitivity",
+  "owner",
+  "created_at",
+  "updated_at",
+  "confidence",
+  "lifecycle",
+  "relationships",
+];
+
+const VALID_TYPES = new Set([
+  "task",
+  "project",
+  "evidence",
+  "decision",
+  "sop",
+  "project_hub",
+  "status",
+  "context_pack",
+  "agent_run",
+  "idea",
+  "note",
+]);
+
+const VALID_CONFIDENCE = new Set(["verified", "inferred", "speculative"]);
+const VALID_SENSITIVITY = new Set(["public", "internal", "private", "secret"]);
+const SECRET_SAFE_USES = new Set(["local_only", "task_execution"]);
+
+function isPlainObject(value) {
+  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
+}
+
+function isNonEmptyString(value) {
+  return typeof value === "string" && value.trim().length > 0;
+}
+
+function parseDate(value) {
+  if (!isNonEmptyString(value)) {
+    return null;
+  }
+  const date = new Date(value);
+  return Number.isNaN(date.getTime()) ? null : date;
+}
+
+function addFinding(findings, severity, code, message) {
+  findings.push({ severity, code, message });
+}
+
+function resolveSourcePath(sourcePath, baseDir) {
+  if (!isNonEmptyString(sourcePath)) {
+    return null;
+  }
+  return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(baseDir, sourcePath);
+}
+
+function hashFile(filePath, algorithm) {
+  const hash = crypto.createHash(algorithm);
+  hash.update(fs.readFileSync(filePath));
+  return hash.digest("hex");
+}
+
+function waivedCodes(object) {
+  const waivers = object?.lint?.waivers;
+  if (!Array.isArray(waivers)) {
+    return new Set();
+  }
+  const now = new Date();
+  return new Set(
+    waivers
+      .filter((waiver) => {
+        if (!isPlainObject(waiver) || !isNonEmptyString(waiver.code)) {
+          return false;
+        }
+        const expiresAt = waiver.expires_at ? parseDate(waiver.expires_at) : null;
+        return !expiresAt || expiresAt >= now;
+      })
+      .map((waiver) => waiver.code),
+  );
+}
+
+export function lintObject(object, options = {}) {
+  const baseDir = options.baseDir ?? process.cwd();
+  const now = options.now ?? new Date();
+  const findings = [];
+
+  if (!isPlainObject(object)) {
+    addFinding(findings, "error", "object-invalid", "Manifest must be a JSON object.");
+    return findings;
+  }
+
+  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
+    if (!(field in object)) {
+      addFinding(findings, "error", "required-field-missing", `Missing required field: ${field}.`);
+    }
+  }
+
+  if (object.schema_version !== "classic-knowledge-object-manifest/v0") {
+    addFinding(findings, "error", "schema-version-invalid", "schema_version must be classic-knowledge-object-manifest/v0.");
+  }
+
+  if (!isNonEmptyString(object.id) || !/^(task|project|evidence|decision|sop|project_hub|status|context_pack|agent_run|idea|note):[A-Za-z0-9._:/#-]+$/.test(object.id)) {
+    addFinding(findings, "error", "id-invalid", "id must be a stable prefixed id such as task:<id> or decision:<slug>.");
+  }
+
+  if (!VALID_TYPES.has(object.type)) {
+    addFinding(findings, "error", "type-invalid", `type must be one of: ${Array.from(VALID_TYPES).join(", ")}.`);
+  }
+
+  if (!isNonEmptyString(object.title)) {
+    addFinding(findings, "error", "title-missing", "title must be a non-empty string.");
+  }
+
+  if (!isNonEmptyString(object.summary)) {
+    addFinding(findings, "error", "summary-missing", "summary must be a non-empty string.");
+  }
+
+  const hasSource = isNonEmptyString(object.source_path);
+  if (!hasSource) {
+    if (object.confidence !== "speculative" || object.hash !== null) {
+      addFinding(findings, "error", "no-source-must-be-speculative", "Objects without source_path must set confidence=speculative and hash=null.");
+    }
+  } else {
+    const sourcePath = resolveSourcePath(object.source_path, baseDir);
+    if (!sourcePath || !fs.existsSync(sourcePath)) {
+      addFinding(findings, "error", "source-missing", `source_path does not exist: ${object.source_path}.`);
+    } else if (!isPlainObject(object.hash)) {
+      addFinding(findings, "error", "hash-missing", "Objects with source_path must include a hash object.");
+    } else {
+      const algorithm = object.hash.algorithm;
+      if (algorithm !== "sha256" && algorithm !== "sha1") {
+        addFinding(findings, "error", "hash-algorithm-invalid", "hash.algorithm must be sha256 or sha1.");
+      } else if (!isNonEmptyString(object.hash.value)) {
+        addFinding(findings, "error", "hash-value-missing", "hash.value must be present.");
+      } else {
+        const actualHash = hashFile(sourcePath, algorithm);
+        if (actualHash !== object.hash.value) {
+          addFinding(findings, "error", "hash-changed", `hash.value no longer matches source_path; expected ${actualHash}.`);
+        }
+      }
+    }
+  }
+
+  if (!VALID_CONFIDENCE.has(object.confidence)) {
+    addFinding(findings, "error", "confidence-invalid", "confidence must be verified, inferred, or speculative.");
+  }
+
+  const createdAt = parseDate(object.created_at);
+  const updatedAt = parseDate(object.updated_at);
+  if (!createdAt) {
+    addFinding(findings, "error", "created-at-invalid", "created_at must be an ISO date-time string.");
+  }
+  if (!updatedAt) {
+    addFinding(findings, "error", "updated-at-invalid", "updated_at must be an ISO date-time string.");
+  }
+  if (createdAt && updatedAt && updatedAt < createdAt) {
+    addFinding(findings, "error", "updated-before-created", "updated_at must not be earlier than created_at.");
+  }
+
+  if (!isPlainObject(object.owner) || !isNonEmptyString(object.owner.type) || !isNonEmptyString(object.owner.id)) {
+    addFinding(findings, "error", "owner-missing", "owner.type and owner.id are required.");
+  }
+
+  if (!isPlainObject(object.freshness)) {
+    addFinding(findings, "error", "freshness-missing", "freshness object is required.");
+  } else {
+    const capturedAt = parseDate(object.freshness.captured_at);
+    const validUntil = object.freshness.valid_until === null ? null : parseDate(object.freshness.valid_until);
+    const lastCheckedAt = object.freshness.last_checked_at === null ? null : parseDate(object.freshness.last_checked_at);
+    if (!capturedAt) {
+      addFinding(findings, "error", "freshness-captured-at-invalid", "freshness.captured_at must be an ISO date-time string.");
+    }
+    if (object.freshness.valid_until !== null && !validUntil) {
+      addFinding(findings, "error", "freshness-valid-until-invalid", "freshness.valid_until must be null or an ISO date-time string.");
+    }
+    if (object.freshness.last_checked_at !== null && !lastCheckedAt) {
+      addFinding(findings, "error", "freshness-last-checked-at-invalid", "freshness.last_checked_at must be null or an ISO date-time string.");
+    }
+    if (validUntil && validUntil < now) {
+      addFinding(findings, "warning", "ttl-expired", "freshness.valid_until is older than the lint run time.");
+    }
+    if (object.freshness.status === "fresh" && validUntil && validUntil < now) {
+      addFinding(findings, "error", "freshness-status-inconsistent", "freshness.status cannot be fresh after valid_until has passed.");
+    }
+  }
+
+  if (!isPlainObject(object.sensitivity)) {
+    addFinding(findings, "error", "sensitivity-missing", "sensitivity object is required.");
+  } else {
+    if (!VALID_SENSITIVITY.has(object.sensitivity.level)) {
+      addFinding(findings, "error", "sensitivity-level-invalid", "sensitivity.level must be public, internal, private, or secret.");
+    }
+    if (typeof object.sensitivity.contains_secrets !== "boolean") {
+      addFinding(findings, "error", "sensitivity-secrets-flag-missing", "sensitivity.contains_secrets must be boolean.");
+    }
+    if (!Array.isArray(object.sensitivity.allowed_uses) || object.sensitivity.allowed_uses.length === 0) {
+      addFinding(findings, "error", "sensitivity-allowed-uses-missing", "sensitivity.allowed_uses must be a non-empty array.");
+    }
+    if (object.sensitivity.contains_secrets && object.sensitivity.level !== "secret") {
+      addFinding(findings, "error", "sensitivity-violation", "contains_secrets=true requires sensitivity.level=secret.");
+    }
+    if (object.sensitivity.level === "secret") {
+      const unsafeUse = (object.sensitivity.allowed_uses ?? []).find((use) => !SECRET_SAFE_USES.has(use));
+      if (unsafeUse) {
+        addFinding(findings, "error", "sensitivity-violation", `secret objects cannot be used for ${unsafeUse}.`);
+      }
+    }
+  }
+
+  if (!isPlainObject(object.lifecycle) || !isNonEmptyString(object.lifecycle.status)) {
+    addFinding(findings, "error", "lifecycle-missing", "lifecycle.status is required.");
+  }
+
+  if (!isPlainObject(object.relationships)) {
+    addFinding(findings, "error", "relationships-missing", "relationships object is required.");
+  } else {
+    const supersededBy = Array.isArray(object.relationships.superseded_by) ? object.relationships.superseded_by : [];
+    if (object.type === "decision" && supersededBy.length > 0 && object.lifecycle?.status !== "superseded") {
+      addFinding(findings, "error", "decision-superseded", "Decision with relationships.superseded_by must set lifecycle.status=superseded.");
+    }
+  }
+
+  const waivers = waivedCodes(object);
+  return findings.filter((finding) => !(finding.severity === "warning" && waivers.has(finding.code)));
+}
+
+function readJson(filePath) {
+  try {
+    return JSON.parse(fs.readFileSync(filePath, "utf8"));
+  } catch (error) {
+    return { __parseError: error instanceof Error ? error.message : String(error) };
+  }
+}
+
+export function lintFiles(files, options = {}) {
+  const baseDir = options.baseDir ?? process.cwd();
+  return files.map((file) => {
+    const object = readJson(file);
+    const findings = object.__parseError
+      ? [{ severity: "error", code: "json-parse-error", message: object.__parseError }]
+      : lintObject(object, { ...options, baseDir });
+    return { file, findings };
+  });
+}
+
+function printResult(result) {
+  if (result.findings.length === 0) {
+    console.log(`OK ${result.file}`);
+    return;
+  }
+  for (const finding of result.findings) {
+    console.log(`${finding.severity.toUpperCase()} ${result.file} ${finding.code}: ${finding.message}`);
+  }
+}
+
+function main(argv) {
+  if (argv.length === 0) {
+    console.error("Usage: node scripts/lint-classic-knowledge-object-manifest.mjs <manifest-object.json> [...]");
+    return 2;
+  }
+  const results = lintFiles(argv, { baseDir: process.cwd() });
+  for (const result of results) {
+    printResult(result);
+  }
+  const errorCount = results.reduce(
+    (count, result) => count + result.findings.filter((finding) => finding.severity === "error").length,
+    0,
+  );
+  const warningCount = results.reduce(
+    (count, result) => count + result.findings.filter((finding) => finding.severity === "warning").length,
+    0,
+  );
+  if (errorCount > 0) {
+    console.error(`classic knowledge object manifest lint failed: ${errorCount} error(s), ${warningCount} warning(s).`);
+    return 1;
+  }
+  console.log(`classic knowledge object manifest lint passed: ${results.length} file(s), ${warningCount} warning(s).`);
+  return 0;
+}
+
+const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
+if (entryPath === fileURLToPath(import.meta.url)) {
+  process.exitCode = main(process.argv.slice(2));
+}
diff --git a/personal-os-app/scripts/raw-manifest-ingest.mjs b/personal-os-app/scripts/raw-manifest-ingest.mjs
new file mode 100644
index 0000000..ea5347a
--- /dev/null
+++ b/personal-os-app/scripts/raw-manifest-ingest.mjs
@@ -0,0 +1,258 @@
+#!/usr/bin/env node
+import { lintFiles } from "./lint-classic-knowledge-object-manifest.mjs";
+import fs from "node:fs";
+import path from "node:path";
+import process from "node:process";
+import { fileURLToPath } from "node:url";
+
+const DEFAULT_BASE_URL = "http://192.168.6.37:3100";
+const DEFAULT_AGENT_ID = "obsidianmanager1";
+const DEFAULT_PROJECT = "Personal OS / Wiki 知识库升级";
+
+function isoNow() {
+  return new Date().toISOString();
+}
+
+function readJson(filePath) {
+  try {
+    return JSON.parse(fs.readFileSync(filePath, "utf8"));
+  } catch {
+    return null;
+  }
+}
+
+function writeJson(filePath, data) {
+  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
+}
+
+function readState(stateFile) {
+  if (!fs.existsSync(stateFile)) return {};
+  return readJson(stateFile) ?? {};
+}
+
+function writeState(stateFile, state) {
+  writeJson(stateFile, state);
+}
+
+function classify(filePath, lintResult, state) {
+  const errors = lintResult.findings.filter((f) => f.severity === "error");
+  if (errors.length > 0) {
+    return { action: "invalid", reason: errors.map((e) => e.code).join(", "), errors };
+  }
+  const object = readJson(filePath);
+  if (!object) {
+    return { action: "invalid", reason: "json-parse-error", errors: [{ code: "json-parse-error" }] };
+  }
+  const id = object.id;
+  const hash = object.hash?.value ?? null;
+  const existing = state[id];
+  if (!existing) {
+    return { action: "ingest", reason: "not in registry", id, hash };
+  }
+  if (existing.hash === hash) {
+    return { action: "skip", reason: "hash matches registry", id, hash };
+  }
+  return { action: "update", reason: "hash drift", id, existingHash: existing.hash, newHash: hash };
+}
+
+export function buildIntakePayload(objects, options) {
+  const {
+    agentId = DEFAULT_AGENT_ID,
+    projectName = DEFAULT_PROJECT,
+    generatedAt = isoNow(),
+  } = options;
+  return {
+    source: {
+      sourceType: "agent-output",
+      sourcePlatform: "raw-manifest-ingest",
+      rawText: `Raw manifest ingest: ${objects.length} object(s).`,
+      createdBy: "hermes",
+    },
+    agent: {
+      model: "hermes-raw-manifest-ingest",
+      classification: {
+        kind: "raw-manifest-ingest",
+      },
+      reasoningSummary: "将本地 manifest JSON 对象通过 /api/intake 批量写入 Personal OS。",
+      outputSummary: `已处理 ${objects.length} 个 manifest 对象。`,
+    },
+    project: {
+      name: projectName,
+      status: "active",
+      priority: "P0",
+      currentFocus: "Personal OS / Wiki 自驱闭环生产化",
+    },
+    wikiNotes: objects.map((obj) => ({
+      frontmatter: {
+        title: obj.title || obj.id,
+        type: obj.type || "note",
+        created_by: "hermes:worker",
+        source_type: "agent-output",
+        tags: ["personal-os", "personal-wiki", "raw-manifest", "ingest"],
+        created_at: generatedAt,
+        task_id: obj.id,
+        agent_id: agentId,
+        project: projectName,
+        last_reviewed: generatedAt.slice(0, 10),
+      },
+      metadata: {
+        task_id: obj.id,
+        agent_id: agentId,
+        project: projectName,
+      },
+      content: JSON.stringify(obj, null, 2),
+    })),
+    projectEvents: [
+      {
+        projectName,
+        title: `Raw manifest ingest ${generatedAt.slice(0, 10)}`,
+        body: `已处理 ${objects.length} 个 manifest 对象。`,
+        eventType: "raw-manifest-ingest",
+      },
+    ],
+  };
+}
+
+async function postIntake(baseUrl, token, payload) {
+  if (!token) throw new Error("PERSONAL_OS_API_TOKEN is required for --intake");
+  const scheme = "Bearer";
+  const hdr = {};
+  hdr["Authorization"] = [scheme, token].join(" ");
+  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/intake`, {
+    method: "POST",
+    headers: {
+      ...hdr,
+      "Content-Type": "application/json",
+    },
+    body: JSON.stringify(payload),
+  });
+  const body = await response.json().catch(() => ({}));
+  if (!response.ok) {
+    throw new Error(`Personal OS intake ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
+  }
+  return body;
+}
+
+function parseArgs(argv) {
+  const args = {
+    dir: "",
+    dryRun: true,
+    intake: false,
+    stateFile: "",
+    baseUrl: process.env.PERSONAL_OS_BASE_URL || DEFAULT_BASE_URL,
+    agentId: process.env.INGEST_AGENT_ID || DEFAULT_AGENT_ID,
+    projectName: process.env.INGEST_PROJECT || DEFAULT_PROJECT,
+  };
+
+  for (const arg of argv) {
+    if (arg === "--dry-run") args.dryRun = true;
+    else if (arg === "--intake") { args.intake = true; args.dryRun = false; }
+    else if (arg.startsWith("--dir=")) args.dir = arg.split("=", 2)[1];
+    else if (arg.startsWith("--state-file=")) args.stateFile = arg.split("=", 2)[1];
+    else if (arg.startsWith("--base-url=")) args.baseUrl = arg.split("=", 2)[1];
+    else if (arg.startsWith("--agent-id=")) args.agentId = arg.split("=", 2)[1];
+    else if (arg.startsWith("--project=")) args.projectName = arg.split("=", 2)[1];
+    else if (arg === "--help") {
+      console.log(`Usage: node scripts/raw-manifest-ingest.mjs --dir=<manifest-dir> [--dry-run|--intake] [--state-file=<path>]`);
+      process.exit(0);
+    }
+  }
+
+  if (!args.dir) {
+    throw new Error("--dir is required");
+  }
+  if (!args.stateFile) {
+    args.stateFile = path.join(args.dir, ".raw-manifest-registry.json");
+  }
+  return args;
+}
+
+export async function ingestDirectory(args) {
+  const dir = path.resolve(args.dir);
+  if (!fs.existsSync(dir)) {
+    throw new Error(`Directory does not exist: ${dir}`);
+  }
+  const stat = fs.statSync(dir);
+  if (!stat.isDirectory()) {
+    throw new Error(`Not a directory: ${dir}`);
+  }
+
+  const stateFileName = path.basename(args.stateFile);
+  const files = fs.readdirSync(dir)
+    .filter((f) => f.endsWith(".json") && f !== stateFileName)
+    .map((f) => path.join(dir, f))
+    .filter((f) => fs.statSync(f).isFile());
+
+  if (files.length === 0) {
+    return { counts: { ingest: 0, skip: 0, update: 0, invalid: 0 }, items: [], payload: null, intakeResult: null };
+  }
+
+  const lintResults = lintFiles(files, { baseDir: dir });
+  const state = readState(args.stateFile);
+  const items = [];
+  const toIngest = [];
+  const counts = { ingest: 0, skip: 0, update: 0, invalid: 0 };
+
+  for (let i = 0; i < files.length; i++) {
+    const file = files[i];
+    const result = classify(file, lintResults[i], state);
+    const object = readJson(file);
+    items.push({ file: path.relative(dir, file), action: result.action, reason: result.reason, id: result.id || (object?.id ?? null) });
+    counts[result.action]++;
+    if (result.action === "ingest" || result.action === "update") {
+      if (object) toIngest.push(object);
+    }
+  }
+
+  let payload = null;
+  let intakeResult = null;
+
+  if (args.intake) {
+    payload = buildIntakePayload(toIngest, { agentId: args.agentId, projectName: args.projectName });
+    const token = process.env.PERSONAL_OS_API_TOKEN;
+    intakeResult = await postIntake(args.baseUrl, token, payload);
+    for (const obj of toIngest) {
+      state[obj.id] = { hash: obj.hash?.value ?? null, ingestedAt: isoNow() };
+    }
+    writeState(args.stateFile, state);
+  } else if (!args.dryRun) {
+    for (const obj of toIngest) {
+      state[obj.id] = { hash: obj.hash?.value ?? null, ingestedAt: isoNow() };
+    }
+    writeState(args.stateFile, state);
+  }
+
+  return { counts, items, payload, intakeResult };
+}
+
+export function formatReport(result, dir) {
+  const lines = [
+    "raw-manifest-ingest report",
+    `  dir: ${dir}`,
+    `  ingest: ${result.counts.ingest}, skip: ${result.counts.skip}, update: ${result.counts.update}, invalid: ${result.counts.invalid}`,
+    "",
+  ];
+  for (const item of result.items) {
+    lines.push(`  ${item.action.toUpperCase()}  ${item.file}  (${item.reason})`);
+  }
+  return lines.join("\n");
+}
+
+async function main() {
+  const args = parseArgs(process.argv.slice(2));
+  const result = await ingestDirectory(args);
+  console.log(formatReport(result, args.dir));
+  if (result.intakeResult) {
+    console.log("\nIntake result:", JSON.stringify(result.intakeResult, null, 2).slice(0, 800));
+  }
+  const exitCode = result.counts.invalid > 0 ? 1 : 0;
+  process.exitCode = exitCode;
+}
+
+const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
+if (entryPath === fileURLToPath(import.meta.url)) {
+  main().catch((err) => {
+    console.error(err.message);
+    process.exit(1);
+  });
+}
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/.raw-manifest-registry.json b/personal-os-app/tests/fixtures/raw-manifest-ingest/.raw-manifest-registry.json
new file mode 100644
index 0000000..bf5e0a7
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/.raw-manifest-registry.json
@@ -0,0 +1,10 @@
+{
+  "task:raw-ingest-fixture-skip": {
+    "hash": "d64b16b17becd6b723175e2ff1b5af835fa2bfba3d8018d2a167cfda6174f384",
+    "ingestedAt": "2026-06-23T00:00:00+08:00"
+  },
+  "task:raw-ingest-fixture-update": {
+    "hash": "0000000000000000000000000000000000000000000000000000000000000000",
+    "ingestedAt": "2026-06-23T00:00:00+08:00"
+  }
+}
\ No newline at end of file
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest-source.md b/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest-source.md
new file mode 100644
index 0000000..e248c3c
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest-source.md
@@ -0,0 +1,3 @@
+# ingest-source.md
+
+Fixture source for raw manifest ingest.
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest.json b/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest.json
new file mode 100644
index 0000000..d4e4bcc
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest.json
@@ -0,0 +1,66 @@
+{
+  "schema_version": "classic-knowledge-object-manifest/v0",
+  "id": "task:raw-ingest-fixture-ingest",
+  "type": "task",
+  "title": "Ingest fixture new",
+  "summary": "New object to be ingested.",
+  "source_url": null,
+  "source_type": "agent-output",
+  "freshness": {
+    "status": "fresh",
+    "captured_at": "2026-06-23T23:08:33.177571+08:00",
+    "valid_until": "2026-07-23T23:08:33.177571+08:00",
+    "ttl_days": 30,
+    "last_checked_at": "2026-06-23T23:08:33.177571+08:00",
+    "stale_reason": null
+  },
+  "sensitivity": {
+    "level": "private",
+    "contains_secrets": false,
+    "allowed_uses": [
+      "agent_context",
+      "wiki_index",
+      "task_execution"
+    ],
+    "handling_notes": "Test fixture."
+  },
+  "owner": {
+    "type": "agent",
+    "id": "obsidianmanager1"
+  },
+  "created_at": "2026-06-23T23:08:33.177571+08:00",
+  "updated_at": "2026-06-23T23:08:33.177571+08:00",
+  "confidence": "verified",
+  "lifecycle": {
+    "status": "active",
+    "review_policy": "classic_review_required",
+    "reviewed_at": null,
+    "reviewed_by": null
+  },
+  "relationships": {
+    "project_ids": [],
+    "task_ids": [],
+    "source_run_ids": [],
+    "supersedes": [],
+    "superseded_by": [],
+    "related_ids": []
+  },
+  "embedding": {
+    "version": "not-indexed-v0",
+    "content_hash": null,
+    "indexed_at": null
+  },
+  "content": {
+    "format": "markdown",
+    "uri": "personal-os://fixtures/raw-manifest-ingest",
+    "excerpt": "Fixture."
+  },
+  "lint": {
+    "waivers": []
+  },
+  "source_path": "ingest-source.md",
+  "hash": {
+    "algorithm": "sha256",
+    "value": "d5c2a86018d4454453a6a305e75342a90465b3a3b9c32fdd1a9d6d326a39313b"
+  }
+}
\ No newline at end of file
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/skip-source.md b/personal-os-app/tests/fixtures/raw-manifest-ingest/skip-source.md
new file mode 100644
index 0000000..1407f59
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/skip-source.md
@@ -0,0 +1,3 @@
+# skip-source.md
+
+Fixture source for raw manifest ingest.
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/skip.json b/personal-os-app/tests/fixtures/raw-manifest-ingest/skip.json
new file mode 100644
index 0000000..0ea4550
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/skip.json
@@ -0,0 +1,66 @@
+{
+  "schema_version": "classic-knowledge-object-manifest/v0",
+  "id": "task:raw-ingest-fixture-skip",
+  "type": "task",
+  "title": "Skip fixture existing",
+  "summary": "Existing object with matching hash.",
+  "source_url": null,
+  "source_type": "agent-output",
+  "freshness": {
+    "status": "fresh",
+    "captured_at": "2026-06-23T23:08:33.177571+08:00",
+    "valid_until": "2026-07-23T23:08:33.177571+08:00",
+    "ttl_days": 30,
+    "last_checked_at": "2026-06-23T23:08:33.177571+08:00",
+    "stale_reason": null
+  },
+  "sensitivity": {
+    "level": "private",
+    "contains_secrets": false,
+    "allowed_uses": [
+      "agent_context",
+      "wiki_index",
+      "task_execution"
+    ],
+    "handling_notes": "Test fixture."
+  },
+  "owner": {
+    "type": "agent",
+    "id": "obsidianmanager1"
+  },
+  "created_at": "2026-06-23T23:08:33.177571+08:00",
+  "updated_at": "2026-06-23T23:08:33.177571+08:00",
+  "confidence": "verified",
+  "lifecycle": {
+    "status": "active",
+    "review_policy": "classic_review_required",
+    "reviewed_at": null,
+    "reviewed_by": null
+  },
+  "relationships": {
+    "project_ids": [],
+    "task_ids": [],
+    "source_run_ids": [],
+    "supersedes": [],
+    "superseded_by": [],
+    "related_ids": []
+  },
+  "embedding": {
+    "version": "not-indexed-v0",
+    "content_hash": null,
+    "indexed_at": null
+  },
+  "content": {
+    "format": "markdown",
+    "uri": "personal-os://fixtures/raw-manifest-ingest",
+    "excerpt": "Fixture."
+  },
+  "lint": {
+    "waivers": []
+  },
+  "source_path": "skip-source.md",
+  "hash": {
+    "algorithm": "sha256",
+    "value": "d64b16b17becd6b723175e2ff1b5af835fa2bfba3d8018d2a167cfda6174f384"
+  }
+}
\ No newline at end of file
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/update-source.md b/personal-os-app/tests/fixtures/raw-manifest-ingest/update-source.md
new file mode 100644
index 0000000..b0d1f0a
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/update-source.md
@@ -0,0 +1,3 @@
+# update-source.md
+
+Fixture source for raw manifest ingest.
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/update.json b/personal-os-app/tests/fixtures/raw-manifest-ingest/update.json
new file mode 100644
index 0000000..b0a38ea
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/update.json
@@ -0,0 +1,66 @@
+{
+  "schema_version": "classic-knowledge-object-manifest/v0",
+  "id": "task:raw-ingest-fixture-update",
+  "type": "task",
+  "title": "Update fixture drift",
+  "summary": "Existing object with hash drift in registry but valid manifest.",
+  "source_url": null,
+  "source_type": "agent-output",
+  "freshness": {
+    "status": "fresh",
+    "captured_at": "2026-06-23T23:08:33.177571+08:00",
+    "valid_until": "2026-07-23T23:08:33.177571+08:00",
+    "ttl_days": 30,
+    "last_checked_at": "2026-06-23T23:08:33.177571+08:00",
+    "stale_reason": null
+  },
+  "sensitivity": {
+    "level": "private",
+    "contains_secrets": false,
+    "allowed_uses": [
+      "agent_context",
+      "wiki_index",
+      "task_execution"
+    ],
+    "handling_notes": "Test fixture."
+  },
+  "owner": {
+    "type": "agent",
+    "id": "obsidianmanager1"
+  },
+  "created_at": "2026-06-23T23:08:33.177571+08:00",
+  "updated_at": "2026-06-23T23:08:33.177571+08:00",
+  "confidence": "verified",
+  "lifecycle": {
+    "status": "active",
+    "review_policy": "classic_review_required",
+    "reviewed_at": null,
+    "reviewed_by": null
+  },
+  "relationships": {
+    "project_ids": [],
+    "task_ids": [],
+    "source_run_ids": [],
+    "supersedes": [],
+    "superseded_by": [],
+    "related_ids": []
+  },
+  "embedding": {
+    "version": "not-indexed-v0",
+    "content_hash": null,
+    "indexed_at": null
+  },
+  "content": {
+    "format": "markdown",
+    "uri": "personal-os://fixtures/raw-manifest-ingest",
+    "excerpt": "Fixture."
+  },
+  "lint": {
+    "waivers": []
+  },
+  "source_path": "update-source.md",
+  "hash": {
+    "algorithm": "sha256",
+    "value": "c0410da38593433d73d3d1f94dc5551d6a08b753600d99179a7ec8a44dc18a05"
+  }
+}
\ No newline at end of file
diff --git a/personal-os-app/tests/services/agent-run-context-pack.test.ts b/personal-os-app/tests/services/agent-run-context-pack.test.ts
new file mode 100644
index 0000000..d6fa7c9
--- /dev/null
+++ b/personal-os-app/tests/services/agent-run-context-pack.test.ts
@@ -0,0 +1,113 @@
+import { describe, expect, it } from "vitest";
+
+async function loadArchiver() {
+  const moduleUrl = new URL("../../scripts/archive-agent-run-context-pack.mjs", import.meta.url).href;
+  return import(moduleUrl);
+}
+
+describe("AgentRun context pack archiver", () => {
+  it("builds markdown with task_id, gate, diff, tests, deployment, and residual risks", async () => {
+    const { buildContextPackMarkdown } = await loadArchiver();
+    const markdown = buildContextPackMarkdown({
+      targetTaskId: "task_done_1",
+      archiveTaskId: "task_archive_1",
+      generatedAt: "2026-06-23T00:00:00.000Z",
+      taskContext: {
+        context: {
+          task: {
+            id: "task_done_1",
+            title: "Ship context tiers",
+            status: "done",
+            project: { name: "Personal OS / Wiki 知识库升级" },
+            wikiLinks: [
+              { noteTitle: "Prior note", notePath: "vault/prior.md" },
+            ],
+          },
+        },
+      },
+      artifacts: {
+        runDir: ".agent-runs/task_done_1",
+        files: [
+          { path: "gate.json", bytes: 100 },
+          { path: "diff.patch", bytes: 200 },
+        ],
+        gate: {
+          data: {
+            status: "pass",
+            synthesizer: { allowed_to_announce_done: true },
+            verifier: {
+              commands: [
+                { cmd: "npm test", exit_code: 0, evidence: "artifacts/npm-test.log" },
+              ],
+            },
+            deployment: {
+              status: "pass",
+              backup_dir: "/data/archive/backup",
+              rollback_path: "/data/archive/backup",
+            },
+            production_regression: { status: "pass" },
+            writeback: { status: "pass", task_status: "done" },
+          },
+        },
+        workerResult: {
+          data: {
+            status: "done",
+            diff_path: "diff.patch",
+            diff_stat: "1 file changed",
+            changed_files: ["src/lib/agent-context.ts"],
+            risks: ["Worktree has unrelated files"],
+            writeback: { definitionOfDoneMet: true },
+          },
+        },
+        diffPatch: { exists: true, text: "diff --git a/a b/a", truncated: false },
+        finalMarkdown: { exists: false, text: "", truncated: false },
+      },
+    });
+
+    expect(markdown).toContain("task_id: task_done_1");
+    expect(markdown).toContain("archive_task_id: task_archive_1");
+    expect(markdown).toContain("gate: pass");
+    expect(markdown).toContain("1 file changed");
+    expect(markdown).toContain("npm test");
+    expect(markdown).toContain("deployment_status: pass");
+    expect(markdown).toContain("Worktree has unrelated files");
+  });
+
+  it("builds an intake payload with the production Wiki frontmatter whitelist", async () => {
+    const { buildIntakePayload } = await loadArchiver();
+    const payload = buildIntakePayload({
+      markdown: "# Context pack",
+      title: "AgentRun context pack task_done_1 2026-06-23",
+      targetTaskId: "task_done_1",
+      archiveTaskId: "task_archive_1",
+      agentId: "obsidianmanager1",
+      projectName: "Personal OS / Wiki 知识库升级",
+      generatedAt: "2026-06-23T00:00:00.000Z",
+    });
+
+    expect(payload.wikiNotes[0].frontmatter).toEqual({
+      title: "AgentRun context pack task_done_1 2026-06-23",
+      type: "project",
+      created_by: "hermes:worker",
+      source_type: "agent-output",
+      tags: ["personal-os", "personal-wiki", "agent-run", "context-pack", "evidence"],
+      created_at: "2026-06-23T00:00:00.000Z",
+      task_id: "task_done_1",
+      agent_id: "obsidianmanager1",
+      project: "Personal OS / Wiki 知识库升级",
+      last_reviewed: "2026-06-23",
+    });
+    expect(payload.wikiNotes[0].metadata.archive_task_id).toBe("task_archive_1");
+    expect(payload.projectEvents[0].eventType).toBe("agent-context-pack");
+  });
+
+  it("redacts bearer tokens and token assignments", async () => {
+    const { redact } = await loadArchiver();
+
+    const bearerHeader = ["Authorization:", "Bearer", "secret-token-value-12345"].join(" ");
+    const tokenAssignment = ["PERSONAL_OS_API_TOKEN", "secret-token-value-12345"].join("=");
+
+    expect(redact(bearerHeader)).toBe("Authorization: [REDACTED]");
+    expect(redact(tokenAssignment)).toBe("PERSONAL_OS_API_TOKEN=[REDACTED]");
+  });
+});
diff --git a/personal-os-app/tests/services/knowledge-manifest.test.ts b/personal-os-app/tests/services/knowledge-manifest.test.ts
new file mode 100644
index 0000000..ef2eff2
--- /dev/null
+++ b/personal-os-app/tests/services/knowledge-manifest.test.ts
@@ -0,0 +1,128 @@
+import { execFileSync, spawnSync } from "node:child_process";
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+import { describe, expect, it } from "vitest";
+
+const testDir = path.dirname(fileURLToPath(import.meta.url));
+const appRoot = path.resolve(testDir, "../..");
+const schemaPath = path.join(appRoot, "schemas/classic-knowledge-object-manifest.schema.json");
+const lintScript = path.join(appRoot, "scripts/lint-classic-knowledge-object-manifest.mjs");
+const examplePaths = [
+  "examples/knowledge-objects/task.classic-knowledge-object.json",
+  "examples/knowledge-objects/decision.classic-knowledge-object.json",
+  "examples/knowledge-objects/sop.classic-knowledge-object.json",
+];
+
+function readJson(filePath: string) {
+  return JSON.parse(fs.readFileSync(filePath, "utf8"));
+}
+
+function runLint(files: string[]) {
+  return spawnSync(process.execPath, [lintScript, ...files], {
+    cwd: appRoot,
+    encoding: "utf8",
+  });
+}
+
+describe("Classic Knowledge Object Manifest v0", () => {
+  it("declares the required provenance, freshness, and sensitivity fields", () => {
+    const schema = readJson(schemaPath);
+
+    expect(schema.properties.schema_version.const).toBe(
+      "classic-knowledge-object-manifest/v0",
+    );
+    expect(schema.required).toEqual(
+      expect.arrayContaining([
+        "id",
+        "type",
+        "source_path",
+        "hash",
+        "freshness",
+        "sensitivity",
+        "owner",
+        "confidence",
+        "relationships",
+      ]),
+    );
+    expect(schema.properties.type.enum).toEqual(
+      expect.arrayContaining(["task", "project", "evidence", "decision", "sop", "project_hub"]),
+    );
+    expect(schema.properties.freshness.required).toEqual(
+      expect.arrayContaining(["status", "captured_at", "valid_until", "ttl_days"]),
+    );
+    expect(schema.properties.sensitivity.required).toEqual(
+      expect.arrayContaining(["level", "contains_secrets", "allowed_uses"]),
+    );
+  });
+
+  it("ships three valid example objects", () => {
+    for (const relativePath of examplePaths) {
+      const object = readJson(path.join(appRoot, relativePath));
+      expect(object.schema_version).toBe("classic-knowledge-object-manifest/v0");
+      expect(object.source_path).toBeTruthy();
+      expect(object.hash.algorithm).toBe("sha256");
+      expect(object.freshness.status).toBe("fresh");
+      expect(object.sensitivity.contains_secrets).toBe(false);
+    }
+
+    const result = runLint(examplePaths);
+    expect(result.status, result.stdout + result.stderr).toBe(0);
+    expect(result.stdout).toContain("classic knowledge object manifest lint passed: 3 file(s)");
+  });
+
+  it("rejects no-source objects unless they are explicitly speculative", () => {
+    const base = readJson(path.join(appRoot, examplePaths[0]));
+    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cko-manifest-"));
+    const invalidPath = path.join(tempDir, "invalid.json");
+    fs.writeFileSync(
+      invalidPath,
+      JSON.stringify(
+        {
+          ...base,
+          id: "task:no-source-invalid",
+          source_path: null,
+          hash: null,
+          confidence: "verified",
+        },
+        null,
+        2,
+      ),
+    );
+
+    const result = runLint([invalidPath]);
+    expect(result.status).toBe(1);
+    expect(result.stdout).toContain("no-source-must-be-speculative");
+  });
+
+  it("detects source hash drift", () => {
+    const base = readJson(path.join(appRoot, examplePaths[0]));
+    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cko-manifest-"));
+    const invalidPath = path.join(tempDir, "hash-drift.json");
+    fs.writeFileSync(
+      invalidPath,
+      JSON.stringify(
+        {
+          ...base,
+          id: "task:hash-drift-invalid",
+          hash: { ...base.hash, value: "0".repeat(64) },
+        },
+        null,
+        2,
+      ),
+    );
+
+    const result = runLint([invalidPath]);
+    expect(result.status).toBe(1);
+    expect(result.stdout).toContain("hash-changed");
+  });
+
+  it("lint script is executable by node without TypeScript build", () => {
+    const stdout = execFileSync(process.execPath, [lintScript, examplePaths[0]], {
+      cwd: appRoot,
+      encoding: "utf8",
+    });
+    expect(stdout).toContain("OK examples/knowledge-objects/task.classic-knowledge-object.json");
+  });
+});
diff --git a/personal-os-app/tests/services/raw-manifest-ingest.test.ts b/personal-os-app/tests/services/raw-manifest-ingest.test.ts
new file mode 100644
index 0000000..8a95b6a
--- /dev/null
+++ b/personal-os-app/tests/services/raw-manifest-ingest.test.ts
@@ -0,0 +1,96 @@
+import { describe, expect, it, vi } from "vitest";
+import path from "node:path";
+import fs from "node:fs";
+import { fileURLToPath } from "node:url";
+
+const testDir = path.dirname(fileURLToPath(import.meta.url));
+const appRoot = path.resolve(testDir, "../..");
+const fixtureDir = path.join(appRoot, "tests/fixtures/raw-manifest-ingest");
+const ingestScript = path.join(appRoot, "scripts/raw-manifest-ingest.mjs");
+
+async function loadIngestModule() {
+  vi.resetModules();
+  return import(ingestScript);
+}
+
+describe("raw-manifest-ingest", () => {
+  it("dry-runs 3 fixtures into ingest=1, skip=1, update=1, invalid=0", async () => {
+    const { ingestDirectory, formatReport } = await loadIngestModule();
+
+    const registryPath = path.join(fixtureDir, ".raw-manifest-registry.json");
+    const originalRegistry = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, "utf8") : null;
+
+    try {
+      const result = await ingestDirectory({
+        dir: fixtureDir,
+        dryRun: true,
+        stateFile: registryPath,
+      });
+
+      expect(result.counts).toEqual({ ingest: 1, skip: 1, update: 1, invalid: 0 });
+      expect(result.items).toHaveLength(3);
+      expect(result.items.map((i: { action: string }) => i.action)).toEqual(
+        expect.arrayContaining(["ingest", "skip", "update"]),
+      );
+
+      const ingestItem = result.items.find((i: { action: string; reason?: string }) => i.action === "ingest");
+      expect(ingestItem?.reason).toBe("not in registry");
+
+      const skipItem = result.items.find((i: { action: string; reason?: string }) => i.action === "skip");
+      expect(skipItem?.reason).toBe("hash matches registry");
+
+      const updateItem = result.items.find((i: { action: string; reason?: string }) => i.action === "update");
+      expect(updateItem?.reason).toBe("hash drift");
+
+      const report = formatReport(result, fixtureDir);
+      expect(report).toContain("ingest: 1, skip: 1, update: 1, invalid: 0");
+      expect(report).toContain("INGEST");
+      expect(report).toContain("SKIP");
+      expect(report).toContain("UPDATE");
+    } finally {
+      if (originalRegistry !== null) {
+        fs.writeFileSync(registryPath, originalRegistry);
+      }
+    }
+  });
+
+  it("does not scan the real vault", async () => {
+    const { ingestDirectory } = await loadIngestModule();
+
+    const result = await ingestDirectory({
+      dir: fixtureDir,
+      dryRun: true,
+      stateFile: path.join(fixtureDir, ".raw-manifest-registry.json"),
+    });
+
+    // All items must be within fixtureDir
+    for (const item of result.items) {
+      const itemPath = path.resolve(fixtureDir, item.file);
+      expect(itemPath.startsWith(fixtureDir)).toBe(true);
+    }
+    expect(result.items.length).toBe(3);
+  });
+
+  it("builds an intake payload with correct structure", async () => {
+    const { buildIntakePayload } = await loadIngestModule();
+    const payload = buildIntakePayload(
+      [
+        {
+          id: "task:test",
+          title: "Test object",
+          type: "task",
+          hash: { value: "abc123" },
+        },
+      ],
+      { agentId: "obsidianmanager1", projectName: "Test Project" },
+    );
+
+    expect(payload.source.sourceType).toBe("agent-output");
+    expect(payload.project.priority).toBe("P0");
+    expect(payload.wikiNotes).toHaveLength(1);
+    expect(payload.wikiNotes[0].frontmatter.created_by).toBe("hermes:worker");
+    expect(payload.wikiNotes[0].frontmatter.source_type).toBe("agent-output");
+    expect(payload.wikiNotes[0].frontmatter.tags).toContain("raw-manifest");
+    expect(payload.projectEvents).toHaveLength(1);
+  });
+});
