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

## 公开维护范围

这份公开手册只记录如何安全维护仓库，不发布内部产品优先级、私人操作计划、
客户相关计划或真实推进顺序。

公开状态从公开产物里读取：

- 已发布能力看 `CHANGELOG.md`；
- 支持的安装路径看 `README.md` 和 `docs/GETTING_STARTED.zh-CN.md`；
- 安全与发布边界看 `docs/DATA_SAFETY.zh-CN.md` 和 `OPEN_SOURCE_RELEASE.md`；
- 需要主动公开的当前工作放在 GitHub issues。

私人规划应该写进私人维护日志，不写进这个公开仓库。

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
