# _raw + manifest 增量入库试验 v0

任务 ID：cmqq2o6lz000w0jmj9mfh4cer
执行 Agent：obsidianmanager1
生成时间：2026-06-23T13:51:35Z
适用范围：Personal Wiki / Personal OS 的资料入库前置层；本轮只产出本地试验报告，不改生产目录。

## 结论

采用 `_raw` 暂存目录 + `raw-source-manifest.json` 源清单，可以把外部材料入库拆成三种可审计路径：

1. ingest：新来源第一次出现，保留原文、生成 Wiki note，并把 note 路径写回 manifest。
2. skip：内容 hash 已存在，跳过重复加工，只追加 seen 事件。
3. update：同一 source_id 的内容 hash 变化，保留旧 hash 和 revision，生成更新事件，允许后续重写或追加 Wiki note。

这能解决当前 Wiki 入库的两个痛点：重复材料难去重、原始来源和加工后 note 的追溯关系不稳定。

## 目录约定

建议生产落地前先在小样本目录验证，不直接扫全 vault：

```text
vault/
  _raw/
    <source_type>/
      <yyyy-mm>/
        <source_id_slug>/
          original.<ext>
          meta.json
          extracted.md        # 可选：OCR/HTML/PDF 转文本结果
  00_meta/
    manifests/
      raw-source-manifest.json
  30_projects/
    <project>/
      <generated-note>.md
```

约束：

- `_raw` 只追加，不手工覆盖；更新来源时写新 revision 或在 manifest 中记录 previous_hash。
- manifest 是事实账本，不是任务队列；下一步动作仍进入 Personal OS Task。
- Wiki note frontmatter 只保留生产白名单字段：title、type、created_by、source_type、tags、created_at、task_id、agent_id、project、last_reviewed、migration。

## manifest 字段

完整 JSON Schema 见：`schema/raw-source-manifest.schema.json`。

核心字段：

```json
{
  "manifest_version": "raw-manifest-v0",
  "generated_at": "2026-06-23T13:51:35Z",
  "root": "examples/raw",
  "entries": [
    {
      "source_id": "file:project-readme",
      "source_type": "file",
      "raw_path": "examples/raw/update-project-readme.md",
      "content_hash": "sha256:...",
      "hash_algorithm": "sha256",
      "size_bytes": 1234,
      "revision": 2,
      "status": "updated",
      "wiki_note_path": "30_projects/Personal-OS-Wiki-知识库升级/project-readme.md",
      "first_seen_at": "2026-06-23T13:51:35Z",
      "last_seen_at": "2026-06-23T13:51:35Z",
      "last_decision": "update",
      "previous_hashes": ["sha256:old..."],
      "metadata": {
        "task_id": "cmqq2o6lz000w0jmj9mfh4cer"
      }
    }
  ],
  "events": [
    {
      "at": "2026-06-23T13:51:35Z",
      "source_id": "file:project-readme",
      "decision": "update",
      "reason": "same source_id with changed hash"
    }
  ]
}
```

## ingest 流程伪代码

```text
for each raw candidate:
  normalized = normalize(candidate)
  hash = sha256(normalized.content_bytes)
  source_id = stable_source_id(candidate.source_type, candidate.source_url_or_path)

  if manifest has entry where content_hash == hash:
    decision = skip
    append event(reason = "same hash already ingested")
    update last_seen_at only
    continue

  if manifest has entry where source_id == source_id and content_hash != hash:
    decision = update
    append previous content_hash to previous_hashes
    increment revision
    keep raw copy immutable
    schedule Wiki note update or create revision note
    continue

  decision = ingest
  write raw/original + meta.json
  create Wiki note through Personal OS /api/intake
  store wiki_note_path and Personal OS trace ids in manifest
```

## 三个样例路径

本轮样例位于 `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/raw/`。

| 样例文件 | source_id | 预期路径 | 验收点 |
| --- | --- | --- | --- |
| `new-agent-run.md` | `agent-run:cmqq-sample-new` | ingest | before manifest 不存在该 source_id/hash；after manifest 新增 entry |
| `duplicate-existing.md` | `telegram:msg-001` | skip | before manifest 已有同 hash；after 只追加 skip event，不创建新 note |
| `update-project-readme.md` | `file:project-readme` | update | before manifest 有同 source_id 旧 hash；after revision +1，并记录 previous_hashes |

## 本轮不做

- 不扫描真实 Obsidian vault。
- 不移动、删除、重命名任何生产笔记。
- 不部署代码；本任务产物是 schema、流程和可复跑样例。

## 下一步可转任务

如果要进入生产实现，下一步应该是：

```text
实现 raw manifest 小样本 ingest 命令 v0：对象是指定输入目录；动作是生成 manifest、调用 /api/intake 写 Wiki note、记录 ingest/skip/update 三类事件；产物是 scripts/raw-manifest-ingest.mjs 和 3 个回归 fixture；验收标准是 npm test + 单脚本 dry-run 通过，且只处理显式传入目录。
```