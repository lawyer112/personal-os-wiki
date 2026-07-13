# prod-context-manifest-cron
Format: JSON
Top-level: object
Size: 2
Nested depth: 6

## Schema

- ok: boolean
- context: object (9 keys)

## Preview

```json
{
  "ok": true,
  "context": {
    "generatedAt": "2026-06-23T12:22:37.304Z",
    "task": null,
    "searchQueries": [
      "Classic Knowledge Object Manifest"
    ],
    "wiki": {
      "status": "ok",
      "candidates": [
        {
          "title": "定义 Classic Knowledge Object Manifest v0 — 完成总结",
          "path": "vault/30_projects/Personal-OS-Wiki-知识库升级/定义-Classic-Knowledge-Object-Manifest-v0-完成总结.md",
          "created": "2026-06-23 08:52",
          "created_at": "2026-06-23T08:52:45.882243+00:00",
          "created_sort": 1782204765.882243,
          "created_by": "hermes:worker",
          "type": "project",
          "source_type": "agent-output",
          "source_url": "",
          "source_hash": "",
          "status": "",
          "tags": [
            "knowledge",
            "manifest",
            "schema",
            "wiki"
          ],
          "concepts": [],
          "excerpt": "定义 Classic Knowledge Object Manifest v0：新增 JSON Schema、3 个样例对象、lint 脚本、文档和 Vitest 回归测试；schema 强制 source_path/hash/freshness/sensitivity/owner/confidence/relationships，lint 覆盖 source missi...",
          "source_domain": "",
          "hit_snippet": "定义 Classic Knowledge Object Manifest v0 — 完成总结 定义 Classic Knowledge Object Manifest v0：新增 JSON Schema、3 个样例对象、lint 脚...",
          "url": "http://192.168.6.37:3100/api/wiki/open?next=%2Fnote%3Fpath%3Dvault%252F30_projects%252FPersonal-OS-Wiki-%25E7%259F%25A5%25E8%25AF%2586%25E5%25BA%2593%25E5%258D%2587%25E7%25BA%25A7%252F%25E5%25AE%259A%25E4%25B9%2589-Classic-Knowledge-Object-Manifest-v0-%25E5%25AE%258C%25E6%2588%2590%25E6%2580%25BB%25E7%25BB%2593.md",
          "matchedQueries": [
            "Classic Knowledge Object Manifest"
          ],
          "score": 38
        },
        {
…
```