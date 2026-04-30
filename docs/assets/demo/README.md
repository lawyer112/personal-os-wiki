# README Demo Assets

These assets are safe public demo media generated from fake data.

The current demo flow is:

```text
Web capture -> Personal OS Inbox -> agent policy chooses cadence
  -> Personal Wiki note -> reviewable task -> Telegram-ready reminder payload
```

Files:

- `personal-os-wiki-readme-demo.en.gif` is the English inline README preview.
- `personal-os-wiki-readme-demo.en.mp4` is the English linked video.
- `personal-os-wiki-readme-demo.zh-CN.gif` is the Chinese inline README preview.
- `personal-os-wiki-readme-demo.zh-CN.mp4` is the Chinese linked video.
- `personal-os-wiki-readme-demo.gif` and `.mp4` mirror the English files for
  older README links.
- `personal-os-wiki-readme-demo.en.poster.png` and
  `personal-os-wiki-readme-demo.zh-CN.poster.png` are generated poster frames.

Regenerate the videos with:

```bash
python scripts/render-readme-demo-media.py
```

Do not replace these with real inbox items, real task history, private Wiki
notes, tokens, browser chrome screenshots, private network maps, or deployment
paths. Public demo media should use fake data only.
