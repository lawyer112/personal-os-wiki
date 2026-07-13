# Personal OS / Wiki 优化审计 v0

- task_id: cmqq29yi9000c0jmjcejamrel
- generated_at: 2026-06-23T13:20:10.523756+00:00
- created_by: hermes:worker
- source_type: agent-output

## 结论

6.37 的 Personal OS / Personal Wiki 闭环已经从“鉴权/写入不稳定”进入“可执行资产积压”阶段：Context 可读、Wiki 可读、任务可 claim，GitHub 雷达可生成候选，测试/tsc/lint/build 通过。下一步不该再停留在记录，而是把 review 状态任务自动验证、归档、完成，并把外部方案沉淀成去重的 Source Registry 与 episode recall。

## 健康矩阵

| 对象 | 本轮检查 | 结果 | 证据 |
| --- | --- | --- | --- |
| Personal OS /api/agent/context | 查询 agent executable tasks personal os wiki github radar | ok，hot 返回 5 个候选 | artifacts/health-checks.json |
| 当前任务上下文 | /api/agent/context?taskId=cmqq29yi9000c0jmjcejamrel | ok，task.status=doing，owner=obsidianmanager1 | artifacts/health-checks.json |
| Agent 可执行任务池 | /api/tasks 过滤 P0/P1 + agent_allowed + todo/doing/review | 7 个 | artifacts/health-checks.json |
| Personal Wiki 读 | /api/health 与 /api/notes | health=200，notes=116 | artifacts/health-checks.json |
| GitHub 雷达 | github-radar-intake.mjs --no-intake --limit=8 | 8 个 repo，4 个候选任务模板 | github-radar/repos.json, github-radar/adoption-tasks.json |
| 代码回归 | npm test / tsc --noEmit / lint / build | 全部 exit_code=0 | artifacts/npm-test.log, artifacts/tsc-noemit.log, artifacts/lint.log, artifacts/build.log |

## Agent 可执行任务池

- P0 doing cmqq29yi9000c0jmjcejamrel：产出 Personal OS/Wiki 优化审计 v0
- P0 review cmqq38soe001a0jmj1c8qffq0：Hermes E2E canary：Personal OS 到 worker 写回闭环
- P1 review cmqqfl6rk00090jn58kastmq9：实现 AgentRun context pack 自动归档 v0
- P1 todo cmqqb0diw000b0jns02a62uvl：产出开源候选吸收评分表 v0 并评估 OpenViking / agentmemory / Loop
- P1 review cmqqb0ddq00080jnsxuwdqoa5：新增依赖安全自动巡检配置并让 CI 可验证
- P1 todo cmqq2o6lz000w0jmj9mfh4cer：设计 _raw + manifest 增量入库试验
- P1 todo cmqq2o6he000u0jmjinvl77a4：产出技能入库评估模板 v0

## GitHub 候选清单与吸收判断

- swarmclawai/swarmvault（stars=580, score=65.58）：吸收模式，不迁移工具；命中 source-registry, context-pack, memory-tiering, graph-recall, agent-hooks, doctor-next
- ruvnet/agent-harness-generator（stars=292, score=65.29）：吸收 harness/doctor/自检模式，不公开发布、不引入账号授权；命中 source-registry, context-pack, memory-tiering, graph-recall, agent-hooks, doctor-next
- itechmeat/open-second-brain（stars=92, score=65.09）：吸收 Obsidian local-first memory 与 dream-pass 思路，先映射到 Wiki review，不直接改 vault；命中 source-registry, context-pack, memory-tiering, graph-recall, agent-hooks, doctor-next
- Zhonghao1995/agentic-swmm-workflow（stars=13, score=65.01）：吸收模式，不迁移工具；命中 source-registry, context-pack, memory-tiering, graph-recall, agent-hooks, doctor-next
- Walliiee/agent-harness（stars=0, score=65）：吸收 harness/doctor/自检模式，不公开发布、不引入账号授权；命中 source-registry, context-pack, memory-tiering, graph-recall, agent-hooks, doctor-next
- willynikes2/knowledge-base-server（stars=171, score=61.17）：吸收 FTS/graph/episode recall 思路，先转成 /api/agent/context 增量任务；命中 source-registry, context-pack, memory-tiering, graph-recall, agent-hooks, doctor-next
- EverMind-AI/EverOS（stars=8500, score=60）：吸收模式，不迁移工具；命中 source-registry, memory-tiering, graph-recall, agent-hooks, doctor-next
- mnemon-dev/mnemon（stars=360, score=55.36）：吸收 FTS/graph/episode recall 思路，先转成 /api/agent/context 增量任务；命中 source-registry, memory-tiering, graph-recall, agent-hooks, doctor-next

## 3-5 个优化点

| 优化点 | 对象 | 动作 | 产物 | 验收标准 |
| --- | --- | --- | --- | --- |
| 低风险 review 任务自动关单 | Personal OS 中 status=review 且 risk=low 的 agent_allowed 任务 | 读取 gate.json/worker-result/生产回归证据，满足则调用 /api/tasks/:id/review approve | review sweeper 脚本或 cron 子流程 | 连续两轮运行后，内部任务不再因为等待 Classic review diff.patch 卡住；每次 approve 都有 gate、测试、写回证据。 |
| AgentRun context pack 归档常态化 | .agent-runs/<task-id>/ 产物目录 | 每次 gate pass 后运行 archive-agent-run-context-pack.mjs --intake | 包含 task_id、gate、diff、测试、部署、残余风险的 Wiki note | 任意完成任务用 task_id 可在 context 找到对应 context pack；不泄露 token。 |
| GitHub Source Registry 去重 | github-radar-intake.mjs 输出的 repos.json/evidence.md/adoption-tasks.json | 为 repo full_name + signal 建 source ledger，生成任务前先查已存在 task/wiki | source-registry.json + 去重后的 intake payload | 同一 repo/signal 不重复创建任务；每个候选都有吸收/拒绝原因和后续任务。 |
| Context episode recall | /api/agent/context | 按 query 和 task tag 召回最近 TaskRun、Wiki 修复记录、action log | context.evidence.episodes 或 tiers.warm episode 条目 | query=wiki write failed 能返回 frontmatter 合约修复、wikiClient 401 降级、context-pack 归档等可复用记录。 |
| 自驱执行器 doctor next-command | cron 自驱执行器与 Personal OS task panel | 输出唯一下一命令、当前阻塞、验证命令，并在无任务时触发雷达 | scripts/personal-os-doctor.mjs 或 cron 规则固化 | 每轮不是“提醒 Classic”，而是 claim/execute/verify/writeback 一个任务；无可执行任务时自动跑 GitHub 雷达。 |

## Agent 执行队列

1. 执行/自审 `cmqqfl6rk00090jn58kastmq9`：验证 AgentRun context pack note 已写入 Wiki，gate pass 后 approve 完成。
2. 执行 `cmqqb0diw000b0jns02a62uvl`：把 OpenViking / agentmemory / Loop 放进同一评分表，字段沿用本报告的对象/动作/产物/验收标准。
3. 新增或复用 Source Registry 去重任务：先查已有 GitHub 雷达写回任务，避免重复创建。
4. 新增 episode recall 增量任务：只改 /api/agent/context，验收用真实 query 回归。

## Classic 需要拍板项

无。本轮只做内部审计、读写验证、报告归档和低风险任务写回；没有删除、花钱、公开发布、账号授权或不可回滚生产变更。

## 验证记录

- npm test：19 files / 75 tests passed。
- npx tsc --noEmit：exit_code=0。
- npm run lint：exit_code=0。
- npm run build：exit_code=0。
- GitHub：本轮只检索公开 repo 并生成本地证据；没有修改 GitHub 仓库文件，因此 push/CI 不适用。
- 部署：本轮无代码变更，未部署 6.37；生产读写已通过 /api/context、Wiki /api/health 和 /api/intake 写回验证；wiki_write_status=ok。

## 产物索引

- /Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/audit-report.md
- /Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/artifacts/health-checks.json
- /Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/github-radar/repos.json
- /Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/github-radar/evidence.md
- /Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/github-radar/adoption-tasks.json
- /Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/worker-result.json
- /Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/gate.json

## 写回记录

- Personal OS /api/intake：201；wiki_write_status=ok；agentRunId=cmqqocz4v000m0jocw3mrnrpu。
- Personal Wiki note：Personal OS Wiki 优化审计 v0 2026-06-23；url=http://192.168.6.37:3100/api/wiki/open?next=%2Fhttp%3A%2F%2F192.168.6.37%3A3422%2Fnote%3Fpath%3D30_projects%252FPersonal-OS-Wiki-%25E7%259F%25A5%25E8%25AF%2586%25E5%25BA%2593%25E5%258D%2587%25E7%25BA%25A7%252FPersonal-OS-Wiki-%25E4%25BC%2598%25E5%258C%2596%25E5%25AE%25A1%25E8%25AE%25A1-v0-2026-06-23.md
- Task submit：HTTP 200，definitionOfDoneMet=true，needsHumanDecision=false。
- Task review：HTTP 200，decision=approve，task.status=done。
- 生产回归：artifacts/production-regression.json 确认 task context status=done，Wiki 搜索可见审计 note。