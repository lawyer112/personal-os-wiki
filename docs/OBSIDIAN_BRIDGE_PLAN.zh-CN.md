# Obsidian 桥接方案

这份文档定义 Personal OS + Personal Wiki 和 Obsidian 的集成方向。

目标不是替代 Obsidian。目标是让人继续用熟悉的 Obsidian 读 Markdown、写长笔记，
同时让 Personal Wiki 继续负责长期知识 API、图谱索引和 Agent 可读取上下文。

## 产品定位

Obsidian 是人的笔记界面。Personal Wiki 是知识服务。Personal OS 是执行和复核层。

```text
Obsidian 插件
  -> 读取 / 搜索 Personal Wiki 笔记
  -> 采集选中文本或当前笔记
  -> 展示相关任务和证据链接

Personal Wiki
  -> Markdown vault
  -> 笔记搜索、标签、概念、图谱
  -> ingest/update API

Personal OS
  -> 任务、认领、复核、提醒、Agent run
```

这个桥接层应该很薄。它不应该变成第二套任务数据库，也不应该变成藏在
Obsidian 里的 Agent runtime。

## 当前项目已经支持什么

Personal Wiki 已经有第一版插件需要的读取接口：

| 需求 | 当前接口 |
| --- | --- |
| 搜索笔记 | `GET /api/notes?q=...` |
| 按标签过滤 | `GET /api/notes?tag=...` |
| 按概念过滤 | `GET /api/notes?concept=...` |
| 读取单篇笔记 | `GET /api/note?path=...` |
| 读取标签和概念 | `GET /api/tags`, `GET /api/concepts` |
| 读取图谱 | `GET /api/graph` |
| 写入采集知识 | `POST /api/ingest` |

Personal OS 已经有后续任务桥接需要的执行接口：

| 需求 | 当前接口 |
| --- | --- |
| 读取 Today / 工作状态 | `GET /api/today` |
| 读取任务上下文 | `GET /api/agent/context?taskId=...` |
| 从插件或 Agent 创建输入 | `POST /api/intake` 或 `POST /api/inbox/items` |
| 创建和复核工作 | task claim、heartbeat、contribution、submit、review APIs |

## 实现阶段

### 阶段 1：只读伴侣插件

先做最小 Obsidian 插件，只保存：

- `Personal Wiki URL`
- `WIKI_READ_TOKEN`
- 可选 `Personal OS URL`
- 可选 `PERSONAL_OS_READ_TOKEN`

命令：

- 搜索 Personal Wiki。
- 按路径打开 Personal Wiki 笔记。
- 把 `wiki://...` 或 Personal Wiki 浏览器链接插入当前笔记。
- 从 `/api/graph` 展示相关笔记。

验收标准：

- 插件能从 Obsidian 搜索私有 Personal Wiki，但不把私有 vault 复制进公开仓库。
- read token 只存在 Obsidian 插件私有配置里，不进 Markdown frontmatter、截图、日志或 Git。
- 只运行 Personal Wiki，不运行 Personal OS 时，插件也能工作。

### 阶段 2：采集 adapter

增加命令，把当前笔记、选中文本或剪贴板 URL 送进已有采集管线。

推荐写入路径：

```text
Obsidian 选中文本 / 当前笔记
  -> POST /api/inbox/items 或 POST /api/intake
  -> InboxItem(status=new)
  -> 后续 Agent enrichment
  -> Wiki note / Task / Idea / Reminder payload
```

插件采集时不应该要求用户填标题、标签、摘要、优先级或任务类型。这些是后续
Agent enrichment 的字段。

验收标准：

- 一次采集只创建 raw Inbox item，默认不消耗 LLM token。
- 如果配置 write token，它只能存在插件私有存储。
- 插件能反馈成功/失败，但不在日志里打印笔记正文或 token。

### 阶段 2A：文件夹 Inbox 模式

在做完整写入插件之前，可以先支持一个更简单的 Obsidian 工作流：

```text
Obsidian vault
  +-- Personal OS Inbox/
        +-- links-and-notes.md
        +-- project-ideas.md
        +-- reading-dump.md
```

用户正常打开 Obsidian 文件夹，把链接、复制的文字、短想法、项目碎片贴进这些文件。
一个很小的本地 adapter 只扫描这个文件夹，把新增 block 送进 Personal OS 或 Personal
Wiki。

规则：

- 每个粘贴 URL、Markdown bullet 或 fenced block 都当成一个 raw candidate。
- 去重前先规范化 URL：host 小写，去掉明显 tracking 参数，在安全时裁掉 fragment，
  但保留原始文本作为证据。
- 用规范化 URL 或规范化文本计算稳定 candidate hash。
- 创建新内容前，先和 Personal Wiki 的 `source_hash`、Personal OS 的 Inbox 记录对比。
- 如果已经存在，返回 `duplicate`，并链接到已有 note 或 inbox item，不再创建副本。
- 如果相似但不完全相同，返回 `possible_duplicate`，交给人或 reviewer agent 决定是否合并。

这个模式不是同步引擎。Obsidian 只是人的临时草稿入口；什么进入长期知识、什么进入任务、
什么只是重复输入，仍然由 Personal OS 和 Personal Wiki 判断。

验收标准：

- 用户能往一个 Obsidian 文件里贴十个链接，然后运行一次 adapter 命令。
- 已经入库的链接会被跳过或关联，不会重复创建。
- 新 raw item 进入 `InboxItem(status=new)` 或 Wiki ingest，并保留来源证据。
- adapter 只写简短本地报告，不输出包含大量私有正文的日志。

### 阶段 3：生成式 Vault 镜像

给想在 Obsidian vault 里直接看到 Personal Wiki 笔记的人，增加可选只读镜像模式。

规则：

- 镜像到生成目录，例如 `Personal Wiki Mirror/`。
- 在机器可读 metadata 里保留 source path、source hash、updated time。
- 镜像文件视为生成物，不作为真实来源直接编辑。
- 不复制私有 `.env`、服务器台账、数据库 dump 或运行日志。

验收标准：

- 重复同步能稳定更新生成文件。
- 删除或归档的 Wiki 笔记有明确处理。
- 冲突不会静默覆盖人的编辑。

### 阶段 4：任务和证据面板

把 Obsidian 的笔记界面接回 Personal OS。

命令和视图：

- 展示和当前笔记或概念相关的任务。
- 从当前选中文本创建任务。
- 把当前笔记作为证据附到任务 contribution。
- 在 Personal OS 打开任务。

验收标准：

- Obsidian 可以创建或引用工作，但 Personal OS 仍然是任务真相。
- 插件不能直接把任务标记为 `done`；复核仍然在 Personal OS。
- 证据链接稳定、可读。

### 阶段 5：可选编辑回写

只有在只读、采集、镜像、任务桥接都稳定之后，才考虑从 Obsidian 直接编辑并回写
Personal Wiki。

必须有的闸门：

- 用 source hash 或 updated time 做乐观并发控制；
- 明确冲突页面；
- 覆盖前必须人工确认；
- 在 Personal Wiki 或 Personal OS 写审计记录。

这个阶段故意放最后。编辑同步最容易把一个有用桥接层变成破坏性同步工具。

## 安全规则

- token 不能进入 Markdown 笔记、frontmatter、URL、截图、日志或公开文档。
- read token 和 write token 分开。
- 默认只读。
- 私有部署数据不是发布源。
- 不把 Obsidian 的 `.obsidian/` 目录放进 Personal Wiki 的公开 release 包。

## 非目标

- 替代 Obsidian、Logseq 或 Notion。
- 让 Obsidian 成为任务执行状态的真相来源。
- 在 Obsidian 插件里跑自治 Agent。
- 把私有 vault 同步到 GitHub。
- 发布一个默认绑定某个用户 LAN 主机名或 token 的公开插件。

## 第一刀怎么做

第一个有用版本很小：

1. 创建 Obsidian 插件骨架。
2. 增加 Wiki URL 和 read token 设置。
3. 用 `GET /api/notes?q=...` 实现笔记搜索。
4. 实现“把 Wiki 链接插入当前笔记”。
5. 用本地或私有 Wiki 做 smoke test。

这能先证明桥接逻辑，不碰写入路径，也不碰同步冲突。
