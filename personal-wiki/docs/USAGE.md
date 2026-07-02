# Hermes Personal Wiki 使用手册

这套服务的定位很简单：Hermes 负责收材料、整理、维护；Personal Wiki 负责保存 Markdown vault、生成索引、提供浏览页面和维护 API。

当前服务地址：

```text
首页: http://localhost:3422/
全部笔记: http://localhost:3422/notes
健康检查: http://localhost:3422/api/health
```

## 日常怎么用

你只需要把内容发给 Hermes。

可以发：

- 一个想法：一句话、一段话、语音转文字。
- 一个链接：网页、视频、项目、论文、帖子。
- 一个文件：PDF、Markdown、txt、导出的会议记录。
- 一段 DeepTalk/钉钉转写：先用能拿到的方式导出，再发给 Hermes。

Hermes 做三件事：

1. 判断这是什么材料。
2. 整理成一篇可读笔记。
3. 调用 Personal Wiki API 入库。

入库后你在浏览器看：

- 最近几条看首页。
- 查找历史资料进 `/notes`。
- 标签、概念、来源都可以点。
- 点图谱里的笔记、标签、概念进入对应页面。

## Hermes 入库规范

Hermes 调用：

```text
POST http://localhost:3422/api/ingest
Authorization: Bearer <WIKI_API_TOKEN>
Content-Type: application/json
```

Hermes 日常输入、任务结果和项目进度默认先写 Personal OS `/api/intake`，
由 OS 创建 Inbox/AgentRun 并排队 WikiWriteJob。下面的 Personal Wiki 直写
接口只用于 Wiki-only、维护、修复或 API 验证。

请求体：

```json
{
  "title": "笔记标题",
  "content": "整理后的正文，使用 Markdown。可以使用 [[概念名]] 建立概念链接。",
  "source_type": "agent-output",
  "source_url": "telegram://message/example",
  "tags": ["inbox", "hermes"],
  "frontmatter": {
    "title": "笔记标题",
    "type": "note",
    "created_by": "user",
    "source_type": "agent-output",
    "tags": ["inbox", "hermes"],
    "created_at": "2026-07-01T00:00:00.000Z"
  },
  "metadata": {
    "from": "Hermes Agent",
    "raw_type": "text"
  }
}
```

字段约定：

- `title`：给人看的标题，不要太长。
- `content`：正文。这里应该是整理后的知识内容，不是流水账。
- `source_type`：兼容字段；Hermes 直写时以 `frontmatter.source_type` 为准，取值使用 `user-note`、`article`、`transcript`、`agent-output`。
- `frontmatter`：Hermes 直写必填，至少包含 `title/type/created_by/source_type/tags/created_at`。
- `source_url`：原始来源地址；没有就留空。
- `tags`：少量稳定标签。不要给每篇文章塞一堆临时标签。
- `metadata`：机器信息，方便以后追踪来源。

返回值：

```json
{
  "status": "created",
  "note_path": "vault/20_notes/2026-04-20/example.md",
  "url": "/note?path=vault/20_notes/2026-04-20/example.md"
}
```

`status` 可能是：

- `created`：新笔记。
- `duplicate`：同一来源已经有可见笔记。
- `restored`：同一来源以前被归档了，这次重新生成了可见笔记。

## 推荐的笔记正文格式

Hermes 写入正文时用这个结构：

```markdown
# 标题

## 结论

用 3 到 8 句话说清楚这条资料对我有什么用。

## 要点

- 关键点 1。
- 关键点 2。
- 关键点 3。

## 我的用法

这条资料以后可能怎么用，和我当前哪些项目有关。

## 相关概念

- [[Hermes Agent]]
- [[个人知识库]]
- [[Obsidian]]
```

原则：

- 正文只写人读的内容。
- 来源、标签、哈希、状态这些机器信息交给 API 写 frontmatter。
- 概念链接用 `[[概念名]]`。
- 标签用 API 的 `tags` 字段，不要主要依赖正文里的 `#tag`。

## 搜索和浏览

浏览全部笔记：

```text
GET http://localhost:3422/api/notes?page=1&page_size=20
```

全文搜索：

```text
GET http://localhost:3422/api/notes?q=关键词
```

按标签：

```text
GET http://localhost:3422/api/notes?tag=hermes
```

按概念：

```text
GET http://localhost:3422/api/notes?concept=个人知识库
```

按来源：

```text
GET http://localhost:3422/api/notes?source_type=telegram
```

读取单篇笔记：

```text
GET http://localhost:3422/api/note?path=vault/20_notes/2026-04-20/example.md
```

获取标签、概念、图谱：

```text
GET http://localhost:3422/api/tags
GET http://localhost:3422/api/concepts
GET http://localhost:3422/api/graph
```

`/api/graph` 的 link 会包含 `score` 和 `strength`。显式 `[[概念]]` 连接是高置信；
标签连接是低置信；笔记之间的 `related` 连接只有关系分数达到阈值才会输出，避免
图谱因为 3% 或 10% 这类弱关系变成乱线。

## Hermes 维护动作

这些写操作都需要：

```text
Authorization: Bearer <WIKI_API_TOKEN>
```

更新笔记：

```text
POST /api/note/update
```

```json
{
  "path": "vault/20_notes/2026-04-20/example.md",
  "title": "新的标题",
  "content": "新的 Markdown 正文",
  "tags": ["hermes", "wiki"]
}
```

加减标签：

```text
POST /api/note/tag
```

```json
{
  "path": "vault/20_notes/2026-04-20/example.md",
  "add": ["reviewed"],
  "remove": ["inbox"]
}
```

归档笔记：

```text
POST /api/note/archive
```

```json
{
  "path": "vault/20_notes/2026-04-20/example.md"
}
```

删除笔记：

```text
POST /api/note/delete
```

```json
{
  "path": "vault/20_notes/2026-04-20/example.md"
}
```

这里的 delete 是软删除，会移动到 `vault/90_archive/`，不会硬删。

重命名概念链接：

```text
POST /api/relink
```

```json
{
  "from": "旧概念",
  "to": "新概念"
}
```

重建索引：

```text
POST /api/rebuild
```

用于手动改了 Markdown 文件以后刷新列表、搜索和图谱。

## Hermes 工作规约

可以把这一段放进 Hermes 的知识库管理员指令里：

```text
你是我的 Personal Wiki 管理员。用户发来的想法、链接、文件摘要、语音转文字都要整理成可读 Markdown，然后写入 Personal Wiki。

入库规则：
1. 日常输入先写 Personal OS `/api/intake`；只有 Wiki-only、维护、修复或 API 验证才直写 Personal Wiki。
2. 标题要短，能让用户一眼知道这条笔记是什么。
3. 正文用 Markdown，优先写结论、要点、我的用法、相关概念。
4. 使用 [[概念名]] 建立知识图谱连接。
5. tags 控制在 2 到 6 个，使用稳定标签，不要制造大量一次性标签。
6. 直写 Personal Wiki 时必须带 frontmatter；source_type 只用 user-note、article、transcript、agent-output。
7. 原始链接放 source_url；没有链接就留空。
8. 如果用户后来纠错，调用 update/tag/relink/archive，而不是重复新增一篇。
9. 如果发现同一来源返回 duplicate，读取原 note_path 后按需要 update。
10. 如果返回 restored，说明旧笔记曾被归档，现在已经重新变成可见笔记。
```

## DeepTalk/钉钉转写接入

现在没有稳定 API 的情况下，先按文件/文本入口走：

1. 能导出文本时，把转写文本发给 Hermes。
2. 能导出文件时，把文件发给 Hermes。
3. Hermes 日常入口使用 Personal OS `/api/intake` 的 `wikiNotes[]`；直写 Wiki 时使用 `frontmatter.source_type: "transcript"`。
4. `metadata` 里记录设备、会议时间、说话人等信息。

示例：

```json
{
  "title": "DeepTalk 语音记录：个人知识库想法",
  "content": "# DeepTalk 语音记录：个人知识库想法\n\n## 结论\n\n这段语音主要是在讨论 [[个人知识库]] 的输入层和 Hermes 自动入库流程。\n\n## 要点\n\n- Telegram 是当前主入口。\n- DeepTalk 转写可以作为 transcript 来源。\n- Hermes 负责整理，不需要人工确认。\n\n## 相关概念\n\n- [[Hermes Agent]]\n- [[个人知识库]]",
  "source_type": "transcript",
  "source_url": "",
  "tags": ["voice", "deeptalk", "wiki"],
  "frontmatter": {
    "title": "DeepTalk 语音记录：个人知识库想法",
    "type": "note",
    "created_by": "user",
    "source_type": "transcript",
    "tags": ["voice", "deeptalk", "wiki"],
    "created_at": "2026-07-01T00:00:00.000Z"
  },
  "metadata": {
    "device": "DeepTalk",
    "export_method": "manual"
  }
}
```

以后如果找到 DeepTalk 自动导出办法，只需要把自动导出的文本/文件接到 Hermes 输入层，不需要改 Personal Wiki API。

## 错误码

```text
200 成功
400 请求格式不对，或者维护动作缺少必要字段
401 Token 不对
404 笔记不存在
500 服务内部错误
```

Hermes 处理建议：

- `400`：检查请求 JSON 和字段。
- `401`：写接口检查 `WIKI_API_TOKEN`，读接口检查 `WIKI_READ_TOKEN`。
- `404`：重新搜索笔记，不要盲目重试。
- `500`：稍后重试，并通知用户或记录日志。

## Example Linux Deployment

The path below is an example for a self-hosted Linux install. It is not a
private deployment requirement.

服务目录示例：

```text
/opt/personal-wiki
```

常用命令：

```bash
cd /opt/personal-wiki
scripts/status.sh
scripts/restart.sh
tail -f logs/personal-wiki.log
```

数据目录：

```text
/opt/personal-wiki/data
```

关键结构：

```text
data/
  vault/
    10_sources/   原始来源 JSON
    20_notes/     可见 Markdown 笔记
    90_archive/   归档/软删除
  public/
    graph-data.json
    note-index.json
  .git/
```

每次成功写入或维护都会刷新索引，并提交到 Git。出问题时先看日志，再看 Git 历史。
