# 数据安全

Personal OS + Personal Wiki 是本地优先，但“本地优先”不等于自动安全。这份文档说明哪些数据存在、存在哪里、哪些绝不能进入公开 Git 历史。

## 数据分类

| 数据 | 存储位置 | 能否进公开 Git | 说明 |
| --- | --- | --- | --- |
| 应用源码 | 仓库 | 可以 | 代码、测试、文档、迁移、模板。 |
| 虚构 demo 数据 | seed 文件 | 可以 | 必须明显是虚构内容。 |
| Inbox 原始输入 | PostgreSQL | 不可以 | 原文可能包含私人意图和业务信息。 |
| 任务和项目状态 | PostgreSQL | 不可以 | 会暴露优先级、计划和未完成工作。 |
| Agent 运行记录 | PostgreSQL | 不可以 | 可能暴露推理摘要和决策轨迹。 |
| Wiki 笔记 | Markdown vault | 默认不可以 | 只发布脱敏后的示例笔记。 |
| token 和凭据 | `.env` / secret store | 永远不可以 | 仓库只放 `.env.example` 占位值。 |
| 服务器台账 | 私有 vault/docs | 永远不可以 | 内网 IP、端口、路径、业务映射都敏感。 |
| 日志和截图 | 运行时文件 | 不可以 | 可能包含 URL、token、路径或私密文本。 |

## 运行时数据

Personal OS 把执行状态存在 PostgreSQL：

- Inbox
- Ideas
- Tasks
- Projects
- Notes
- Agent runs
- 任务认领
- 贡献记录
- 复核记录
- 活动事件
- 通知 payload

Personal Wiki 把长期知识存在 Markdown vault 和 JSON 索引：

- Markdown 笔记
- 标签和概念
- 搜索索引
- 图谱数据
- 归档笔记

公开仓库只应该包含软件引擎，不应该包含真实运行数据。

## Token 边界

读写 token 应该分开：

- `PERSONAL_OS_API_TOKEN`：Personal OS 写接口。
- `PERSONAL_OS_READ_TOKEN`：Personal OS 读接口。
- `WIKI_API_TOKEN`：Wiki 写接口。
- `WIKI_READ_TOKEN`：Wiki 读接口和浏览器 handoff。

不要把写 token 回退成读 token 放进浏览器 cookie。不要把 token 放进 URL。不要把真实 token 粘到 issue、截图、示例或 Agent prompt 里。

## 备份

运行时备份要和源码分开：

- Personal OS 用 PostgreSQL dump。
- Personal Wiki 备份 Markdown vault。
- `.env` 和部署密钥放密码管理器或 secret manager。

真实备份不要进公开仓库。

## 公开发布前检查

从私有工作树发布或开 PR 前：

1. 确认 `.env`、vault、日志、截图、dump、构建产物都被忽略。
2. 跑 CI secret/private-data scan。
3. 搜索内网网段、真实域名、用户名和部署路径。
4. 人工复核 demo 数据。
5. 如果历史提交曾包含私有产物，用干净历史发布。

完整清单见 [`../OPEN_SOURCE_RELEASE.md`](../OPEN_SOURCE_RELEASE.md)。

## 当前限制

- 应用本身不负责加密运行时数据；需要依赖磁盘、数据库和主机安全。
- 当前版本不是多租户 SaaS。
- 内置鉴权是 token 模型；公开部署应放在有鉴权的反向代理后面。
- Agent 自主执行受任务协议约束，但坏 Agent 仍可能提交坏产物，所以复核很重要。
- 如果 token 泄露，删除 Git 历史不够，必须轮换 token。
