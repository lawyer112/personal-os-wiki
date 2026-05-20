# 产品地图 Product Map

这份文档是 Personal OS + Personal Wiki + Hermes 团队这三件东西的
"产品层地图"。不是 spec，不是需求文档，也不是实现清单。目的只有一个：
当你（或者未来接手的人）再次感到迷茫的时候，回来看一眼，就知道
"现在在哪、下一步该往哪走、为什么是这步"。

工程层的详细 gap 列表保留在
[`HUMAN_AGENT_COLLABORATION_ROADMAP.zh-CN.md`](./HUMAN_AGENT_COLLABORATION_ROADMAP.zh-CN.md)。
本文件在它之上一层，解释"为什么要填那些 gap"。

---

## 1. 终局形态 Endgame

```
                     ┌─────────────────────────┐
                     │     用户（你 / 客户）   │
                     │  Telegram / 手机 / 语音 │
                     └──────────┬──────────────┘
                                │
                                ▼
               ┌────────────────────────────────────┐
               │      Hermes Agent 团队             │
               │  （Mac Mini / 私有服务器 / 云）    │
               │                                    │
               │   碎碎念入库 bot                   │
               │     ↓                              │
               │   主助理（调度 / 规划 / 反问）     │
               │     ↓                              │
               │   通用 worker（调工具 / 出产物）   │
               │     ↑                              │
               │  （二期后挂载 Skill 包变"专家"）   │
               └──────────┬─────────────────────────┘
                          │ 读 / 写 / 事件
                          ▼
    ┌──────────────────────────────────────────────────┐
    │  Personal OS（协调中枢）                          │
    │  - 谁该干啥、何时唤醒谁、要问用户什么             │
    │  - Inbox / Task / Idea / Project / Clarification  │
    │  - TaskRun / ActionLog 审计                       │
    │  - 不存长期知识                                   │
    └──────────────────┬───────────────────────────────┘
                       │ 链接 / 钩子
                       ▼
    ┌──────────────────────────────────────────────────┐
    │  Personal Wiki（外挂记忆）                        │
    │  - 长期知识 + 项目档案 + 执行留痕                 │
    │  - 结构化目录 + 统一 frontmatter                  │
    │  - 拓扑知识图：搜 tag 能查到"谁在什么时候干了啥"  │
    └──────────────────┬───────────────────────────────┘
                       │ 将来
                       ▼
                Obsidian 插件（同一张图的可视化）

商用形态：以上整套打包 → 给别人也能装一份自己的 Hermes 助理团队
```

核心三角关系：

- Personal OS = 协调中枢（活的状态、调度、审计）
- Personal Wiki = 外挂记忆（长期知识、项目档案、可回溯）
- Hermes 团队 = 干活的手（听话、派活、执行）

Wiki 是记忆、OS 是大脑皮层、Hermes 是身体。三者缺一不可。

---

## 2. 三大组件职责 Division of Responsibility

区分"谁该管什么"的边界，是这个产品不乱的前提。

### Personal OS 管

- 活的状态：Inbox、Task、Idea、Project、Clarification、Notification
- 调度：谁该干这件事，什么时候叫醒谁
- 审计：TaskRun、ActionLog、Review、DailyPlan
- 权限：AgentProfile（谁能读、谁能写、风险上限）
- 不碰长期知识本身，只存"指向知识的链接"

### Personal Wiki 管

- 长期知识：项目档案、参考资料、可复用攻略、决策记录
- 原始输入归档：文章、转写、截图、导出文本
- 执行留痕：每个 Agent 任务完成后的 summary note
- 检索：全文搜、tag、concepts、拓扑图
- 不承担调度、不知道"今天要干啥"

### Hermes 团队 管

- 听话（接收用户输入）
- 思考（读 OS 任务、读 Wiki 记忆、决定下一步）
- 反问（不确定就问用户，而不是硬猜）
- 执行（调 Telegram、Web、Calendar、Shell、LLM 等工具）
- 留痕（回写 OS 审计、写 Wiki 知识）
- 不承担状态管理、不承担长期存储（那是 OS 和 Wiki 的事）

**一句话判定**：

- 这东西以后还想回头看？ → Wiki
- 这东西今天要干？ → OS
- 这东西要动手？ → Hermes

---

## 3. Agent 角色划分 Roles (一期)

Mac Mini 上跑的是多个独立 Hermes profile（各自有 SOUL、记忆、bot token），
不是"一个大脑切换角色"。Personal OS 承认这个事实。

一期只定三类角色，不要更多：

### 碎碎念入库 bot（Intake）

- 入口：你日常聊天的 Telegram bot
- 职责：只负责听 + 写入 Personal OS / Wiki
- 不做的事：规划、执行、反问
- 产出：InboxItem + 可选的 Idea / Task / Wiki note
- 对应 AgentProfile: `tags=["intake"]`, `canWriteTasks=true`

### 主助理（Dispatcher）

- 入口：Personal OS webhook 唤醒 / 定时器唤醒
- 职责：读任务、规划一天、决定派给谁、必要时反问用户
- 不做的事：动手执行工具（搜网页、抓数据、写海报）
- 产出：任务派发、Clarification、Telegram 回话
- 对应 AgentProfile: `tags=["dispatcher"]`, 风险上限 medium

### 通用 worker（Executor）

- 入口：Personal OS webhook 唤醒 / polling `/api/agent-inbox`
- 职责：claim 任务、调工具、出产物、写 Wiki、submit
- 可以有多个实例（按机器或按队列分）
- 产出：Artifact、Wiki note、Contribution
- 对应 AgentProfile: `tags=["worker"]`, 风险上限 low～medium

**注意**：用户视角看到的还是一个 bot（碎碎念 bot）。主助理回话时，
走的也是这个 bot（Personal OS 生成 payload，碎碎念 bot 代发）。
所以用户不会感觉到"团队"这件事，只感觉到助理会自己动起来。

到了二期，"旅游专家 / 期货 manager / 海报 poster" 不是新增 Agent，
而是通用 worker 挂载不同 Skill 包。同一个进程，看到任务 tag 不同就加载
不同行为。这样避免进程爆炸，也方便商用打包。

---

## 4. 分期目标 Phases

### 一期：通电 + 整理 Wiki（两阶段交付：MVP + 加固）

**一期状态**：已完成（完成日期：2026-05-13）。

**定义**：把死的协议通上电，把乱的 Wiki 理清楚。

节奏分两段（**不绑日历，做完哪段算哪段**）：

- **MVP**：砍到骨头，跑通东京旅游验收场景。接受"Agent 顺的时候能跑"。
- **加固**：补兜底、补 webhook、补质量校验。让系统在"Agent 翻车"时也能扛。

为什么分两段而不是一次干完：先做出可感知的闭环，亲眼看见问题，再决定剩下
的精力投在哪里。避免"先做完整保险，发现方向错了"。

**三管齐下**（这是一期的核心，缺一不可）：

**A. Hermes 侧 — 通电**

- 三角色定义：碎碎念 bot / 主助理 / 通用 worker
- 分角色 AGENT_PROMPT（不再一份 prompt 通吃）
- webhook 监听端点（接 Personal OS 推送）
- Telegram 按钮 callback 收取 + 回写

**B. Personal OS 侧 — 调度**

- AgentProfile 升为一等：endpoint、bot_token、role
- 事件分发：新 task / idea / clarification 按 tag / capability 推给目标 Agent
- Clarification 对象：挂任务 + 具体问题 + 选项 + 超时 + 状态
- Notification payload：按钮从跳链接升级为 callback
- 用户答案回写端点 + 唤醒原 Agent 继续
- submit 钩子：任务完成自动向 Wiki 写 summary note（带 frontmatter）

**C. Wiki 侧 — 组织**

- vault 目录重构（详见下一节）
- frontmatter 规范（每篇笔记必带 `agent` / `task` / `project` / `created_by`）
- `/api/ingest` 升级：写入时必须带归属字段，自动放对目录
- 老数据迁移脚本
- MOC（Map of Content）自动生成器：`00_meta/index.md` 自动更新

**一期成功标准**（单一验收场景）：

1. 你在碎碎念 bot 里发"5月15号去东京三天"
2. 主助理在 30 秒内通过同一 bot 反问你："要我规划行程参考吗？"，
   下面带三个按钮：[规划] [只排工作] [不管]
3. 你手机点 [规划]
4. 通用 worker 领任务 → 调 LLM + Web → 产出行程草案
5. Wiki 里自动出现 `30_projects/2026-05 东京行/` 目录，包含行程、住宿、
   交通几篇笔记，每篇都带 `agent: <id>` `task: <id>` `project: 东京行`
6. 你在 Wiki 搜 `tag:agent-produced` 能看到这次产出
7. Personal OS 的 Today 页面能看到这个 task 从 review → todo → doing →
   submitted → done 的完整轨迹

这一个场景跑通，"助理感"就立住了。

### MVP 的取舍清单

为了 MVP 真的能跑通，**明确砍这些**，转到加固阶段补：

| 砍了什么 | MVP 保留的简化版 |
|---|---|
| webhook 推送 | polling `/api/agent-inbox`，5~10 分钟一次 |
| Wiki 完整目录重构 + 迁移 | 只加 `30_projects/` `40_journals/` 两个新目录 + frontmatter 强制；老数据不动 |
| MOC 自动生成器 | 无，先靠 Wiki 搜索 |
| 复杂 Clarification（多轮、撤回、编辑） | 单轮、3 个固定按钮选项、24h 超时后归档 |
| AgentProfile 完整升级 | 只加 `role`、`bot_token_ref`、`endpoint` 三个字段 |
| OS 预生成候选（Agent 做选择题） | 先不做，依赖 Agent prompt + 最简校验 |
| 服务端完整质量门禁 | 只卡最硬 3 条：nextAction 非空、frontmatter 必填、agent_id 必填 |
| 事件批处理调度 | 无，事件即时处理（量小时成本可接受）|

**MVP 任务分组**（详见 `.kiro/specs/wiki-vault-restructure/tasks.md`）：

- Group 1：OS 改造 — AgentProfile 三字段、Clarification 对象、回写端点、
  submit 触发 Wiki 写入
- Group 2：Wiki 改造 — `/api/ingest` 要求 frontmatter、两个目录约定
- Group 3-5：Hermes 三角色 prompt + 碎碎念 bot 改造 + callback 按钮处理 +
  worker 轮询脚本
- Group 6：跑东京旅游验收场景，调 bug
- Group 7：AGENT_PROMPT 整理 + 使用文档

### 加固阶段要补什么

- webhook 推送（把 polling 的 5~10 分钟延迟降到秒级）
- OS 侧预生成候选（让 Agent 做选择题而不是填空题，降翻车）
- 服务端任务质量校验完整版
- 失败重试策略（lease 过期 / Agent 崩溃 / 回答超时）
- 老 Wiki 数据迁移脚本
- MOC 自动生成器
- 事件批处理调度（主助理 5~10 分钟批处理一次，省 LLM）
- 成本可见化（大任务前估 token，超阈值先问用户）

### 一期注定不做的

- 领域专家分工（二期 Skill 包）
- Workflow / Skill 一等对象
- Review criteria 清单化
- Obsidian 插件
- 商用打包

### 二期：能力变专业

**定义**：让 worker 从"通用"变成"能胜任特定领域"。

- **Skill 包机制**：把"旅游规划"、"期货数据抓取"、"红浪海报模板"做成
  可加载的 Skill，worker 按任务 tag 自动加载。Skill 本身是 Wiki 里的
  `50_skills/*.md` + 一组工具配置。
- **Review criteria**：每个 Skill 带自检清单，worker submit 前自己过一遍，
  减少你审阅负担。
- **Workflow / Skill 对象一等化**：roadmap 里的第 6/8 项。
- **Wiki 学习闭环**：approved 的任务结果会被建议回填到相关 Skill，
  让 Agent 下次更聪明。

### 三期：可分发

**定义**：让别人也能装一份。

- **Obsidian 插件**：把 Personal Wiki 的拓扑图 / frontmatter / MOC
  在 Obsidian 内可视化，读者不必装我们的前端也能看。
- **SaaS 或本地安装包**：docker-compose / 一键安装脚本 / 云版本。
- **助理团队模板**：打包成可下载的 "Hermes 助理团队"，带默认 prompt、
  默认 Skill 包、默认 Wiki 目录。

---

## 5. Wiki 目录结构规范 Wiki Organization

Wiki 现在的问题：半人半 Agent 写，没有"谁写、写去哪"的规则，所以乱。

### 目标结构

```
vault/
├── 00_meta/                  索引、MOC、标签说明、目录规范
│   ├── index.md              总索引（自动生成）
│   ├── tags.md               标签含义和使用说明
│   └── structure.md          目录规范（这份文档的简版）
├── 10_sources/               原始输入（不动，只归档）
│   ├── articles/             文章、网页抓取
│   ├── transcripts/          语音、会议、DeepTalk 导出
│   └── screenshots/          截图
├── 20_atoms/                 原子笔记：一个概念一篇，可反复引用
│   └── 东京-交通.md          比如：去东京怎么坐地铁
│   └── 签证-日本.md
├── 30_projects/              项目档案：一个项目一个文件夹
│   └── 2026-05-东京行/
│       ├── README.md         项目概览 + 状态 + next action
│       ├── 行程.md           ← Agent 产出
│       ├── 住宿候选.md       ← Agent 产出
│       └── 经验复盘.md       ← 人或 Agent 事后补
├── 40_journals/              日期日志：今天发生了啥（Agent 写也算）
│   └── 2026-05-11.md         ← 主助理每日总结写这里
├── 50_skills/                可复用作业手册（二期用）
│   └── 旅游规划.md
│   └── OCR 评估.md
└── 90_archive/               归档：过期、弃用、实验性
```

### 每篇笔记必带 frontmatter

```yaml
---
title: 东京交通
type: atom                 # atom | project | journal | skill | source
created_by: hermes:worker  # user | hermes:intake | hermes:dispatcher | hermes:worker
agent_id: worker-001       # 具体 Agent 实例（可选）
task_id: task_abc123       # 关联 Personal OS 任务（Agent 产出时必填）
project: 2026-05-东京行    # 关联项目（可选）
source_type: agent-output  # user-note | article | transcript | agent-output
tags: [travel, tokyo, transit]
created_at: 2026-05-11T10:30:00+08:00
last_reviewed: 2026-05-11  # 上次人工审阅（可选）
---
```

**意义**：

- `tag:agent-output` 一搜，就知道 Hermes 在 Wiki 里动过哪里
- `task_id` 反查能回到 Personal OS 看完整执行链路
- `project` 给拓扑图分组
- `last_reviewed` 显示哪些是"很久没人看过的老知识"（可能过期）

### 老数据怎么搬

现有 vault 有：
- `10_sources/` ✅ 已有，保留
- `20_notes/` → 分两类：概念性的进 `20_atoms/`，项目性的进 `30_projects/`
- `90_archive/` ✅ 保留
- `Personal OS Inbox/` → 按内容分：通知 log 进 `40_journals/`，知识进 `20_atoms/`
- `Personal Wiki Mirror/` → 先看内容再决定，可能直接归档

需要一个 migration 脚本（单独任务，可以人工审）。

---

## 6. 留痕哲学 Why Every Action Leaves a Trace

你反复强调的一点："Hermes 干的事都要能回头看"。

这不只是 feature，是这个产品的根本价值主张。所以在 Personal OS 和
Wiki 层面，我们明确如下规则：

1. **任何 Agent submit 一个任务，必须同时产生**：
   - Personal OS 的 TaskRun + ActionLog（活的状态）
   - Wiki 里至少一篇 summary note（长期记忆，带 frontmatter 归属）
2. **碎碎念 bot 每次入库，也必须产生**：
   - Personal OS 的 InboxItem（原文留底）
   - 如果是知识性内容，Wiki 里的 source note
3. **所有 Clarification 及用户回答，记录**：
   - Personal OS ActivityLog
   - Telegram 消息 ID（可追溯到聊天记录）
4. **主助理的每日规划，落地**：
   - Personal OS DailyPlan snapshot
   - Wiki `40_journals/<date>.md` 里附一段 "今日 Agent 建议"

这些规则写进一期的实现里。做完一期，你就有一个**可以回头审计任何一天、
任何一个 Agent 动作**的系统。

---

## 7. Agent 可靠性原则 How We Cope with Flaky Agents

Hermes 会翻车——漏字段、忘 heartbeat、写出"整理 Wiki"这种废话任务、
该问用户的时候硬猜。这是事实，不是 bug。**不能靠"把 Agent 教聪明"
来解决，要靠工程兜底**。

四条原则贯穿一期和二期实现：

### 原则 1：Agent 做选择题，不做填空题

服务端在推给 Agent 之前先用规则+模板把原材料切成候选，Agent 只负责
"接受 / 修改 / 拒绝"。Agent 能选错，但不会凭空乱造。

落地：一期加固阶段，`/api/intake` 对原文先跑一遍规则分类 + 模板生成，
候选对象塞给 Agent 让它选。

### 原则 2：服务端验收，不信 Agent 一面之词

Agent 说"任务完成了"不算数。submit 时 Personal OS 检查：

- `nextAction` 是不是动词开头？
- `definitionOfDone` 是不是可验证的？
- Wiki note 有没有必填 frontmatter？
- `artifactUrls` 能不能访问？

不合格直接退回，Agent 重做。

落地：MVP 只做最硬三条（nextAction 非空、frontmatter 必填、agent_id 必填）；
加固期补完整质量门禁。

### 原则 3：每一步都是原子、可重试

Agent 中途崩 / lease 过期 / 网络断——Personal OS 能在 Agent 重连时从上一个
成功 step 接着跑。靠 TaskRun + ActionLog 的幂等性。这个已经有了，一期
加固期补"重连续跑"策略。

### 原则 4：模板化而不是开放式

一期不让 Agent 自由发挥任务类型。只支持固定几种"任务模板"：

- 旅行规划（固定 5 步）
- 链接整理（固定 3 步）
- 日常碎碎念（固定 2 步）

Agent 只在"这条输入匹配哪个模板"这一个节点做判断。这是它最不容易翻车的
决策类型。二期 Skill 包会把这些模板升级为可复用的 Skill 对象。

---

## 8. Token 消耗哲学 Token Budget Philosophy

先分清楚哪些动作烧钱、哪些不烧：

| 动作 | 烧不烧 token | 说明 |
|---|---|---|
| Personal OS 推 webhook 给 Hermes | ❌ | HTTP 请求而已 |
| Worker polling `/api/agent-inbox` | ❌ | HTTP 请求而已 |
| Heartbeat | ❌ | HTTP 请求而已 |
| **Agent 被唤醒后调 LLM 做决策** | ✅ **烧** | 主要成本在这 |
| **Agent 读 context 包并"想"** | ✅ **烧** | Wiki candidates 拼进 prompt |
| **Worker 执行时每步喂给 LLM 判断** | ✅ **烧** | 多步任务成本叠加 |

真正的问题不是"推送频繁"，是**"每次推送是否都要叫 LLM"**。

五条节流策略贯穿一期和二期：

### 策略 1：事件驱动 ≠ LLM 驱动

Personal OS 在推送前先做规则过滤，能用 if-else 解决的就不叫 Agent：

| 事件 | 规则处理 | LLM 处理 |
|---|---|---|
| 新任务，主助理已忙 | 入队 | 不用 |
| 新任务 nextAction 已明确 | 直接 worker claim | 不用 |
| 碎碎念"买菜"一句话 | 规则识别为 idea | 不用 |
| 碎碎念含日期 + 地点 + 动词 | 叫主助理 | 用一次 |
| Clarification 用户点按钮 | 规则写回 | 不用 |

### 策略 2：分层用模型

一个 Agent 不等于一个模型。建议：

| 场景 | 建议模型 |
|---|---|
| 碎碎念分类 | 小模型（GPT-4o-mini / Claude Haiku / 本地小模型） |
| 主助理日常调度 | GPT-4o-mini |
| 旅行规划、长文生成 | GPT-4o / Claude Sonnet |
| 复杂推理 / 纠错 | 只在需要时升级到 Opus / GPT-5 |

Prompt 里写死什么场景用什么模型，Hermes 不要自己乱升级。

落地：AgentProfile 上新增 `defaultModel`、`escalationModel` 两个字段。

### 策略 3：Context 懒加载

`/api/agent/context` 默认只返回摘要：

- Wiki 候选：title + 一段概要（200 字以内），不返回全文
- Agent 决定要深读某篇，再单独 fetch
- 主助理调度时**不需要** Wiki 候选，只要任务列表
- 只有 worker 真要动手时，才把相关 Wiki 全文喂进去

这一条能把平均 context 从 5k token 砍到 1k 以下。

落地：`GET /api/agent/context?expand=wiki_full` 才给全文，默认不给。

### 策略 4：缓存 & 复用

- 项目状态 packet 24h 内缓存
- DailyPlan snapshot 一天内不重算
- Skill 定义（二期）内嵌 prompt 模板，不每次 fetch

### 策略 5：降频 + 批量

- 主助理**不要每事件都唤醒**。新事件入队，5~10 分钟批处理一次；
  标记 `urgent` 才破例
- Worker 被 webhook 推醒即时响应；没推醒按 5~10 分钟兜底轮询
- **碎碎念入库 Agent 侧完全不用 LLM**（规则就够），OS 侧必要时才调

### 成本护栏

大任务（旅行规划、长文生成）单次消耗大，不是频繁问题。护栏：

```
主助理：要我规划东京行程吗？预计耗时 2 分钟，消耗约 $0.05 token。
        [规划] [只排工作] [不管]
```

给用户预期，也给系统一个不失控的护栏。

落地：TaskRun 上记录 `estimatedCostUsd`，超过阈值先走 Clarification
问用户。

### 粗估单日成本

（按 GPT-4o-mini $0.15/1M in, $0.60/1M out 估算）

| 场景 | 每天次数 | 每次 token | 每天成本 |
|---|---|---|---|
| 碎碎念入库（规则为主） | 20 次 | 0 LLM | $0 |
| 碎碎念需 LLM 分类 | 5 次 | 1k in + 500 out | $0.003 |
| 主助理日常调度 | 10 次 | 3k in + 1k out | $0.01 |
| Clarification 决策 | 3 次 | 2k in + 500 out | $0.002 |
| Worker 执行（中等） | 5 次 | 5k in + 2k out | $0.01 |
| Worker 执行（大，GPT-4o） | 1 次 | 10k in + 3k out | $0.04 |
| 每日规划 | 1 次 | 5k in + 1k out | $0.006 |
| **合计** | | | **约 $0.07/天** |

一个月两三美元。

---

## 9. 当前完成度 Current State (2026-05-11)

对照终局地图，当前状态：

| 模块 | 状态 | 备注 |
|---|---|---|
| Personal OS 数据骨架 | ✅ 基本齐 | Inbox/Task/Idea/Project/TaskRun/ActionLog |
| `/api/intake` 统一入口 | ✅ 可用 | 一次写两边 |
| Agent 任务执行协议 | ✅ 可用 | poll/claim/heartbeat/contribute/submit |
| `/api/agent/context` | ✅ 可用 | 带 Wiki 候选 |
| `/api/planner/today` `/api/reminders/today` | ✅ 可用 | 定时可叫 |
| Personal Wiki 基础（Markdown + 搜索 + tag + 图） | ✅ 可用 | 独立服务 |
| DailyPlan snapshot | ✅ 持久化 | UI 未展示 |
| AgentProfile 一等身份 | 🟡 半 | 表有但没当路由用 |
| 事件推送（OS → Agent） | ❌ 未做 | **一期核心** |
| Clarification 对象 | ❌ 未做 | **一期核心** |
| Telegram 按钮 callback | ❌ 未做 | **一期核心** |
| 用户答案回写 + 唤醒 | ❌ 未做 | **一期核心** |
| Wiki 目录重构 | ✅ 已完成（2026-05-13） | **一期核心** |
| Wiki 学习闭环（submit → note） | ✅ 已完成（2026-05-13） | **一期核心** |
| Workflow / Skill 对象 | ❌ 未做 | 二期 |
| Obsidian 插件 | ❌ 未做 | 三期 |
| 商用打包 | ❌ 未做 | 三期 |

**一句话**：地基齐了，血管没通电，知识库还在乱放。

---

## 10. 下一步 Next Step

基于本地图，一期进 spec。建议从以下两个 spec 切入（可以并行）：

- `hermes-multi-agent-wakeup`：通电（A + B 两部分）
- `wiki-vault-restructure`：Wiki 目录重构 + frontmatter 规范 + 迁移（C 部分）

两个 spec 都完成，一期成功标准（东京旅游场景）就能跑通。

具体每个 spec 的 requirements 和 design，走 `.kiro/specs/` 流程。

---

## 11. 这份文档什么时候更新

- 当你对产品形态有新判断时
- 当某一期完成后、进入下一期前
- 当出现新的限制（比如某个技术走不通、某个商用方向变了）时

不要改它来记录具体技术细节（那是 spec 的事）。
这份只记"产品层的认知"。
