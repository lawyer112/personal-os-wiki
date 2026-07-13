# writeback-payload
Format: JSON
Top-level: object
Size: 8
Nested depth: 5

## Schema

- source: object (5 keys)
- agent: object (4 keys)
- project: object (1 keys)
- wikiNotes: array (1 items)
- tasks: array (0 items)
- ideas: array (0 items)
- notes: array (0 items)
- projectEvents: array (1 items)

## Preview

```json
{
  "source": {
    "sourceType": "agent-cron",
    "sourcePlatform": "hermes",
    "sourceMessageId": "cron-cmqq2o6lz000w0jmj9mfh4cer-20260623T135135Z",
    "rawText": "obsidianmanager1 自驱执行 Personal OS task cmqq2o6lz000w0jmj9mfh4cer，产出 _raw + manifest 增量入库试验 v0。",
    "createdBy": "hermes"
  },
  "agent": {
    "model": "gpt-5.5/openai-codex",
    "classification": {
      "task_id": "cmqq2o6lz000w0jmj9mfh4cer",
      "agent_id": "obsidianmanager1",
      "kind": "agent-output",
      "gate_status": "pass",
      "artifact_dir": ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer"
    },
    "reasoningSummary": "选择 P1 agent_allowed 任务，产出 schema、流程、3 个样例和可复跑验证脚本；未触碰生产目录。",
    "outputSummary": "完成 _raw + manifest 增量入库试验 v0，并写入 Wiki/ProjectEvent。"
  },
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya"
  },
  "wikiNotes": [
    {
      "title": "_raw + manifest 增量入库试验 v0 — 2026-06-23",
      "content": "# _raw + manifest 增量入库试验 v0\n\n任务 ID：cmqq2o6lz000w0jmj9mfh4cer\n执行 Agent：obsidianmanager1\n生成时间：2026-06-23T13:51:35Z\n适用范围：Personal Wiki / Personal OS 的资料入库前置层；本轮只产出本地试验报告，不改生产目录。\n\n## 结论\n\n采用 `_raw` 暂存目录 + `raw-source-manifest.json` 源清单，可以把外部材料入库拆成三种可审计路径：\n\n1. ingest：新来源第一次出现，保留原文、生成 Wiki note，并把 note 路径写回 manifest。\n2. skip：内容 hash 已存在，跳过重复加工，只追加 seen 事件。\n3. update：同一 source_id 的内容 hash 变化，保留旧 hash 和 revision，生成更新事件，允许后续重写或追加 Wiki note。\n\n这能解决当前 Wiki 入库的两个痛点：重复材料难去重、原始来源和加工后 note 的追溯关系不稳定。\n\n## 目录约定\n\n建议生产落地前先在小样本目录验证，不直接扫全 vault：\n\n```text\nvault/\n  _raw/\n    <source_type>/\n      <yyyy-mm>/\n        <source_id_slug>/\n          original.<ext>\n          meta.json\n          extracted.md        # 可选：OCR/HTML/PDF 转文本结果\n  00_meta/\n    manifests/\n      raw-source-manifest.json\n  30_projects/\n    <project>/\n      <generated-note>.md\n```\n\n约束：\n\n- `_raw` 只追加，不手工覆盖；更新来源时写新 revision 或在 manifest 中记录 previous_hash。\n- manifest 是事实账本，不是任务队列；下一步动作仍进入 Personal OS Task。\n- Wiki note frontmatter 只保留生产白名单字段：title、type、created_by、source_type、tags、created_at、task_id、agent_id、project、last_reviewed、migration。\n\n## manifest 字段\n\n完整 JSON Schema 见：`schema/raw-source-manifest.schema.json`。\n\n核心字段：\n\n```json\n{\n  \"manifest_version\": \"raw-manifest-v0\",\n  \"generated_at\": \"2026-06-23T13:51:35Z\",\n  \"root\": \"examples/raw\",\n  \"entries\": [\n    {\n      \"source_id\": \"file:project-readme\",\n      \"source_type\": \"file\",\n      \"raw_path\": \"examples/raw/update-project-readme.md\",\n      \"content_hash\": \"sha256:...\",\n      \"hash_algorithm\": \"sha256\",\n      \"size_bytes\": 1234,\n      \"revision\": 2,\n      \"status\": \"updated\",\n      \"wiki_note_path\": \"30_projects/Personal-OS-Wiki-知识库升级/project-readme.md\",\n      \"first_seen_at\": \"2026-06-23T13:51:35Z\",\n      \"last_seen_at\": \"2026-06-23T13:51:35Z\",\n      \"last_decision\": \"update\",\n      \"previous_hashes\": [\"sha256:old...\"],\n      \"metadata\": {\n        \"task_id\": \"cmqq2o6lz000w0jmj9mfh4cer\"\n      }\n    }\n  ],\n  \"events\": [\n    {\n      \"at\": \"2026-06-23T13:51:35Z\",\n      \"source_id\": \"file:project-readme\",\n      \"decision\": \"update\",\n      \"reason\": \"same source_id with changed hash\"\n    }\n  ]\n}\n```\n\n## ingest 流程伪代码\n\n```text\nfor each raw candidate:\n  normalized = normalize(candidate)\n  hash = sha256(normalized.content_bytes)\n  source_id = stable_source_id(candidate.source_type, candidate.source_url_or_path)\n\n  if manifest has entry where content_hash == hash:\n    decision = skip\n    append event(reason = \"same hash already ingested\")\n    update last_seen_at only\n    continue\n\n  if manifest has entry where source_id == source_id and content_hash != hash:\n    decision = update\n    append previous content_hash to previous_hashes\n    increment revision\n    keep raw copy immutable\n    schedule Wiki note update or create revision note\n    continue\n\n  decision = ingest\n  write raw/original + meta.json\n  create Wiki note through Personal OS /api/intake\n  store wiki_note_path and Personal OS trace ids in manifest\n```\n\n## 三个样例路径\n\n本轮样例位于 `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/raw/`。\n\n| 样例文件 | source_id | 预期路径 | 验收点 |\n| --- | --- | --- | --- |\n| `new-agent-run.md` | `agent-run:cmqq-sample-new` | ingest | before manifest 不存在该 source_id/hash；after manifest 新增 entry |\n| `duplicate-existing.md` | `telegram:msg-001` | skip | before manifest 已有同 hash；after 只追加 skip event，不创建新 note |\n| `update-project-readme.md` | `file:project-readme` | update | before manifest 有同 source_id 旧 hash；after revision +1，并记录 previous_hashes |\n\n## 本轮不做\n\n- 不扫描真实 Obsidian vault。\n- 不移动、删除、重命名任何生产笔记。\n- 不部署代码；本任务产物是 schema、流程和可复跑样例。\n\n## 下一步可转任务\n\n如果要进入生产实现，下一步应该是：\n\n```text\n实现 raw manifest 小样本 ingest 命令 v0：对象是指定输入目录；动作是生成 manifest、调用 /api/intake 写 Wiki note、记录 ingest/skip/update 三类事件；产物是 scripts/raw-manifest-ingest.mjs 和 3 个回归 fixture；验收标准是 npm test + 单脚本 dry-run 通过，且只处理显式传入目录。\n```\n\n\n## 运行证据\n\n- task_id: cmqq2o6lz000w0jmj9mfh4cer\n- artifact_dir: .agent-runs/cmqq2o6lz000w0jmj9mfh4cer\n- 样例决策: {\"ingest\": 1, \"skip\": 1, \"update\": 1}\n- 验证命令: `node --check`, `python3 -m json.tool`, decision assertions, script-only eslint。\n- 验证输出:\n\n```text\n## node --check\n## schema json parse\nschema json parse ok\n## decision assertions\ndecision assertions ok {\"ingest\":1,\"skip\":1,\"update\":1}\n```\n\n- 产物索引:\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/diff/agent-run-files.diff`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/decisions.json`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/manifest.after.json`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/manifest.before.json`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/raw/duplicate-existing.md`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/raw/new-agent-run.md`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/raw/update-project-readme.md`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/artifact-sha256.json`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/eslint-targeted-script-only.log`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/eslint-targeted.log`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/simulate-raw-manifest-ingest.log`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/simulate-raw-manifest-ingest.pass.log`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/verification-targeted.log`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/reports/raw-manifest-ingest-v0.md`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/schema/raw-source-manifest.schema.json`\n  - `.agent-runs/cmqq2o6lz000w0jmj9mfh4cer/scripts/simulate-raw-manifest-ingest.mjs`\n",
      "source_type": "agent-output",
      "tags": [
        "personal-os",
        "personal-wiki",
        "manifest",
        "raw",
        "agent-output"
      ],
      "metadata": {
        "task_id": "cmqq2o6lz000w0jmj9mfh4cer",
        "agent_id": "obsidianmanager1",
        "artifact_dir": ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer",
        "gate_status": "pass",
…
```