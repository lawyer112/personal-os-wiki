# 维护手册

这份文档是 Personal OS + Personal Wiki 的公开安全交接手册，给维护者和
Agent 使用。

它不是私人运维日志。不要把真实服务器地址、token、客户数据、私人 Wiki
内容、截图、本机用户名或个人任务历史写进这个公开仓库。

## 产品总纲

Personal OS + Personal Wiki 不应该变成另一个通用知识库、RAG 应用、任务看板
或自主 Agent runtime。

稳定边界是：

```text
Personal OS   = 任务真相、项目状态、认领、租约、复核、提醒
Personal Wiki = 长期知识、证据、决策、工作流笔记
执行器          = Hermes、OpenClaw、Codex、Claude Code、定时 worker
通知适配器       = Telegram、飞书、Apple Reminders、邮件、桌面通知
```

这个产品要回答的是：

```text
下一步应该推进什么？
谁或哪个 Agent 负责？
什么证据证明它推进了？
谁复核过？
这次结果改变了哪些知识？
```

如果一个功能只是多存文本，它应该放到 Wiki 层或外部记忆工具里。如果一个
功能能帮助 Agent 认领、执行、提交证据或接受复核，它才属于 Personal OS 的
执行闭环。

## 公开记录与私人记录边界

公开仓库可以记录：

- 不暴露个人信息的产品方向；
- 源码、测试、文档、虚构 demo 数据和发布包；
- 任何用户都能复用的通用操作流程；
- 公开安全的 GitHub issue；
- API 契约和 Agent 协议文档。

私人 Personal Wiki 或私人仓库记录：

- 真实部署域名、LAN IP、端口、用户名、路径和服务名；
- 真实 token、API key、cookie、SSH 信息和凭据位置；
- 个人任务历史、私人项目状态、客户笔记和服务器台账；
- 可能含私密信息的截图或日志；
- 具体实例的回滚记录。

私人维护笔记可以使用本手册结构，但写真实环境信息。不要把私人笔记复制回
GitHub。

## 当前公开状态

最后检查日期：2026-05-02。

已经落地：

- 根目录 Docker demo 和平台辅助脚本。
- Personal OS Next.js 应用：Inbox、Ideas、Projects、Tasks、Notes、Today、
  AgentRun、任务认领、心跳、贡献、产物、提交、复核、活动日志和通知 payload。
- Personal Wiki Python 服务：Markdown ingest、笔记页、搜索、标签、概念、
  图谱和读写 token 边界。
- Agent 协议文档：poll、claim、context、heartbeat、contribute、submit、
  review。
- 虚构 seed 数据已经能展示任务认领、提交证据和复核通过。
- CI 覆盖测试、依赖审计、类型检查、lint、应用构建、Docker 构建、Wiki 编译、
  图谱测试、发布包 smoke test 和私密数据扫描。
- `.zip`、`.tar.gz`、`SHA256SUMS.txt` 版本包脚本。

仍然部分实现或主要停留在文档：

- Hermes、OpenClaw、Codex、Claude Code 的真实外部执行器适配。
- 内置 demo worker，完整跑通 claim -> evidence -> review。
- MCP server。
- 基于 Agent 能力的任务路由。
- 一等公民的 TaskRun 和结构化 AgentActionLog。
- 专门面向证据和 definition-of-done 的 Review Dashboard。
- 对象化 Wiki 重建、Wiki lint 和知识缺口任务生成。
- Apple Reminders、飞书、Telegram、邮件等真实投递 worker。

## 战略 Backlog

除非有安全修复阻塞发布，否则按这个顺序推进。

| 优先级 | 工作 | 原因 |
| --- | --- | --- |
| P0 | 内置 demo agent 或 smoke worker | 证明产品不是只有任务板概念。 |
| P0 | Review Dashboard | 把最强差异点直接展示出来。 |
| P1 | 给任务增加 `executionMode` | 区分人工任务、Agent 建议、Agent 可直接执行、必须审批。 |
| P1 | `AgentProfile` 能力注册 | 防止 Agent 认领自己不能安全执行的任务。 |
| P1 | `TaskRun` 和 `AgentActionLog` | 让执行过程成为可审计账本，而不是最终摘要。 |
| P1 | MCP server | 让外部 Agent 和 IDE 工具通过标准接口读取任务和 Wiki 上下文。 |
| P2 | LLM Wiki 兼容说明 | 借鉴 LLM Wiki 模式，但不把自己定位成纯 Wiki。 |
| P2 | 对象化知识重建 | 让 Wiki 笔记成为 Agent 可维护的项目、工作流、证据和决策对象。 |
| P2 | 通知投递适配器 | 通知不做任务真相源，但要把每天该做什么推到用户面前。 |
| P3 | 移动端 capture 和浏览器剪藏优化 | 执行闭环跑顺以后再扩大输入面。 |

不要让通用 PKM 功能抢走执行闭环优先级。

## Agent 接手流程

任何 Agent 接手这个仓库时，先按这个流程走：

1. 检查仓库状态。

   ```bash
   git status --short
   git log -1 --oneline
   gh issue list --state open --limit 20
   gh run list --branch main --limit 5
   ```

2. 读取核心交接文档：

   - `README.md`
   - `docs/MAINTENANCE_MANUAL.zh-CN.md`
   - `docs/ROADMAP.md`
   - `docs/HUMAN_AGENT_COLLABORATION_ROADMAP.md`
   - `docs/AGENT_GUIDE.md`
   - `docs/DATA_SAFETY.md`

3. 选择一个边界清楚的改进。优先选择已有 GitHub issue。如果没有 issue，
   在改动前或改动中创建/记录一个公开安全的 issue。

4. 做一个完整、可评审的变更单元。不要混入无关工作。

5. 如果行为、流程或对外描述改变，更新对应文档，尤其是：

   - `README.md`
   - `docs/README.md`
   - `docs/MAINTENANCE_MANUAL.zh-CN.md`
   - `docs/ROADMAP.md`
   - `CHANGELOG.md`

6. 推送前本地验证。

7. 推送后等待 CI。不要在 CI 结果未知时声称完成；如果 CI 失败，要说明失败原因。

## 验证清单

根据改动范围运行对应检查。

Personal OS：

```bash
cd personal-os-app
npm test
npm run lint
npx tsc --noEmit
DATABASE_URL="postgresql://personal_os:replace-with-a-long-random-database-password@localhost:54329/personal_os?schema=public" npm run build
```

Personal Wiki：

```bash
python -m py_compile personal-wiki/api/server.py
python -m unittest discover personal-wiki/tests
```

仓库打包和卫生检查：

```powershell
git diff --check
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-release.ps1
```

GitHub：

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
```

如果跳过某项检查，最终交接里必须说明原因。

## 安全与泄露检查

每次提交或打包前，确认 diff 不包含：

- `.env` 文件或凭据导出；
- 真实 token、API key、cookie、SSH key 或密码；
- 真实私有域名、LAN IP、端口、用户名或文件路径；
- 真实 inbox 消息、提醒事项、客户数据、私人项目笔记或服务器台账；
- `.next`、`node_modules`、已填充 vault、日志、pid、发布包、含私密信息截图等
  运行产物。

公开截图、GIF、文档、测试和 demo 一律使用虚构数据。

## 私人维护日志模板

真实运维记录单独放在私人 Wiki。建议标题：

```text
Personal OS Wiki - 私人维护日志
```

私人 Wiki 中可以用这个结构：

```markdown
# Personal OS Wiki - 私人维护日志

## 当前部署

- 主机：
- 服务：
- 端口：
- 运行路径：
- token 位置：
- 备份位置：

## 最新操作

- 日期：
- Agent / 操作者：
- 目标：
- 命令或动作：
- 改动文件 / 服务：
- 验证：
- 回滚方案：
- 后续任务：

## 私有待办

- [ ] 任务：
  - 为什么重要：
  - 负责人：
  - 需要什么证据：
```

私人笔记里也不要粘贴真实密钥，只记录密钥存放位置，不记录密钥值。

## 每轮结束交接格式

每个 Agent 结束工作时，按这个格式汇报：

```text
Changed:
- ...

Why:
- ...

Verification:
- ...

GitHub:
- commit:
- issue:
- CI:

Risks:
- ...

Next:
- ...
```

这样下一位 Agent 不需要依赖聊天记录，也能继续推进。
