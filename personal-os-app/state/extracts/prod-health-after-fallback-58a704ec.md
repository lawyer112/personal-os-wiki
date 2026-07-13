# prod-health-after-fallback
Format: JSON
Top-level: object
Size: 6
Nested depth: 3

## Schema

- wiki_health: array (2 items)
- os_context_status: number
- os_context_ok: boolean
- wiki_notes_status: number
- wiki_notes_total: number
- wiki_note_titles: array (3 items)

## Preview

```json
{
  "wiki_health": [
    200,
    {
      "status": "ok",
      "notes": 107,
      "data_dir": "/data"
    }
  ],
  "os_context_status": 200,
  "os_context_ok": true,
  "wiki_notes_status": 200,
  "wiki_notes_total": 3,
  "wiki_note_titles": [
    "<!-- moc:auto-block -->",
    "AI Agent 与内容自动化知识地图",
    "生产回归 frontmatter 合约 20260623T095403Z"
  ]
}
```