# 记忆召回改造路线图（持续目标）

> 跨会话唯一真相。改检索 / agent context 前先读本文，改完更新「当前状态」。

## 持续工作口令

```text
目标：Personal OS 记忆召回 = 低 token + 高意图准确 + 可追溯证据。
入口：GET <PERSONAL_OS_BASE_URL>/api/agent/context?q=
验收：scripts/eval_b0_memory_baseline.py，对比 B0 基线。
禁止：全文塞上下文；sticky nextAction 污染纯查询。
```

## 运行与基线

| 项 | 值 |
| --- | --- |
| Personal OS | `<PERSONAL_OS_BASE_URL>`（缺省 `http://localhost:3100`） |
| Personal Wiki | `<PERSONAL_WIKI_URL>`（缺省 `http://localhost:3422`） |
| B0 评测脚本 | [`scripts/eval_b0_memory_baseline.py`](../scripts/eval_b0_memory_baseline.py) |
| B0 结果 | [`eval_b0_memory_baseline_2026-07-21.md`](./eval_b0_memory_baseline_2026-07-21.md) |
| 研究文档 | [`AGENT_MEMORY_RETRIEVAL_RESEARCH_2026-07-19.zh-CN.md`](./AGENT_MEMORY_RETRIEVAL_RESEARCH_2026-07-19.zh-CN.md) |

### B0 摘要（2026-07-21，线上环境）

- 延迟 P50/P95：~52ms / ~101ms
- 平均候选 4.5，Wiki 证据 token 均值 ~486
- 噪声查询正确 empty
- 问题：错 rank、hot 空、sticky nextAction、status 几乎全 auto/blank

## 源码对齐说明

| 树 | 说明 |
| --- | --- |
| 本仓库 `personal-os-app` | 工作区（v0.2.0） |
| `个人知识库wiki-canonical-online` | memory + FTS 同源树；已同步关键文件 |

已同步：

- OS：`agent-context.ts`、`query-intent.ts`、`memory_backend_contract.ts`、`swarmvault_context.ts`、`wiki-client.ts`、context route
- Wiki：`server.py`、`retrieval.py`、`wiki_time.py`、相关 tests

## 阶段与验收

### Phase 0 — 对齐与锚点

- [x] 定位 memory 源码并拉回本仓库
- [x] 本路线图 + Cursor / AGENTS 锚点
- [ ] 部署后字段与本地一致（部署后勾选）

### Phase P0 — 减污染 / 修分层

- [x] query 模式 `nextAction` 不注入无关全局 P0 / 失败 run
- [x] Wiki 高分证据可进入 `tiers.hot`（与 `memoryTierForScore` ≥45 对齐）
- [x] episodes 再收紧（agent_run/inbox 必须命中 query 关键词）
- [ ] 部署后重跑 28 题：noise 的 nextAction 为空；有高分 wiki 时 hot 非空

### Phase P1 — 意图路由 + 排序

- [x] intent：`deploy_sop | review_protocol | concept | ops | fact | noise | general`
- [x] 分字段加权 + 意图奖惩 + FTS score 融合
- [x] Wiki FTS chunk 代码同步进本仓库（线上已有 `/api/search/chunks`）
- [ ] 部署后验证错 rank 样例 top1（部署 / 任务复核）

### Phase P2 — 证据块与扩展

- [x] section/chunk 证据卡默认返回（`evidence.cards`）
- [x] expand neighbor|section|document：显式指令 + how-to/SOP 意图充足性；卡上带 expand handles
- [x] 去重硬顶 3–8 卡 + ~1500 token 预算
- [ ] 部署后验证平均证据 token / SOP 可答性

### Phase P3 — 生命周期与安全

- [ ] status current/superseded 清洗
- [ ] 生产强制 read token
- [ ] 可选 Hindsight 对照

## 模块职责

```text
Wiki          = 不可变原文 + FTS/chunk + expand API
OS context    = 意图路由 + 融合排序 + token 预算 + tiers + evidence.cards
评测脚本      = 只读观测
Agent Prompt  = 优先消费 evidence.cards（EvidencePack），不自己全文扫描
```

## 当前状态

- **日期**：2026-07-21
- **已完成**：
  - Phase0：memory 层 + 路线图/规则
  - P0：sticky nextAction 剥离；hot 对齐；episodes 过滤
  - P1：`src/lib/query-intent.ts`；scoreNote/memory 意图加权；Wiki FTS 源码对齐
  - P2：`evidence.cards`（path 去重、硬顶 8、token 预算）；意图 how-to expand；memory wiki 元数据带 chunk/heading/expand
  - 单测：agent-context + query-intent **38/38 通过**
- **未竟**：部署到线上；线上 B0 重测；P3 生命周期/鉴权
- **下次第一刀**：部署 personal-os-app（必要时 wiki）到 6.37 → `python scripts/eval_b0_memory_baseline.py` 写对比行

## 会话节奏

1. 读本文「当前状态」
2. 只做一个可验收切片
3. 更新本段「当前状态」
4. 部署后跑 `python scripts/eval_b0_memory_baseline.py` 写新基线行