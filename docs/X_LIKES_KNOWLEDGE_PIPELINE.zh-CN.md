# X Likes 知识化 Pipeline

目标不是备份 X Likes，而是把 Likes 转成 Agent 可检索、可关联、可复用的知识资产。

链路：

```text
X Likes JSONL/CSV/SQLite
-> 自动主题分类
-> 单条结构化来源笔记
-> 主题聚合页
-> Obsidian Inbox
-> Personal Wiki /api/ingest
-> 搜索验收
```

## 输入

脚本支持三类输入：

- `x_liked_posts_latest.jsonl`
- `x_liked_posts_latest.csv`
- `x_likes.sqlite`

如果不传 `--input`，默认查找：

```text
C:\Users\admin\Documents\Codex\2026-04-28\x\exports\x_liked_posts_latest.jsonl
C:\Users\admin\Documents\Codex\2026-04-28\x\exports\x_liked_posts_latest.csv
C:\Users\admin\Documents\Codex\2026-04-28\x\data\x_likes.sqlite
```

## 一次同步

```powershell
$env:WIKI_API_TOKEN = "<6.28 Personal Wiki write token>"
python .\personal-wiki\scripts\x_likes_knowledge_pipeline.py `
  --input "C:\Users\admin\Documents\Codex\2026-04-28\x\exports\x_liked_posts_latest.jsonl" `
  --obsidian-inbox "/Users/xingqiwu/.hermes/profiles/obsidianmanager1/icarus-fabric/Inbox/" `
  --wiki-url "http://192.168.6.28:3422"
```

没有写入 token 时，脚本仍可用 `--wiki-mode none` 只写 Obsidian 和生成报告。
开发测试可用 `--wiki-mode local --wiki-data-dir <path>` 写本地 vault。

## 首批主题页补种

当 Wiki 里已经有 X Likes Digest，但还没有原始 JSONL/SQLite 时，可以先从
Digest 生成 6 个主题入口页：

```powershell
$env:WIKI_API_TOKEN = "<6.28 Personal Wiki write token>"
python .\personal-wiki\scripts\seed_x_likes_theme_pages.py `
  --wiki-url "http://192.168.6.28:3422" `
  --obsidian-inbox "/Users/xingqiwu/.hermes/profiles/obsidianmanager1/icarus-fabric/Inbox/"
```

这一步不伪造 `tweet_id` 级来源页，只建立主题页和 MOC 入口。原始 Likes
文件可用后，再运行完整 pipeline 补齐每条 Like 的来源页。

## 搜索验收

```powershell
$env:WIKI_READ_TOKEN = "<6.28 Personal Wiki read token>"
python .\personal-wiki\scripts\wiki_search_quality_check.py `
  --wiki-url "http://192.168.6.28:3422"
```

默认验收关键词：

- 公众号
- wechat-publish-template
- MultiPost
- 文章转视频
- 内容矩阵
- 小红书
- 视频号
- Hermes Agent
- Skill
- MCP
- 变现

任一关键词命中数低于 `--min-count` 时，脚本返回非零退出码。

## 定时任务

```powershell
powershell -ExecutionPolicy Bypass `
  -File .\personal-wiki\scripts\register_x_likes_knowledge_task.ps1 `
  -EveryMinutes 60 `
  -WikiUrl "http://192.168.6.28:3422"
```

定时任务会先调用现有 X Likes collector 导出 JSONL，再调用知识化 pipeline。
`WIKI_API_TOKEN` 需要在任务运行环境中可用。

## 主题分类

第一批标签：

- `wechat-official-account`
- `content-matrix`
- `article-to-video`
- `short-video`
- `multi-platform-publishing`
- `xiaohongshu`
- `podcast`
- `creator-monetization`
- `agent-workflow`
- `hermes-agent`
- `mcp-skill`
- `github-tool`
- `saas-case`
- `personal-wiki`
- `automation`

每条 Like 自动附加 `x-likes`，并允许多标签。

## 输出

每条 Like 会生成：

- `X Likes/来源页/<tweet_id>.md`
- Personal Wiki `source_type=x-like` 来源页

每轮同步会生成 6 个主题页：

- X Likes 主题整理 - 公众号运营与内容矩阵
- X Likes 主题整理 - 文章转视频与短视频
- X Likes 主题整理 - 多平台分发工具
- X Likes 主题整理 - Hermes Agent 与 Skill 工作流
- X Likes 主题整理 - 内容变现与副业案例
- X Likes 主题整理 - GitHub 工具与 SaaS 案例

Wiki MOC 还会自动生成：

- `00_meta/tag-maps/x-likes.md`
- `00_meta/tag-maps/content-matrix.md`
- `00_meta/tag-maps/ai-agent-content-automation.md`

## 去重

Wiki `/api/ingest` 对 X Likes 按以下优先级去重：

1. `tweet_id`
2. `canonical_url` / `source_url`
3. `source_hash`
4. `text_hash`

重复入库返回 `status=duplicate`，不会再写出重复笔记。
