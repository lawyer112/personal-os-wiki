# 知识系统落地方案

这份文档把当前产品方向落成后续实现准绳。核心规则只有一句：

```text
人只甩进来一个原始东西，Agent 后面再判断它是什么。
```

这个原始东西可以来自网页、书签脚本、浏览器插件、手机分享、Telegram、桌面 App、
文件拖拽，或者未来任何入口。入口可以换，契约不能换。

## 产品方向

系统应该像 Agent 的输入箱，而不是人工填表的笔记软件。

好的采集：

```text
粘贴一个链接
拖入一个文件
发来一段粗糙想法
```

坏的采集：

```text
URL + 标题 + 选中文本 + 摘要 + 标签 + 任务字段
```

标题、平台识别、摘要、标签、任务、提醒、Wiki 反链、关系强弱，都应该是 Agent
后续处理的工作。用户只负责在想法消失前把入口保留下来。

## 处理边界

被动采集必须便宜：

```text
/capture、浏览器插件、App、Telegram 转发、文件拖拽
  -> InboxItem(status=new)
  -> 默认不花 LLM token
```

Agent 处理由策略决定：

```text
手动复核、主动聊天、批处理 worker、定时任务、项目专属 Agent
  -> AgentRun
  -> 抓取来源 / 转写 / 元数据
  -> Wiki 笔记 / Idea / Task / Reminder payload
  -> 证据和复核
```

这就是节省 token 的关键。采集只保存意图；只有真正处理队列时，Agent 才花 token。

## Wiki 入库模型

借鉴 Karpathy 风格的 LLM Wiki，但保留本项目已经有的执行状态层。

| 层 | 当前位置 | 负责人 | 规则 |
| --- | --- | --- | --- |
| 原始来源 | `vault/10_sources` 和 `InboxItem.rawText` | Personal OS / Wiki | 不可变来源痕迹，不能为了好看抹掉出处。 |
| 长期知识 | `vault/20_notes` | Agent 维护的 Markdown | 人能读的笔记、概念、证据和反链。 |
| 工作规约 | `docs/WORKING_MANUAL.zh-CN.md`、`docs/AGENT_GUIDE.zh-CN.md` | 产品文档 | 告诉 Agent 怎么 ingest、query、lint，避免乱整理。 |
| 执行状态 | Personal OS Postgres | Personal OS | 任务、认领、复核、提醒和活动记录。 |

可借鉴的外部方案：

- [Karpathy llm-wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)：
  三层是 raw sources、wiki、schema；三类操作是 ingest、query、lint。
- [Pratiyush/llm-wiki](https://github.com/Pratiyush/llm-wiki)：已经落地的实现，
  把原始来源、生成 Wiki、Agent 可消费导出分开处理。

我们的差异是刻意保留的：Personal Wiki 管知识可读性；Personal OS 管工作可追责。

## 关系强弱模型

图谱不能把所有“可能有关”的东西都画线。弱猜测会制造噪音，让 Wiki 看起来像乱连。

关系分层：

| 分数 | 含义 | 默认图谱行为 |
| --- | --- | --- |
| `0.80-1.00` | 强关系：显式双链、同项目、同来源链路、多个共享概念。 | 明确画线。 |
| `0.50-0.79` | 有用关系：共享概念/标签足够帮助导航。 | 作为相关笔记画线。 |
| `0.15-0.49` | 弱关系：只作为搜索或候选排序信号。 | 默认不画线。 |
| `<0.15` | 噪音。 | 忽略。 |

图谱 API 现在会给 link 输出 `score` 和 `strength`。显式 `[[wikilink]]` 是高置信关系；
标签关系置信度较低，默认隐藏；笔记之间的 `related` 关系只有达到 `0.50` 才会输出。

这样产品语义就清楚了：70% 关系值得看；3% 或 10% 关系不应该变成图上的一条线。

## 清理和 Lint

Wiki 清理不是一次性改标题，而应该变成可重复的 lint。

最小 lint 项：

- 重复的 source hash 或规范化 URL；
- 机器味标题，而不是人能读的标题；
- `auto-ingested`、`web-capture` 这类泛标签支配图谱；
- 没有入链、没有有用标签的孤立笔记；
- 多次出现但没有概念页的概念；
- 旧结论和新来源冲突；
- 公开笔记里出现私有主机名、token、cookie、真实 vault 路径；
- 任务引用的 Wiki 证据已经不存在。

lint 的结果应该生成可复核任务，而不是静默大规模改库。

## 浏览器插件方向

浏览器插件应该只是很薄的采集 adapter。

必要行为：

```text
点击插件按钮
  -> 把当前 tab URL 当成 content 采集
  -> 如有必要，选中文本也只作为 raw content 附带
  -> 显示已保存 / 失败
```

插件不应该问用户标题、标签、摘要、任务类型或优先级。如果它后台写入，token 必须只在
私有插件存储里，不能出现在 URL、截图、日志或公开文档中。

## 实现顺序

1. 保持 `/capture` 作为一字段原始入口。
2. 增加浏览器插件，写同一个 `content` 契约。
3. 增加常见平台抓取 adapter：普通网页、GitHub、X、YouTube、抖音、小红书、博客。
4. 增加 enrichment worker，只在策略允许花 token 时处理 `InboxItem(status=new)`。
5. 把 Wiki lint 扩展成可见报告和任务生成器。
6. 重建索引时重算关系分数，用阈值保持图谱安静。

产品纪律不能变：采集便宜；整理显式；Wiki 长期保存；Personal OS 负责推进。
