# 对象化知识库长期大改手册

这份手册记录当前产品决策：不再把 Personal Wiki 只当成普通 Markdown
笔记浏览器来小修小补，而是直接朝长期方向改造成 **Agent 可维护、可推进行动的对象化知识库**。

一句话：

```text
Wiki 不只是存笔记；Wiki 要保存项目、工具、方案、工作流、证据和关系。
Personal OS 不只是任务板；Personal OS 要调度 Agent 从这些知识对象里认领工作、执行、留痕、复核。
```

## 当前判断

当前仓库继续保持 monorepo：

```text
personal-os-wiki/
  personal-os-app/   工作状态、任务、Agent 执行、复核、提醒
  personal-wiki/     Markdown vault、知识对象、图谱、证据、浏览
  docs/              Agent 手册、部署手册、产品路线图
```

发布上是一个仓库、一个 Release 包、一条 compose 路线。运行时仍然是两个
Web 服务加一个数据库：

```text
Personal OS   管任务、项目、Agent 执行状态
Personal Wiki 管长期知识、对象、证据、关系图谱
Postgres      管 OS 的结构化状态
```

现在不拆仓。拆仓是后续条件成熟后的动作，不是当前大改前置条件。

## 为什么直接走长期方向

当前 Wiki 已经有入库、搜索、标签、概念、双链和图谱，但它的问题也很明确：

- 笔记类型不清楚：项目、工具、方案、工作流、证据、任务记录混在一起。
- 图谱关系偏弱：主要靠 `[[wikilink]]`、共享概念和共享标签。
- 用户看到线，但不知道为什么相关。
- 全局图容易乱，缺少当前对象的局部图。
- 缺少 Wiki lint：孤岛、重复、泛标签、缺概念页、过期结论不会自动暴露。
- Agent 可以写 Wiki，但还没有稳定的对象 schema 指导它怎么写。

所以这次方向不是“把图谱画漂亮一点”，而是改底层语义：

```text
Markdown 页面 -> 知识对象
链接线条 -> 有原因、有置信度、有类型的关系
普通入库 -> Agent 可复核的知识维护任务
```

## 产品原则

### 1. 人只负责低摩擦输入

用户不应该被要求一开始就填标题、标签、摘要、任务类型、优先级。

正确入口：

```text
粘贴链接
转发语音转写
拖入文件
发一段碎碎念
```

分类、摘要、标签、关系、任务拆解，都是 Agent 后续处理。

### 2. Wiki 保存长期可复用知识

Wiki 保存的不是聊天记录垃圾桶，而是稳定知识：

- 项目是什么；
- 工具怎么用；
- 某个方案为什么可行或不可行；
- 某个工作流怎么执行；
- 某次任务的证据在哪里；
- 哪些知识已经过期；
- 哪些缺口需要研究。

### 3. OS 保存任务真相

Personal OS 不负责长篇知识表达。它负责：

- 什么还没做；
- 谁认领了；
- 下一步是什么；
- 完成定义是什么；
- 风险等级是什么；
- Agent 做了什么；
- 证据是否通过复核。

### 4. Agent 是维护者，不是黑盒总结器

Agent 写入 Wiki 或 OS 时必须留下结构化痕迹：

- 来源是什么；
- 为什么这样分类；
- 关系为什么成立；
- 置信度是多少；
- 还缺什么；
- 需要人复核什么；
- 生成了哪些后续任务。

### 5. 每几步就提交并推送

这次大改采用小批量推进：

```text
2-4 个相关小任务 -> 本地验证 -> commit -> push -> CI -> 下一批
```

不要憋一个巨大重构。每个 commit 必须是可评审、可回滚、可解释的单位。

## 目标架构

长期目标是把 Wiki 变成对象化知识层：

```text
Source
  原始输入、链接、文件、转写、网页

KnowledgeObject
  project / tool / service / workflow / decision / evidence / concept / person / task-note

Relationship
  explicit_link / same_source / same_project / supports / contradicts / implements /
  depends_on / evidence_for / replaced_by / similar_to

LintIssue
  orphan / duplicate / weak_title / missing_source / stale / private_data_risk /
  missing_project_page / missing_workflow / weak_relation

AgentTask
  由 lint、缺口、用户输入、项目推进自动产生，可被 Personal OS 管理
```

Markdown 仍然保留，因为它适合人读、适合 Git、适合长期保存。但 Markdown
前面要有明确 frontmatter，让 Agent 和程序能稳定理解。

## Wiki 对象 schema 初版

每篇 Wiki 笔记逐步补齐 frontmatter：

```yaml
---
title: "OCR 方案评估"
type: "project | tool | service | workflow | decision | evidence | concept | source | task-note"
status: "draft | active | verified | stale | archived"
projects: ["文档自动化"]
entities: ["OCR", "PaddleOCR", "MinerU"]
sources:
  - "source:2026-04-30-ocr-link"
related_tasks:
  - "task:..."
confidence: 0.72
last_verified: "2026-04-30"
owner: "agent | human | mixed"
privacy: "public-demo | private | sensitive"
---
```

先不追求一次性补全所有字段。第一阶段只要求新入库和新整理的笔记遵守 schema。

## 图谱关系模型 v2

关系不能只靠标签。新的关系打分至少使用这些信号：

| 信号 | 说明 | 默认权重 |
| --- | --- | --- |
| 显式双链 | `[[...]]` 明确连接 | 高 |
| 同来源 | 两个对象来自同一原始资料或同一导入批次 | 高 |
| 同项目 | 属于同一个 project | 高 |
| OS 任务证据 | 某个任务的 artifact/evidence 指向该 Wiki note | 高 |
| 类型亲和 | workflow 和 tool、decision 和 evidence 等天然相关 | 中 |
| 共享实体 | 共同实体、工具、服务名 | 中 |
| 共享标签 | 只作为弱信号 | 低 |

每条边要能解释：

```json
{
  "type": "same_project",
  "score": 0.84,
  "reason": {
    "shared_projects": ["文档自动化"],
    "shared_sources": ["source:ocr-comparison"],
    "explicit_links": ["[[PaddleOCR]]"]
  }
}
```

UI 必须显示“为什么相关”，否则图谱只是在画线。

## Wiki UI 方向

不要把全部精力放在全局图。用户和 Agent 更需要这些视图：

| 视图 | 作用 |
| --- | --- |
| 对象主页 | 当前项目、工具、工作流、证据的结构化信息 |
| 局部图谱 | 当前对象 1-2 跳关系，默认过滤弱边 |
| 相关原因 | 每条相关项说明为什么连 |
| 缺口列表 | 缺项目页、缺来源、缺复核、缺 workflow |
| 维护队列 | Wiki lint 生成的可认领任务 |
| 项目知识页 | 一个项目下的工具、决策、证据、任务、工作流 |

全局图保留，但不作为主交互入口。

## OS 联动方向

Personal OS 要把 Wiki 的问题变成可执行任务：

```text
Wiki lint 发现问题
  -> Personal OS 生成 agent_task
  -> Agent 按能力标签认领
  -> Agent 修 Wiki / 补来源 / 建项目页 / 整理工作流
  -> 提交 evidence
  -> Review 通过
  -> Wiki 图谱和对象状态更新
```

这才是产品差异：不是“AI 知识库”，而是“知识库会长出维护任务，并让 Agent 去做”。

## 第一批任务

第一批只做基础，不做大 UI 重写。

1. 定义 Wiki object frontmatter schema。
2. 增加 schema 文档和示例笔记。
3. 给 Personal Wiki 增加 frontmatter 读取字段。
4. 在 graph API 输出 `type/status/projects/sources/confidence/last_verified`。
5. 重写关系打分函数，加入同来源、同项目、类型亲和。
6. 在相关边里输出 `reason`，前端展示“为什么相关”。
7. 增加 local graph API：`/api/graph?focus=<path>&depth=2&min_score=0.5`。
8. 增加 Wiki lint 报告：孤岛、泛标签、缺来源、缺对象类型、缺项目页。
9. lint 报告生成 Personal OS 可认领任务。
10. 在 README 和 demo 里展示“一个对象如何变成任务、证据和复核”。

## 提交节奏

每一批 commit 控制在一个明确主题：

```text
Batch 1: docs/schema only
Batch 2: parser and graph metadata
Batch 3: relation scoring v2
Batch 4: local graph API
Batch 5: Wiki lint report
Batch 6: OS task generation from lint
Batch 7: UI polish and demo
```

每批完成后必须：

```text
git diff --check
npm test                 # 如果动 personal-os-app
npm run typecheck        # 如果动 TypeScript
python -m py_compile     # 如果动 personal-wiki
python -m unittest       # 如果动 Wiki tests
git commit
git push
gh run watch
```

## 不做什么

当前阶段不做：

- 不拆仓；
- 不做 hosted SaaS；
- 不把真实私人 vault 放进 Git；
- 不追求一次性迁移所有旧笔记；
- 不让 Agent 绕过 review 自动执行高风险任务；
- 不把 Wiki 做成 Notion/Obsidian 的完整替代品；
- 不把图谱做成炫酷动画优先的展示项目。

## 验收标准

这轮长期大改不是看“页面是否更漂亮”，而是看：

- 新笔记是否有对象类型；
- 关系是否能解释原因；
- 弱关系是否不再污染图谱；
- 一个项目是否能看到相关工具、决策、证据、任务；
- Wiki lint 是否能发现维护问题；
- 维护问题是否能变成 OS 任务；
- Agent 是否能认领这些任务并提交证据；
- Review 通过后，Wiki 是否变得更准。

最终目标：

```text
用户随手丢输入；
Agent 整理成对象化知识；
知识缺口变成任务；
Agent 认领任务并执行；
证据通过复核；
Wiki 和 OS 都变得更有用。
```

这是后续工作的主线。
