# Tasks — wiki-vault-restructure

> **执行约定**（给 Codex `-go` 模式）
>
> - 任务按编号顺序执行；每条任务都列出**前置依赖**，前置未做完不要跑下一条。
> - 每条任务都列出**产物**、**验收标准**、**关联 AC**、**禁止扩展的边界**。
> - 每条任务的最后一步必须运行新增/修改的测试，必须全部通过才能勾选 `[x]`。
> - 文档引用：需求在 `requirements.md`，设计在 `design.md`。出现冲突以 design 为准；design 与实际代码冲突时，先在 design 加 ADR 注释再修代码，不要静默改设计。
> - 路径相对仓库根 `d:\python工作区\个人知识库wiki\` 给出。
> - 每完成一个任务组（Group N 的全部任务）后跑一次 `pytest personal-wiki/tests/ -q` 与 `npm --prefix personal-os-app test -- --run`，必须绿。
> - **不要按日历节奏推进**。能多快做完就多快，不需要等待、不需要分日。下一个任务的依赖一旦满足就开始。
> - 不要碰 git。任务做完文件留在工作区，提交由人来。
> - 不要新增超出本清单的文件、依赖、API 端点、表结构。

---

## Stage 1: MVP（让 Tokyo trip 验收场景能跑通）

### Group 1：Frontmatter Validator + Slugifier + Round-trip 测试

#### 1.1 创建 `personal-wiki/api/frontmatter.py`
- **依赖**：无
- **产物**：
  - 模块文件 `personal-wiki/api/frontmatter.py`
  - 公开函数 / 类：
    - `class Frontmatter(BaseModel)`：用 `pydantic` 定义字段。字段、类型、必选/可选严格对照 design 第 3 节。
    - `def parse(text: str) -> tuple[Frontmatter, str]`：从 Markdown 文本里抽出 YAML 块和正文，返回 (frontmatter, body)。YAML 解析失败抛 `IngestError(400, 'frontmatter-parse-error')`。
    - `def serialize(fm: Frontmatter, body: str) -> str`：把 frontmatter + body 拼成 Markdown 文本。
    - `def validate(fm: Frontmatter) -> None`：执行 design 第 3 节"校验失败到 HTTP 状态码的映射"全部 9 条规则，违规抛 `IngestError(400, <code>, <details>)`。
  - `class IngestError(Exception)`：带 `status_code: int`、`code: str`、`details: dict | None` 字段。
- **验收**：
  - 单元测试 `personal-wiki/tests/test_frontmatter.py` 全绿。
  - 测试覆盖：YAML 解析失败、必填缺失、`type=Atoms`/`atoms`/`PROJECT` 一律拒绝、`created_by=hermes:worker` 没 `task_id` 拒绝、`type=project` 没 `project` 拒绝、`agent_id` 空字符串拒绝、`created_at` 无时区拒绝、tag 大小写折叠 + 去重 + 去 `#` 前缀、`title` 与 `project` strip 空白。
- **关联 AC**：R2 AC1–AC9、R12 AC1–AC2、R12 AC10、R10 AC5。
- **禁止**：不要在本任务里实现 tag 正则校验（Harden 阶段做）；不要做 round-trip property test（在 1.3 做）；不要写文件落盘。

#### 1.2 创建 `personal-wiki/api/slugifier.py`
- **依赖**：无
- **产物**：
  - 模块文件 `personal-wiki/api/slugifier.py`
  - 函数 `def slugify(s: str) -> str`：实现严格按 design 第 4 节代码片段（NFKC normalize → strip → 空白转 `-` → 删除 `[^A-Za-z0-9_\-\u4e00-\u9fff]` → 折叠重复 `-` → 截断到 80 → 空兜底 `slug-<sha1[:8]>`）。
- **验收**：
  - 单元测试 `personal-wiki/tests/test_slugifier.py` 全绿。
  - 测试覆盖 design 第 4 节"例子"表格全部 6 行，外加 `slugify("东京行") == slugify(" 东京行 ") == slugify("东京行  ")`（R5 AC3）。
- **关联 AC**：R4 AC8、R4 AC9、R5 AC3、R12 AC3。
- **禁止**：不要拼音转换；不要降为 lowercase（保留大小写）；不要外部依赖（只用标准库 `re/unicodedata/hashlib`）。

#### 1.3 Property test：frontmatter round-trip（P7）
- **依赖**：1.1
- **产物**：
  - `personal-wiki/tests/property/__init__.py`
  - `personal-wiki/tests/property/test_frontmatter_roundtrip.py`
  - 使用 `hypothesis` 库；如未安装，把 `hypothesis>=6.0` 加入 `personal-wiki/api/requirements.txt`（仅 dev 段）。
  - 定义生成器 `note_strategy()`：随机生成合法 frontmatter（覆盖所有 Required + Conditional 字段），约束：
    - `title` 非空 ASCII+CJK，长度 1–100
    - `type` 从合法集采样
    - `created_by` 从合法集采样
    - 当 `created_by` 以 `hermes:` 开头时一定生成非空 `task_id`
    - 当 `type=project` 时一定生成非空 `project`
    - `tags` 是 `[a-z0-9\-]` 列表，长度 0–10
    - `created_at` 是带时区的 ISO-8601
  - 测试函数：`@given(note=note_strategy()) def test_roundtrip(note): assert parse(serialize(note))[0] == note`。
- **验收**：
  - `pytest personal-wiki/tests/property/test_frontmatter_roundtrip.py --hypothesis-show-statistics` 全绿，至少跑 200 个样例。
- **关联 AC**：R13 AC7（P7）。
- **禁止**：不要把 hypothesis 设为非 dev 依赖；不要为了通过测试反过来削弱 frontmatter 规则。

> **Group 1 收尾**：`pytest personal-wiki/tests/ -q` 必须全绿。

---

### Group 2：Auto-Router + Ingest API 重写 + 错误码 + 日志

#### 2.1 创建 `personal-wiki/api/router.py`
- **依赖**：1.1, 1.2
- **产物**：
  - 函数 `def resolve_target(fm: Frontmatter, vault_root: Path) -> Path`：实现 design 第 5 节决策表。
  - MVP 行为：
    - `type=source` → `vault_root/10_sources/<YYYY-MM-DD>/<slug(title)>.md`（`<YYYY-MM-DD>` 取自 `created_at`，转用户本地时区显示日期）
    - `type=project` → `vault_root/30_projects/<slug(project)>/<slug(title)>.md`
    - `type=journal` → `vault_root/40_journals/<YYYY-MM-DD>.md`
    - `type=atom` → `vault_root/90_archive/pending-harden/atom/<slug(title)>.md`
    - `type=skill` → `vault_root/90_archive/pending-harden/skill/<slug(title)>.md`
- **验收**：
  - 测试 `personal-wiki/tests/test_router.py` 全绿，覆盖以上 5 种 type。
- **关联 AC**：R4 AC1–AC10、R1 AC5、R1 AC1。
- **禁止**：不要走 Harden 路径（`20_atoms/`、`50_skills/` 在 MVP 不允许直接落）；不要支持调用方自定义路径。

#### 2.2 创建 `personal-wiki/api/locks.py`
- **依赖**：无
- **产物**：
  - 引入 `filelock` 包；写入 `personal-wiki/api/requirements.txt`。
  - 函数 `def project_lock(vault_root, project_slug, timeout=5)`、`def journal_lock(vault_root, date, timeout=5)`、`def migration_lock(vault_root, timeout=300)`，三个函数都返回上下文管理器。锁文件路径符合 design 第 14 节表格。
  - 锁等待超时抛 `IngestError(503, 'lock-timeout', {'resource': <path>})`。
- **验收**：
  - 测试 `personal-wiki/tests/test_locks.py` 用两个线程争同一项目锁，第二个超时返回 503。
- **关联 AC**：R5 AC4、R6 AC4、R14 全部。
- **禁止**：不要做全局锁；不要无限等待。

#### 2.3 重写 Ingest API：`POST /api/ingest`
- **依赖**：1.1, 1.2, 2.1, 2.2
- **产物**：
  - 修改 `personal-wiki/api/server.py`：完全替换 `/api/ingest` 处理器（保留路径与方法名）。
  - 行为：
    1. 鉴权：`Authorization: Bearer <WIKI_API_TOKEN>`，缺/错 → 401 `code=missing-or-invalid-token`。
    2. body 大小检查：超出 `WIKI_MAX_BODY_BYTES`（默认 2MB）→ 413 `code=body-too-large`。
    3. 解析 JSON：失败 → 400 `code=invalid-json`。
    4. 用 `Frontmatter`（pydantic）校验请求体的 `frontmatter` 字段；调用 `validate()`；失败按 design 第 3 节表格映射。
    5. `tags` 字段在写盘前再做一次大小写折叠 + 去重（与 1.1 中的归一化保持一致）。
    6. `created_at` 缺失 → 服务端补 `datetime.now(timezone.utc).isoformat()`。
    7. 用 `resolve_target()` 计算目标路径。
    8. 调对应 lock。
    9. 写盘（见后续任务 2.4 的 file-writer）。
    10. 返回 201 + design 第 6 节"成功响应"形态。
  - 错误响应统一形态 `{error, code, details?}`。
- **验收**：
  - 测试 `personal-wiki/tests/test_ingest_api.py`：
    - 401 / 413 / 400（每个 code）/ 409 / 503 各一条 happy-path 否定测试
    - 201 三条 happy-path：`type=project`、`type=journal`、`type=source`
    - 修订后缀（同 task_id 同路径再交）一条
- **关联 AC**：R3 AC1–AC7、R2 全部。
- **禁止**：不要保留旧版本 `/api/ingest` 行为兼容性；旧调用方升级是 Group 5 的事；不要新增除了 design 列出的字段以外的 frontmatter 字段。

#### 2.4 创建 `personal-wiki/api/writer.py`
- **依赖**：2.3 草稿（接口形状）
- **产物**：
  - 函数 `def write_note(target: Path, fm: Frontmatter, body: str, *, allow_journal_append=False) -> WriteResult`：
    - 一般情况：父目录不存在则建；`target` 已存在且非 journal 模式 → revision 后缀（按 design 第 7 节算法）。
    - `type=source` 且 `target` 已存在 → 抛 `IngestError(409, 'source-immutable')`。
    - `type=project` 且对应 `30_projects/<slug>/README.md` 不存在 → 先写桩（design 第 7 节模板）。
  - `WriteResult` 包含 `path: Path`、`status: Literal['created', 'revision']`、`directory: Path`。
- **验收**：
  - 测试 `personal-wiki/tests/test_writer.py`：覆盖普通写、revision、README 桩自动建、source 冲突 409。
- **关联 AC**：R5 AC1, AC2, AC5, AC6、R7 AC1, AC2、R4 AC10。
- **禁止**：不要在本任务实现 journal append（在 3.2 做）。

#### 2.5 结构化日志
- **依赖**：2.3
- **产物**：
  - 在 `server.py` 的 `/api/ingest` 末端（成功或失败统一）打 design 第 6 节"日志契约"格式的 JSON 一行。
  - 用标准 `logging`，logger 名 `personal_wiki.ingest`。
  - 字段：`ts, event=ingest, outcome={accepted|rejected}, task_id, created_by, type, path, duration_ms, reason?`。
- **验收**：
  - 测试 `personal-wiki/tests/test_ingest_logging.py` 用 `caplog` 捕获，断言成功一行、失败一行字段完整。
- **关联 AC**：R3 AC7。
- **禁止**：不要用 `print`；不要把 token 或 body 内容打进日志。

> **Group 2 收尾**：`pytest personal-wiki/tests/ -q` 全绿。

---

### Group 3：项目 README 桩 + Journal 追加 + 滚动

#### 3.1 实现项目 README 桩
- **依赖**：2.4
- **产物**：
  - 在 `writer.py` 中已经有模板调用点；本任务负责把模板渲染细化：
    - frontmatter：`title=<原 project 字段值>`、`type=project`、`created_by=` 当前请求者、`project=<原 project 字段值>`、`source_type=agent-output`（user 写则 `user-note`）、`tags=[]`、`created_at=` 当前时间。
    - body：design 第 7 节模板。
- **验收**：
  - 测试 `personal-wiki/tests/test_project_readme.py`：第一次写项目 Note 自动建 README；第二次写不重建；并发同项目两次写各拿到锁（断言 README 只建一次）。
- **关联 AC**：R5 AC2。
- **禁止**：不要让 README 桩本身触发 ingest；它由 writer 直接写盘。

#### 3.2 Journal append 实现
- **依赖**：2.4, 2.2
- **产物**：
  - 在 `writer.py` 增加 `def append_journal(vault_root: Path, fm: Frontmatter, body: str) -> WriteResult`：
    - 持有 `journal_lock(date)`。
    - target = `40_journals/<YYYY-MM-DD>.md`。
    - 文件不存在：写 frontmatter（design 第 8 节）+ 一级标题 `# <YYYY-MM-DD> 日志` + 第一段 section。
    - 文件存在：检查大小，若 > `MAX_JOURNAL_SIZE_BYTES`（默认 1024*1024，env 可调）→ 滚动到 `<date>-N.md`，N 是最小未用整数 ≥ 2，新文件按"首次创建"逻辑写。返回 `status='journal-rolled'` + `rolled_to`。
    - 否则：在文件尾追加 `\n## <created_by> @ <HH:MM>\n\n<body>\n\n---\n`。
  - `Ingest API` 在 `type=journal` 时调用此函数，不调 `write_note`。
- **验收**：
  - 测试 `personal-wiki/tests/test_journal.py`：
    - 首次创建带 frontmatter
    - 二次追加不动 frontmatter
    - 并发两个 thread append 都拿到锁、内容都进文件
    - 文件超过 size 阈值 → 滚动；返回 `journal-rolled`。
- **关联 AC**：R6 AC1–AC6。
- **禁止**：不要修改已写入 section 的内容；不要做"按 created_by 合并 section"。

#### 3.3 修订后缀算法测试加强
- **依赖**：2.4
- **产物**：
  - 补充 `personal-wiki/tests/test_writer.py`：连续 5 次同 task_id 同目标路径写，结果是 `<base>.md, <base>-r2.md, ..., <base>-r5.md`；返回 `status='revision'`。
- **验收**：测试全绿。
- **关联 AC**：R5 AC5、R12 AC5。
- **禁止**：不要做"覆盖最旧"、不要做软删除。

> **Group 3 收尾**：`pytest personal-wiki/tests/ -q` 全绿。

---

### Group 4：Source 不可变性 + 向后兼容读层

#### 4.1 Source 启动哈希基线
- **依赖**：2.4
- **产物**：
  - 模块 `personal-wiki/api/sources_check.py`：
    - `def build_baseline(vault_root: Path) -> dict[str, str]`：遍历 `10_sources/` 下所有 `.md`，返回 `{relpath: sha256}`。
    - `def diff_against_baseline(vault_root: Path, baseline: dict) -> list[Mutation]`：返回 mtime/sha 不匹配的文件清单。
  - 在 `server.py` 启动时调用 `build_baseline()` 存入内存；新增定时任务（用 `apscheduler` 或 `threading.Timer` + 每小时一次）调 `diff_against_baseline()`，发现差异打 `source-mutation-detected` 日志一行（design 第 9 节）。
  - 把 `apscheduler` 加到 requirements.txt（dev 段或常规均可，按现有用法）。
- **验收**：
  - 测试 `personal-wiki/tests/test_sources_check.py`：写两个文件建 baseline；改其中一个；diff 命中改动那个，未改的不出现。
- **关联 AC**：R7 AC5。
- **禁止**：本任务不自动修复变动；不删除文件。

#### 4.2 关闭 source 写后接口
- **依赖**：2.3
- **产物**：
  - 检查 `server.py` 是否有任何路径能写到 `10_sources/`；只允许 ingest 的 `type=source` 路径，其他写端点（如有 PATCH/DELETE/PUT 命中此目录）一律 410 Gone。
- **验收**：
  - 测试 `personal-wiki/tests/test_source_immutability.py`：
    - ingest `type=source` 第一次 201，第二次同路径 409
    - 不存在的 PUT/DELETE 接口对 `10_sources/` 路径返 404 或 410
- **关联 AC**：R7 AC1, AC2, AC3。
- **禁止**：不要新增任何修改 sources 的便利接口。

#### 4.3 向后兼容读层
- **依赖**：无
- **产物**：
  - 在 `server.py` 的列表/搜索/读取端点扫描 `vault/**` 时**包含**：`10_sources/`、`20_notes/`、`30_projects/`、`40_journals/`、`90_archive/`、`Personal OS Inbox/`、`Personal Wiki Mirror/`。
  - 读取 Note 时若缺 frontmatter，**仅在响应中**合成：`created_by='unknown'`、`type='legacy'`、`source_type='user-note'`、`tags=[]`、`created_at=<file mtime ISO>`，**不写回磁盘**。
- **验收**：
  - 测试 `personal-wiki/tests/test_legacy_read.py`：把一个无 frontmatter 的 `.md` 放到 `Personal OS Inbox/`，调读取 API 拿到合成字段；磁盘文件未被修改。
- **关联 AC**：R11 AC1, AC2, AC3。
- **禁止**：不要把合成 frontmatter 写回；不要默认隐藏旧目录。

> **Group 4 收尾**：`pytest personal-wiki/tests/ -q` 全绿。

---

### Group 5：Personal OS 侧改造 + 端到端跑通

#### 5.1 升级 `wiki-ingest.ts`
- **依赖**：Group 2 完成（API 已新格式）
- **产物**：
  - 修改 `personal-os-app/src/lib/wiki-ingest.ts`：
    - 接口签名加上 `frontmatter` 全部字段（设 TypeScript interface `WikiIngestPayload`）。
    - 老 `metadata` 字段保留为兼容入口，但内部转译进 frontmatter（标记 deprecated 注释）。
    - 必填校验：调用方没传 `created_by` / `type` / `source_type` / `tags` 直接抛错（不允许调到 Wiki 才报错）。
    - 当 `created_by` 以 `hermes:` 开头但 `task_id` 缺失，抛错。
- **验收**：
  - 单元测试 `personal-os-app/tests/lib/wiki-ingest.test.ts`：覆盖 happy path + 4 种缺字段抛错。
- **关联 AC**：R3 AC1。
- **禁止**：不要在客户端做 slugify（服务端做）；不要绕过 ingest 直接调底层文件 API。

#### 5.2 升级 `wiki-client.ts` 错误处理
- **依赖**：5.1
- **产物**：
  - 修改 `personal-os-app/src/lib/wiki-client.ts`：
    - 解析新响应字段 `status`、`path`、`directory`、`url`、`task_id`。
    - 401 → 抛 `WikiAuthError`，不重试。
    - 409 source-immutable → 抛 `WikiSourceConflict`，不重试。
    - 413 → 抛 `WikiPayloadTooLarge`。
    - 503 lock-timeout → 自动重试一次，失败再抛。
- **验收**：
  - 测试 `personal-os-app/tests/lib/wiki-client.test.ts` 覆盖各错误码。
- **关联 AC**：R3 全部、R14 超时行为。
- **禁止**：不要无限重试；不要把 token 透传到日志。

#### 5.3 Submit 钩子写 Wiki summary
- **依赖**：5.1
- **产物**：
  - 修改 `personal-os-app/src/app/api/tasks/[id]/submit/route.ts`（或 lib 层等价位置，按现有结构）：在 submit 处理器成功更新 task 状态后，调 `wikiIngest()`，payload 按 design 第 15 节"Submit 钩子"模板。
  - 当 task 没有 `projectName`，使用 `task-${task.id}` 兜底为 project 字段。
  - 失败处理：如果 wiki ingest 抛错，**不要回滚 submit**；记一条 ActivityLog `wiki-write-failed` + reason，让人事后看到。
- **验收**：
  - 集成测试 `personal-os-app/tests/api/tasks-submit.test.ts`：模拟 submit 一个 task → 校验 mock wiki client 收到正确 payload；模拟 wiki 401 → submit 仍然成功 + ActivityLog 出现失败记录。
- **关联 AC**：R3 AC2、R5 AC1、R6 留痕。
- **禁止**：不要让 wiki 写失败把任务状态回滚；不要静默吞错。

#### 5.4 端到端跑"东京旅游"夹具
- **依赖**：5.1, 5.2, 5.3
- **产物**：
  - 测试 `personal-os-app/tests/e2e/tokyo-trip.test.ts`（用现有测试基础设施，必要时 mock wiki HTTP）：
    1. POST `/api/intake` 投入 `"5月15号去东京三天"`
    2. mock 主助理逻辑生成 task；user submit 一个 contribution
    3. 调 submit 端点
    4. 校验：mock wiki 收到一个 `type=project`、`project=2026-05 东京行`（或类似）、`task_id` 非空的 ingest 请求
- **验收**：测试绿。
- **关联 AC**：PRODUCT_MAP 第 4 节"一期成功标准"前 5 步。
- **禁止**：不要为这条测试新增不在 design 范围内的 API；mock 之外不发真请求。

> **Group 5 收尾**：`pytest personal-wiki/tests/ -q` 与 `npm --prefix personal-os-app test -- --run` 都必须绿。

---

### Group 6：Bug 修复 Buffer

#### 6.1 跑全套测试 + 收集失败
- **依赖**：Group 5 完成
- **产物**：
  - 跑 `pytest personal-wiki/tests/ -q --tb=short`、`npm --prefix personal-os-app test -- --run`。
  - 把所有失败用例汇总到 `.kiro/specs/wiki-vault-restructure/group6-bug-list.md`，每条带：测试名、失败摘要、可能原因、对应任务编号。
- **验收**：文件存在；失败为 0 时文件写"全绿"。
- **禁止**：本任务不修 bug，仅汇总。

#### 6.2 修复 bug
- **依赖**：6.1
- **产物**：按 6.1 清单修复每个 bug。每修一条更新 `group6-bug-list.md` 的状态字段。
- **验收**：所有测试再次全绿。
- **关联 AC**：本任务无新 AC，覆盖 Group 1–5 所有。
- **禁止**：不要在修 bug 过程中扩大设计；只要让现有测试通过。

> **Group 6 收尾**：所有测试全绿且无 skip。

---

### Group 7：MVP 文档

#### 7.1 写 `personal-wiki/docs/INGEST_API.md`
- **依赖**：Group 5 完成
- **产物**：
  - Markdown 文件包含：请求 schema（含每个字段说明）、成功响应、所有错误码 + code 列表 + 触发条件、auth 说明、日志字段说明、调用示例（curl 一条 + TypeScript 一条）。
  - 内容来自 design 第 6 节，**不要重写**，照抄并补例子。
- **验收**：md 渲染无错；覆盖所有 9 种错误 code。
- **关联 AC**：R3 AC6。
- **禁止**：不要在文档里描述 Harden 期才有的字段（tag registry、MOC）。

#### 7.2 写 `00_meta/structure.md`（前置版）
- **依赖**：无
- **产物**：
  - 在 vault 创建 `00_meta/structure.md`（注意：`00_meta/` 在 MVP 不强制存在，但本文件作为前置存在以便 Stage 2 直接接手）。
  - 内容：目录列表与含义、type → 目录映射、frontmatter 字段说明（普通话）、"手动内容只能放在 user-block 内"的提醒。
- **验收**：文件存在；内容基本来自 design 第 2 节、第 3 节。
- **关联 AC**：R1 AC4 前置。
- **禁止**：不要写 MOC 实现细节（在 Group 11 写）。

#### 7.3 同步 AGENT_PROMPT
- **依赖**：Group 5 完成
- **产物**：
  - 修改 `docs/AGENT_PROMPT.md` 与 `docs/AGENT_PROMPT.zh-CN.md`：在 "Wiki 写入" 章节加入 frontmatter 必填字段清单、type 取值列表、submit 时该写哪些字段。
  - 不要拷贝 design；要写成 prompt 风格（短句、动词开头）。
- **验收**：文件更新；用 grep 检查 `created_by`、`task_id`、`type=project`、`type=journal` 都出现。
- **关联 AC**：辅助 R2 全部。
- **禁止**：不要直接把 design 第 3 节贴进 prompt（太长，模型读不进去）。

> **Group 7 收尾**：手动审一遍 3 个文档；MVP 完成判定 = 7.1 写好 + Tokyo trip e2e 绿 + 全测试绿。

---

## Stage 2: Harden（让系统在 Agent 翻车时也能扛）

### Group 8：Migration_Script

#### 8.1 创建 `personal-wiki/scripts/migrate_vault.py`
- **依赖**：MVP 完成
- **产物**：
  - CLI 用 `argparse`：`--dry-run`、`--apply`、`--yes`、`--resume`、`--confidence-min`（默认 0.7）、`--vault`（默认 `personal-wiki/data/vault`）。
  - 实现 design 第 11 节"分类启发式" 8 步。
  - dry-run 输出 plan，不写盘；apply 必须有 `--yes`。
  - 写 `00_meta/.migration-state.json` 续跑文件，每文件写 `{src, target, status}`，移完写 `done`。
  - 跑完输出 `00_meta/migration-report.md`（design 第 11 节模板）。
- **验收**：
  - 测试 `personal-wiki/tests/test_migration.py`：
    - 准备 fixture vault：包含 `20_notes/`、`Personal OS Inbox/`、`Personal Wiki Mirror/` 共 ≥10 个不同特征的文件
    - dry-run 输出 plan 行数 = 文件数；不写盘
    - apply 后所有文件都搬位；report 内容正确
    - 中断后 `--resume` 跳过已 done 文件
- **关联 AC**：R8 全部。
- **禁止**：不要碰 `10_sources/`；不要修改原文件 mtime（搬完要保留）。

#### 8.2 Migration idempotency property test（P6）
- **依赖**：8.1
- **产物**：
  - `personal-wiki/tests/property/test_migration_idempotency.py`：
    - 生成器：随机 vault state（10–30 个文件，混合各种 path/content 模式）
    - 性质：`migrate(migrate(S, A), A) == migrate(S, A)`，比较结果是 vault 文件清单 + 每个文件 sha256
- **验收**：跑 100+ 样例全绿。
- **关联 AC**：R13 AC6（P6）。
- **禁止**：不要为通过测试在迁移脚本里加"如果是第二次跳过全部"这种短路逻辑；要真做到幂等。

### Group 9：MOC Generator

#### 9.1 创建 `personal-wiki/api/moc.py`
- **依赖**：Group 8 完成
- **产物**：
  - 函数 `def rebuild_moc(vault_root: Path) -> str`：扫 vault 索引，渲染 design 第 12 节"输出"模板。
  - 用户块保护：先解析 `00_meta/index.md` 现有内容，提取 `<!-- moc:user-block --> ... <!-- /moc:user-block -->`，新文件时原样保留在末尾。
  - top 20 限制每 section。
  - 孤儿任务：调 Personal OS `GET /api/tasks/<task_id>` 校验。404 → 进 "孤儿任务" section。批量调用，结果缓存 5 分钟。
- **验收**：
  - 测试 `personal-wiki/tests/test_moc.py`：
    - 写 5 个不同 type 的 Note → MOC 各 section 出现对应条目
    - 用户块在 user-block marker 内不被覆盖
    - top 20 截断
    - 模拟 OS 返回 404 → 孤儿任务 section 出现
- **关联 AC**：R9 全部。
- **禁止**：不要直接覆盖 user-block 之外用户手写内容（Group 7 文档已声明用户手写只能在 user-block 内）。

#### 9.2 触发 MOC 重建
- **依赖**：9.1
- **产物**：
  - 在 `server.py` ingest 成功路径末端，**异步**调用 `rebuild_moc()`（用 `asyncio.create_task` 或 background thread；不要让 ingest 等它）。
  - 增加 `/api/admin/moc/rebuild` POST 端点（带 `WIKI_API_TOKEN` 鉴权）手动触发。
  - 增加每 5 分钟一次的定时调度（复用 4.1 的调度器）。
- **验收**：
  - 测试 `personal-wiki/tests/test_moc_trigger.py`：ingest 一条 → MOC 内出现该 Note 标题（允许 1 秒等待）；手动 endpoint 返回 200。
- **关联 AC**：R9 AC2。
- **禁止**：不要让 MOC 重建阻塞 ingest 响应。

#### 9.3 task_id traceability property test（P4）
- **依赖**：9.1
- **产物**：
  - `personal-wiki/tests/property/test_task_id_traceability.py`：
    - 生成 N 个 Note，task_id 一半在 OS（mock），一半不在
    - 性质：每个有 task_id 的 Note 要么在 MOC 主 section、要么在孤儿 section，不能两边都没有也不能两边都有
- **验收**：跑 100+ 样例全绿。
- **关联 AC**：R13 AC4（P4）。

### Group 10：Tag Registry

#### 10.1 实现 tag registry
- **依赖**：Group 9 完成
- **产物**：
  - 模块 `personal-wiki/api/tag_registry.py`：
    - `def load_registry(vault_root) -> TagRegistry`：从 `00_meta/tags.md` 解析 `## 已批准` 与 `## 待审`。
    - `def append_pending(vault_root, tag, created_by, task_id, first_seen)`：在 `## 待审` 末尾追加一条；持锁。
    - 校验正则 `TAG_PATTERN = ^[a-z0-9][a-z0-9\-]{0,40}$`。
  - 在 `Frontmatter_Validator` 接入：tag 不符正则 → 400 `code=invalid-tag-format`；tag 不在 approved → 写完 ingest 后异步追加到 pending（不阻塞）。
  - 如果 `00_meta/tags.md` 不存在 → 启动时建空模板。
- **验收**：
  - 测试 `personal-wiki/tests/test_tag_registry.py`：
    - 不合法格式 tag → 400
    - 新 tag 写入 → pending section 多一条
    - 已批准 tag → pending 不动
    - 并发两个 ingest 写同一新 tag → 只追加一条
- **关联 AC**：R10 全部。
- **禁止**：不要因为 tag 未批准而拒绝写入；不要在客户端做 registry 校验。

#### 10.2 Tag closure property test（P5）
- **依赖**：10.1
- **产物**：
  - `personal-wiki/tests/property/test_tag_closure.py`：
    - 生成 N 个 Note 每个带随机 tags
    - 性质：所有 vault 中出现的 tag 必须在 approved 或 pending 之一，不可两者都不在
- **验收**：跑 100+ 样例全绿。
- **关联 AC**：R13 AC5（P5）。

### Group 11：atom / skill 回流

#### 11.1 启用 `20_atoms/` 与 `50_skills/` 主路径
- **依赖**：Group 10 完成
- **产物**：
  - 修改 `router.py`：`type=atom` → `20_atoms/<slug>.md`，`type=skill` → `50_skills/<slug>.md`。
  - 增加 feature flag `WIKI_HARDEN_PATHS_ENABLED`，默认 true（Harden 启用）；测试可关闭以保留 quarantine 行为。
- **验收**：
  - 单元测试更新：`type=atom` 落 `20_atoms/`；flag 关闭时落 quarantine。
- **关联 AC**：R1 AC3、R4 AC5–AC6。

#### 11.2 quarantine 回流脚本
- **依赖**：11.1
- **产物**：
  - `personal-wiki/scripts/migrate_pending_harden.py`：把 `90_archive/pending-harden/atom/*` → `20_atoms/`，skill 同理。带 `--dry-run`/`--apply --yes`。
  - 复用 8.1 的迁移基础设施。
- **验收**：
  - 测试 fixture：5 个 atom 在 quarantine → 跑脚本 → 全部到 `20_atoms/` 且文件 sha 一致。
- **关联 AC**：R4 AC10 收尾。
- **禁止**：不要修改 frontmatter 内容；不要重命名文件。

#### 11.3 Folder/type consistency property test（P2）扩展
- **依赖**：11.1
- **产物**：
  - 升级 Group 2 期就该有的 P2 测试 `personal-wiki/tests/property/test_folder_type_consistency.py`：
    - 在 Harden flag 开启状态下，`type=atom` 必落 `20_atoms/`；`type=skill` 必落 `50_skills/`。
    - flag 关闭则落 quarantine。
- **验收**：测试全绿。
- **关联 AC**：R13 AC2（P2）。

> **如果 P2 在 Group 2 已经写了**：本任务只是新增 Harden 路径分支断言。

### Group 12：收尾

#### 12.1 文档更新
- **依赖**：Group 11 完成
- **产物**：
  - `personal-wiki/docs/INGEST_API.md`：补充 atom/skill 路径、tag registry 说明。
  - `00_meta/structure.md`：把 Harden 目录纳入。
  - `docs/PRODUCT_MAP.zh-CN.md` 与 `PRODUCT_MAP.md`：把 Phase 1 状态从"未完成"改成"已完成"，加上完成日期。
  - `docs/HUMAN_AGENT_COLLABORATION_ROADMAP.md` / `zh-CN`：在对应条目后加状态。
- **验收**：grep 检查关键词全部更新；文件 mtime 是当天。
- **关联 AC**：维护性。
- **禁止**：不要在 PRODUCT_MAP 里加新计划；只更新状态与日期。

#### 12.2 全套测试 + 全套 property test 跑一遍
- **依赖**：12.1
- **产物**：执行
  - `pytest personal-wiki/tests/ -q --tb=short`
  - `pytest personal-wiki/tests/property/ -q --hypothesis-show-statistics`
  - `npm --prefix personal-os-app test -- --run`
  - `npm --prefix personal-os-app run lint`
  - `npm --prefix personal-os-app run build`
  - 全部绿才能勾完。
- **验收**：全绿；输出贴在 `.kiro/specs/wiki-vault-restructure/final-report.md`。
- **关联 AC**：所有 R13。
- **禁止**：不要为了通过 build 临时禁用 lint 规则；不要 skip 测试。

#### 12.3 Harden 期 bug list（如有）
- **依赖**：12.2
- **产物**：12.2 任何失败 → 同 Group 6 流程，建 `final-bug-list.md`，修完为止。
- **验收**：所有测试全绿。

---

## 完成判定

整个 spec `wiki-vault-restructure` 完成的判定（Codex `-go` 模式停止条件）：

1. `[x]` 全部任务勾选（任务总数 ≈ 30）。
2. `pytest personal-wiki/tests/ -q` 0 failed, 0 error, 0 skipped。
3. `pytest personal-wiki/tests/property/ -q` 0 failed。
4. `npm --prefix personal-os-app test -- --run` 0 failed。
5. `npm --prefix personal-os-app run lint` 0 error。
6. `npm --prefix personal-os-app run build` 退出码 0。
7. `personal-wiki/docs/INGEST_API.md` 存在且包含全部 9 种 error code。
8. `00_meta/structure.md` 存在。
9. `00_meta/migration-report.md` 存在（Harden 跑过迁移后产生）。
10. `00_meta/index.md` 存在并由 MOC_Generator 渲染过。
11. `docs/PRODUCT_MAP.zh-CN.md` 中 Phase 1 状态为"已完成"。

任一项不满足 → spec 未完成，不要停。
