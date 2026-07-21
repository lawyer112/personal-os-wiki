# B0 Memory Baseline 2026-07-21

Host: <PERSONAL_OS_BASE_URL>
Queries: 28
Latency P50/P95 ms: 51.55 / 101.3
Mean candidates: 4.5
Mean wiki evidence tokens: 486.2
Mean memoryItems: 6.96
Mean thin ratio: 0.0
Mean empty evidence ratio: 0.0
Mean auto/blank status: 0.893
Mean no concepts: 0.041
Mean title keyword hit rate: 0.041

## by category
- concept: {'nq': 6, 'mean_cand': 4.5, 'mean_tok': 507.0, 'mean_title_hit_rate': 0.0, 'p50_ms': 60.15, 'zero_result_n': 0}
- exact: {'nq': 5, 'mean_cand': 4.4, 'mean_tok': 442.0, 'mean_title_hit_rate': 0.08, 'p50_ms': 55.2, 'zero_result_n': 0}
- multi: {'nq': 4, 'mean_cand': 5.5, 'mean_tok': 556.0, 'mean_title_hit_rate': 0.0, 'p50_ms': 47.25, 'zero_result_n': 0}
- noise: {'nq': 2, 'mean_cand': 0.0, 'mean_tok': 0.0, 'mean_title_hit_rate': 0.0, 'p50_ms': 40.900000000000006, 'zero_result_n': 2}
- ops: {'nq': 4, 'mean_cand': 4.5, 'mean_tok': 312.0, 'mean_title_hit_rate': 0.04, 'p50_ms': 48.35, 'zero_result_n': 1}
- zh: {'nq': 7, 'mean_cand': 5.3, 'mean_tok': 699.0, 'mean_title_hit_rate': 0.09, 'p50_ms': 44.2, 'zero_result_n': 0}

## noise
- 今天天气怎么样 -> n=0 tok=0
- 完全不存在的专有名词XYZQWERTY999 -> n=0 tok=0

## top1 per query
- [exact] Hermes Agent | n=7 tok=590 mem=20 | top1=Hermes Agent | prev=[Hermes] [Agent] 定位 个人助理 / [agent] 调度层，连接 Personal OS、Personal Wiki 和外部输入。 关联服务器
- [exact] MCP | n=3 tok=235 mem=8 | top1=GitHub 知识雷达 2026-06-25 Personal OS Wiki 自驱候选 | prev=…FTS/vector/community/PPR/episodic traces；Agent lifecycle hooks / [MCP] integrat
- [exact] wechat-publish-template | n=6 tok=805 mem=6 | top1=AI Agent记忆系统设计手册：面向知识库管理员的提示词模板（跨Agent交接） | prev=…元记忆（版本哈希、时间戳、权限声明）。四步协议为：提取→压缩→封装→验证。知识库管理员可直接调用以下提示词模板（Prompt [Template]）执行标准化
- [exact] MultiPost | n=2 tok=225 mem=2 | top1=X Likes 主题整理 - 公众号运营与内容矩阵 | prev=…公众号批量运营的关键不是搬运，而是选题 改写 分发闭环》 《文章如何一键转成公众号、视频号、小红书内容》 《[MultiPost] 是否适合接入个人内容矩阵？
- [exact] Personal OS | n=4 tok=354 mem=13 | top1=Personal OS Agent 写入凭据交接说明 | prev=[Personal] [OS] Agent 写入凭据交接说明 结论 [Personal] [OS] 的写入口已经通，问题不在服务端接口，而在调用方必须带写 to
- [zh] 公众号 | n=5 tok=726 mem=12 | top1=AI工具落地顾问B端销售朋友圈种草标题库 | prev=…第一”“根治”等《广告法》禁用词；AI效果数据需标注“基于XX行业试点样本，实际效果因企业数字化基础而异”。 平台规则 ：微信朋友圈禁止直接外链跳转至第三方落
- [zh] 内容矩阵 | n=5 tok=719 mem=5 | top1=X Likes 主题整理 - 公众号运营与内容矩阵 | prev=X Likes 主题整理 公众号运营与内容矩阵 核心判断 现有 X Likes Digest 已经把公众号运营、[内容矩阵]、文章转视频和多平台分发放在同一条内
- [zh] 文章转视频 | n=5 tok=477 mem=6 | top1=X Likes 主题整理 - 文章转视频与短视频 | prev=…内容矩阵初稿：公众号运营 + [文章转视频] + X 内容雷达 摘要：来自现有 X Likes Digest / Wiki 来源页的聚合入口。 可用法：进入该
- [zh] 小红书 | n=6 tok=949 mem=6 | top1=AI工具落地顾问B端短视频引流话术库与脚本模板 | prev=…适用场景 短视频平台（抖音、视频号、[小红书]）发布获客内容，受众为企业主/部门负责人/IT决策者。 销售/顾问在直播、拜访、社群中快速建立专业信任。 市场部
- [zh] 视频号 | n=6 tok=1071 mem=6 | top1=AI工具落地顾问B端短视频引流话术库与脚本模板 | prev=…适用场景 短视频平台（抖音、[视频号]、小红书）发布获客内容，受众为企业主/部门负责人/IT决策者。 销售/顾问在直播、拜访、社群中快速建立专业信任。 市场部
- [zh] 变现 | n=5 tok=616 mem=5 | top1=AI工具落地顾问个人IP冷启动获客落地页结构 | prev=…加入AI落地陪跑营（早鸟价99元，含3次复盘） 转化验收清单 [ ] 首屏是否3秒内传达“你是谁+解决什么问题+能得到什么”？ [ ] 是否避免使用“全网最强
- [zh] Skill | n=5 tok=336 mem=13 | top1=Hermes skills 跨 profile 分发建议 2026-06-28 | prev=Hermes skills 跨 profile 分发建议 2026 06 28 总原则 已确认 config assistant 下约 999 个 [SKILL
- [concept] 长期记忆 | n=4 tok=659 mem=4 | top1=AI Agent记忆系统定时巡检质量门清单 | prev=AI Agent记忆系统定时巡检质量门清单 AI Agent记忆系统定时巡检质量门清单 一句话结论 本手册为知识库管理员提供一套可执行的定时巡检质量门清单，确保
- [concept] 知识库检索 | n=5 tok=642 mem=5 | top1=AI工具落地顾问销售页文案资产包：成交前跟进案例改写模板 | prev=…明确AI工具介入节点、配置方式与人工协同边界。 改写公式：[工具/模块] + [部署动作] + [关键参数/阈值/人工复核点] 示例：部署“[知识库检索]+L
- [concept] Agent 任务认领 | n=7 tok=633 mem=7 | top1=知识付费社群首单转化话术库：AI工具顾问案例改写与复购召回模板 | prev=…我会教你用 ChatGPT 写爆款文案”），但用户买单的动力来自“我有个任务一直没完成，现在有人说能用 AI 帮我搞定”。 操作模板： 在免费群或体验课中，用
- [concept] 如何部署 Personal Wiki | n=4 tok=352 mem=4 | top1=Agent 使用手册：赚钱导向个人知识库 | prev=Agent 使用手册：赚钱导向个人知识库 定位 [Personal] OS 不是大脑，也不是判断者。它只是保存任务、项目、Inbox、活动和状态的程序。 [Pe
- [concept] 图谱关系 | n=1 tok=127 mem=1 | top1=Personal OS 记忆产品改造：外部项目吸收方案与提示词影响 | prev=personal os 记忆产品改造：外部项目吸收方案与提示词影响 判断 外部项目不应该直接复制代码，而应该拆成可吸收的产品能力：分层记忆、混合召回、可观测检索
- [concept] RAG 记忆 | n=6 tok=627 mem=7 | top1=GitHub 知识雷达 2026-06-25 Personal OS Wiki 自驱候选 | prev=…open source knowledge graph builder, [RAG] knowledge base, and agent memory sto
- [ops] WIKI_READ_TOKEN | n=0 tok=0 mem=0 | top1= | prev=
- [ops] 3422 | n=5 tok=301 mem=7 | top1=Personal Wiki 智能体访问说明 | prev=…http://127.0.0.1:[3422]/api/graph loopback 读取不需要 token，方便本机 Hermes / Codex / 维护
- [ops] docker compose | n=7 tok=517 mem=9 | top1=Docker Compose 生产更新守则：面向独立开发者的故障树（接口回归） | prev=Docker [Compose] 生产更新守则：面向独立开发者的故障树（接口回归） 一句话结论 独立开发者在生产环境使用 Docker [Compose] 更新
- [ops] FTS chunk | n=6 tok=429 mem=7 | top1=GitHub 知识雷达 2026-06-25 Personal OS Wiki 自驱候选 | prev=…context pack / task ledger；Hot / warm / cold memory tiering；Graph recall: [FTS]
- [noise] 今天天气怎么样 | n=0 tok=0 mem=0 | top1= | prev=
- [noise] 完全不存在的专有名词XYZQWERTY999 | n=0 tok=0 mem=0 | top1= | prev=
- [multi] Personal OS 和 Wiki 的边界是什么 | n=4 tok=316 mem=4 | top1=Agent 使用手册：赚钱导向个人知识库 | prev=Agent 使用手册：赚钱导向个人知识库 定位 [Personal] [OS] 不是大脑，也不是判断者。它只是保存任务、项目、Inbox、活动和状态的程序。 [
- [multi] X likes 知识流水线 | n=7 tok=708 mem=16 | top1=X Likes 2026-06-30：10 条高价值内容拆解 | prev=X [Likes] 2026 06 30：10 条高价值内容拆解 title: X [Likes] 2026 06 30：10 条高价值内容拆解 type: s
- [multi] Obsidian 导入导出 | n=5 tok=502 mem=7 | top1=GitHub 知识雷达 2026-06-25 Personal OS Wiki 自驱候选 | prev=…An [Obsidian] alternative for personal knowledge management, AI second brain, a
- [multi] 任务复核 review | n=6 tok=699 mem=15 | top1=任务验收标准写法库 | prev=…官方定义与案例 GB/T 8567《计算机软件文档编制规范》现行版本验收测试要求 主流外包平台官方推荐验收条款模板 知名开源项目（Kubernetes/Rea