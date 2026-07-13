# manifest.after
Format: JSON
Top-level: object
Size: 5
Nested depth: 4

## Schema

- manifest_version: string
- generated_at: string
- root: string
- entries: array (3 items)
- events: array (3 items)

## Preview

```json
{
  "manifest_version": "raw-manifest-v0",
  "generated_at": "2026-06-23T13:54:59.874Z",
  "root": "examples/raw",
  "entries": [
    {
      "source_id": "telegram:msg-001",
      "source_type": "telegram",
      "raw_path": "examples/raw/duplicate-existing.md",
      "content_hash": "sha256:e27ab52e79df2ed690368ddb823752a0c371319f3aa2260d82df286a66f56614",
      "hash_algorithm": "sha256",
      "size_bytes": 222,
      "mtime": "2026-06-23T13:53:13.952Z",
      "revision": 1,
      "status": "skipped",
      "wiki_note_path": "20_notes/telegram/existing-telegram-capture.md",
      "personal_os_task_id": "cmqq2o6lz000w0jmj9mfh4cer",
      "first_seen_at": "2026-06-23T13:54:59.874Z",
      "last_seen_at": "2026-06-23T13:54:59.874Z",
      "last_decision": "skip",
      "previous_hashes": [],
      "metadata": {
        "task_id": "cmqq2o6lz000w0jmj9mfh4cer",
        "fixture": true
      }
    },
    {
      "source_id": "file:project-readme",
      "source_type": "file",
      "raw_path": "examples/raw/update-project-readme.md",
      "content_hash": "sha256:b690dae42a93450007c80cf9831fbc2cf55728ef30afe318b3922c03ea22aea7",
      "hash_algorithm": "sha256",
      "size_bytes": 251,
      "mtime": "2026-06-23T13:53:27.390Z",
      "revision": 2,
      "status": "updated",
      "wiki_note_path": "30_projects/Personal-OS-Wiki-知识库升级/project-readme.md",
      "personal_os_task_id": "cmqq2o6lz000w0jmj9mfh4cer",
      "first_seen_at": "2026-06-23T13:54:59.874Z",
      "last_seen_at": "2026-06-23T13:54:59.874Z",
…
```