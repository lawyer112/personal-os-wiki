# Agent 工作约定

## 记忆召回（持续目标）

修改 Personal OS 检索、`/api/agent/context`、Wiki 搜索 / chunk / expand 时：

1. **先读** [`docs/MEMORY_RECALL_ROADMAP.zh-CN.md`](docs/MEMORY_RECALL_ROADMAP.zh-CN.md)
2. **对照** B0 基线：`docs/eval_b0_memory_baseline_2026-07-21.md`
3. **验收**（能连 6.37 时）：`python scripts/eval_b0_memory_baseline.py`
4. **禁止**：用全文塞 Agent 上下文；在纯 `?q=` 查询注入 sticky 全局 `nextAction`
5. 改完更新 roadmap 的「当前状态 / 未竟项 / 下次第一刀」

口令：

```text
目标：Personal OS 记忆召回 = 低 token + 高意图准确 + 可追溯证据。
入口：GET <PERSONAL_OS_BASE_URL>/api/agent/context?q=
```

## 服务地址（本环境）

- Personal OS / Personal Wiki 地址见各自 `.env` 或部署文档。
- 评测脚本默认读 `PERSONAL_OS_BASE_URL` 环境变量（缺省 `http://localhost:3100`）。

不要用 `localhost` 冒充生产数据，除非用户明确指定。