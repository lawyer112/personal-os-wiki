# Requirements Document

## Introduction

Personal Wiki 当前是一个 Markdown vault（目录 `personal-wiki/data/vault/`），由人和多个 Agent（Hermes intake / dispatcher / worker）混合写入。当前结构（`10_sources/`、`20_notes/`、`90_archive/`、`Personal OS Inbox/`、`Personal Wiki Mirror/`）没有"谁写、写到哪、按什么字段归属"的硬规则，导致用户无法按 tag 或项目反查"哪个 Agent 在什么时候做了什么"，半人半 Agent 的内容互相覆盖，审计线索断裂。

本特性按 PRODUCT_MAP Phase 1（Track C）落地两件事：

1. 把 vault 切成 `00_meta / 10_sources / 20_atoms / 30_projects / 40_journals / 50_skills / 90_archive` 的目录规范。
2. 强制每篇笔记带统一 frontmatter（`type`、`created_by`、`task_id` 等归属字段），让 Personal Wiki 在写入时校验、按 `type` 自动路由、并保留可查询的归属审计。

为了 7 天能跑通，本特性分两阶段交付：

- **MVP（7 天）**：仅引入 `30_projects/`、`40_journals/` 两个新目录；强制 frontmatter；按 `type` 自动路由；旧目录与旧内容原样保留；不做迁移、不做 MOC 自动生成。
- **Harden（接下来 7 天）**：完成 `00_meta/` `20_atoms/` `50_skills/` 的全量重构、旧数据迁移脚本（带 dry-run）、`00_meta/index.md` MOC 自动生成器、`00_meta/tags.md` 标签治理。

需求文档只描述行为契约，不约束具体文件路径；现有 `personal-wiki/api/server.py`、`personal-wiki/scripts/*` 的实现按此重构。本文档中所有验收标准都明确标注 `[MVP]` 或 `[Harden]`。

## Glossary

- **Personal_Wiki**：知识库后端服务（FastAPI/HTTP），对外暴露读取页面与写入 API。
- **Vault**：Personal_Wiki 管理的 Markdown 文件根目录。
- **Ingest_API**：`POST /api/ingest` 写入端点。所有 Agent 与脚本写入都必须经此端点。
- **Auto_Router**：Personal_Wiki 内部组件，根据 frontmatter 的 `type` 字段决定写入到 Vault 的哪个一级目录。
- **Frontmatter_Validator**：Personal_Wiki 内部组件，校验 frontmatter 字段是否齐全且取值合法。
- **Slugifier**：把任意字符串（含中文、空格、特殊字符）转换成稳定文件名/目录名的组件。
- **Migration_Script**：把旧 Vault 内容（`20_notes/`、`Personal OS Inbox/`、`Personal Wiki Mirror/`）分类迁移到新结构的离线脚本。
- **MOC_Generator**：自动生成 `00_meta/index.md`（Map of Content，最近内容总览）的组件。
- **Tag_Registry**：位于 `00_meta/tags.md` 的标签字典文件，记录已批准的标签及其含义。
- **Daily_Journal_Writer**：把"今日计划 / 今日 Agent 活动"追加到 `40_journals/<date>.md` 的写入路径。
- **Cutover_Date**：本特性 MVP 上线时间戳；之后产生的所有写入都必须满足新规则。
- **Note**：Vault 中的一篇 Markdown 文件，由 frontmatter（YAML 块）+ 正文构成。
- **Atom**：单一概念、可被多处引用的原子笔记（`type=atom`，落在 `20_atoms/`）。
- **Project_Note**：归属于某个项目的笔记（`type=project`，落在 `30_projects/<project>/`）。
- **Journal_Note**：按日期组织的日志（`type=journal`，落在 `40_journals/`）。
- **Skill_Note**：可复用作业手册（`type=skill`，落在 `50_skills/`，Harden 阶段启用）。
- **Source_Note**：原始输入归档（`type=source`，落在 `10_sources/`，写入后不允许修改）。
- **Required_Frontmatter_Fields**：`title`、`type`、`created_by`、`source_type`、`tags`、`created_at`。
- **Conditional_Frontmatter_Fields**：`task_id`（当 `created_by` 以 `hermes:` 开头时必填）、`agent_id`、`project`、`last_reviewed`。
- **Allowed_Type_Values**：`atom`、`project`、`journal`、`skill`、`source`。
- **Allowed_Created_By_Values**：`user`、`hermes:intake`、`hermes:dispatcher`、`hermes:worker`。

## Requirements

---

### Requirement 1: 目录布局规范（Folder Layout）

**User Story:** As a user, I want Vault 拥有一个固定的、可解释的一级目录结构, so that 我打开任何一个目录就知道里面应该放什么内容、谁会写它。

#### Acceptance Criteria

1. `[MVP]` THE Personal_Wiki SHALL ensure that the Vault contains the directories `10_sources/`、`30_projects/`、`40_journals/` and `90_archive/`, creating any missing one at startup.
2. `[MVP]` WHEN the Vault is initialized for the first time, THE Personal_Wiki SHALL preserve any existing legacy directories（包括 `20_notes/`、`Personal OS Inbox/`、`Personal Wiki Mirror/`）without modification.
3. `[Harden]` THE Personal_Wiki SHALL ensure that the Vault contains the additional directories `00_meta/`、`20_atoms/` and `50_skills/`, creating any missing one at startup.
4. `[Harden]` THE Personal_Wiki SHALL maintain a layout reference document at `00_meta/structure.md` that lists each top-level directory's purpose and the `type` value that maps to it.
5. `[MVP]` IF a write request resolves to a target directory that is not one of the directories listed in AC1 (MVP) or AC1+AC3 (Harden), THEN THE Personal_Wiki SHALL reject the request with an error identifying the unknown target.

---

### Requirement 2: Frontmatter 字段规范（Frontmatter）

**User Story:** As Personal Wiki, I want 每篇 Note 都携带统一的 frontmatter（标题、类型、创建者、任务、项目、来源、标签、时间）, so that 任何 Note 的归属和上下文都可以被机器和人同时检索。

#### Acceptance Criteria

1. `[MVP]` THE Personal_Wiki SHALL define the Required_Frontmatter_Fields as `title`, `type`, `created_by`, `source_type`, `tags`, `created_at`.
2. `[MVP]` IF an Ingest_API request omits any of the Required_Frontmatter_Fields, THEN THE Frontmatter_Validator SHALL reject the request with HTTP 400 and a body that names every missing field.
3. `[MVP]` IF the `type` field value is not one of Allowed_Type_Values, THEN THE Frontmatter_Validator SHALL reject the request with HTTP 400 and the list of allowed values（不允许 coerce/猜测）.
4. `[MVP]` IF the `created_by` field value is not one of Allowed_Created_By_Values, THEN THE Frontmatter_Validator SHALL reject the request with HTTP 400 and the list of allowed values.
5. `[MVP]` IF the `created_by` field value starts with `hermes:` AND the `task_id` field is missing or empty, THEN THE Frontmatter_Validator SHALL reject the request with HTTP 400 and message `task_id is required for agent writes`.
6. `[MVP]` WHERE the `created_by` field value is `user`, THE Frontmatter_Validator SHALL accept the request even when `task_id` is missing.
7. `[MVP]` WHEN a Note is written successfully, THE Personal_Wiki SHALL set `created_at` to the current ISO-8601 timestamp with timezone if the caller did not provide one.
8. `[MVP]` THE Personal_Wiki SHALL store the `tags` field as a YAML list of strings, lowercased and stripped of leading `#`.
9. `[MVP]` IF the request body's frontmatter cannot be parsed as YAML, THEN THE Frontmatter_Validator SHALL reject the request with HTTP 400 and a parse error excerpt.
10. `[MVP]` WHEN a user manually edits an Agent-produced Note in the file system, THE Personal_Wiki SHALL NOT silently rewrite the `created_by` field; it SHALL update `last_reviewed` to the edit timestamp on the next index refresh and SHALL leave `created_by` unchanged.

---

### Requirement 3: Ingest API 写入契约（Ingest API）

**User Story:** As an Agent or maintainer script, I want 所有写入 Vault 的路径都收口到 Ingest_API, so that 没人能绕过 frontmatter 校验和自动路由直接写文件。

#### Acceptance Criteria

1. `[MVP]` THE Personal_Wiki SHALL accept Note writes only via the Ingest_API endpoint; it SHALL NOT expose any other write endpoint that bypasses Frontmatter_Validator or Auto_Router.
2. `[MVP]` WHEN the Ingest_API receives a valid request, THE Personal_Wiki SHALL respond with HTTP 201 and a JSON body containing the resolved note path, the resolved target directory, and the `task_id` if present.
3. `[MVP]` IF the caller does not present a valid `WIKI_API_TOKEN`, THEN THE Personal_Wiki SHALL reject the request with HTTP 401 and SHALL NOT write any file.
4. `[MVP]` IF the request body exceeds the configured size limit, THEN THE Personal_Wiki SHALL reject the request with HTTP 413 before parsing frontmatter.
5. `[MVP]` WHEN the Ingest_API rejects a request for any validation reason, THE Personal_Wiki SHALL NOT create, modify, or rename any file in the Vault.
6. `[MVP]` THE Personal_Wiki SHALL document the Ingest_API contract（请求 schema、错误码、示例）in a location reachable from `00_meta/` (Harden) 或 `personal-wiki/docs/` (MVP).
7. `[MVP]` THE Personal_Wiki SHALL emit a structured log entry per Ingest_API call containing `task_id`, `created_by`, `type`, target path, and outcome（accepted/rejected + reason）.

---

### Requirement 4: 按 type 自动路由（Auto-Routing）

**User Story:** As an Agent, I want Personal Wiki 根据我提交的 `type` 字段自动决定文件落在哪个目录, so that 我不必硬编码任何具体路径。

#### Acceptance Criteria

1. `[MVP]` WHEN `type=source`, THE Auto_Router SHALL place the Note under `10_sources/<YYYY-MM-DD>/<slug>.md`.
2. `[MVP]` WHEN `type=project`, THE Auto_Router SHALL place the Note under `30_projects/<project_slug>/<slug>.md`, where `project_slug` is derived from the `project` frontmatter field via Slugifier.
3. `[MVP]` IF `type=project` AND the `project` frontmatter field is missing or empty, THEN THE Auto_Router SHALL reject the request with HTTP 400 and message `project field required when type=project`.
4. `[MVP]` WHEN `type=journal`, THE Auto_Router SHALL place the Note under `40_journals/<YYYY-MM-DD>.md` (one file per date).
5. `[Harden]` WHEN `type=atom`, THE Auto_Router SHALL place the Note under `20_atoms/<slug>.md`.
6. `[Harden]` WHEN `type=skill`, THE Auto_Router SHALL place the Note under `50_skills/<slug>.md`.
7. `[MVP]` WHILE Auto_Router is active, THE Personal_Wiki SHALL NOT honor any caller-supplied absolute path; the caller SHALL only declare `type` and `project`.
8. `[MVP]` WHEN the Slugifier is given a string containing CJK characters, spaces, or punctuation, THE Slugifier SHALL produce a slug that preserves CJK characters, replaces whitespace with `-`, strips characters outside `[A-Za-z0-9_\-\u4e00-\u9fff]`, collapses repeated `-`, and truncates to ≤ 80 characters.
9. `[MVP]` IF Slugifier produces an empty string for the input, THEN THE Slugifier SHALL fall back to a deterministic short hash of the original input so that no file is named blank.
10. `[MVP]` WHEN MVP is active and `type` is `atom` or `skill`, THE Auto_Router SHALL accept the request and place the Note under `90_archive/pending-harden/<type>/<slug>.md` so the write is not lost; `[Harden]` MAY relocate it during migration.

---

### Requirement 5: 项目档案归集（Project Archive）

**User Story:** As an Agent working on a project (e.g. "2026-05 东京行"), I want 我对该项目产生的所有 Note 都集中在一个目录, so that 用户能在一处看到这个项目的全部产出。

#### Acceptance Criteria

1. `[MVP]` WHEN multiple Notes share the same `project` frontmatter value, THE Auto_Router SHALL place all of them under the same `30_projects/<project_slug>/` directory.
2. `[MVP]` THE Personal_Wiki SHALL ensure `30_projects/<project_slug>/README.md` exists with `type=project` whenever any other Note in that directory is created; if absent, THE Personal_Wiki SHALL create a stub README containing the project slug and creation timestamp.
3. `[MVP]` IF two Agents submit Notes with the same `project` value but different casing or whitespace, THEN THE Slugifier SHALL produce the same `project_slug` so the Notes land in the same folder.
4. `[MVP]` IF two writes target the same target file path within ≤ 1 second, THEN THE Personal_Wiki SHALL serialize them with a per-project advisory lock and process them in arrival order; neither write SHALL be silently dropped.
5. `[MVP]` IF an Agent re-submits a Note with the same `task_id` AND the same target file path already exists, THEN THE Personal_Wiki SHALL preserve the existing file and create a new file with suffix `-r{n}` (smallest unused integer ≥ 2), and THE Personal_Wiki SHALL respond with the new path and `status=revision`.
6. `[MVP]` THE Personal_Wiki SHALL accept project slugs that contain CJK characters and SHALL NOT URL-encode them on disk.

---

### Requirement 6: 每日日志（Daily Journal）

**User Story:** As the dispatcher Agent, I want 每天把"今日计划 / 今日 Agent 活动"追加到当天的 journal 文件, so that 用户能按日期看到一条时间线。

#### Acceptance Criteria

1. `[MVP]` WHEN a `type=journal` write is received for date `D`, THE Daily_Journal_Writer SHALL append a section to `40_journals/<D>.md` instead of overwriting prior content.
2. `[MVP]` THE Daily_Journal_Writer SHALL prepend each appended section with a heading containing the writing Agent identifier and timestamp (e.g. `## hermes:dispatcher @ 14:32`).
3. `[MVP]` IF `40_journals/<D>.md` does not exist, THEN THE Daily_Journal_Writer SHALL create it with the standard frontmatter where `type=journal`, `created_by` is the requesting Agent, and `created_at` is the first append's timestamp.
4. `[MVP]` IF two journal writes for the same date arrive concurrently, THEN THE Daily_Journal_Writer SHALL use a per-file lock so that no section is partially written or lost; section order SHALL be by arrival time.
5. `[MVP]` THE Daily_Journal_Writer SHALL accept a journal write whose `created_by=user`; in that case the heading SHALL identify the human author.
6. `[MVP]` IF a journal append exceeds a configured maximum file size（默认 1 MB）, THEN THE Daily_Journal_Writer SHALL roll over to `40_journals/<D>-2.md` and reject further appends with a `journal-rolled` status response that names the new file.

---

### Requirement 7: 来源保护（Source Preservation）

**User Story:** As an Agent ingesting articles or transcripts, I want 原始来源在 `10_sources/` 中保持只增不改, so that 我永远不会覆盖证据。

#### Acceptance Criteria

1. `[MVP]` THE Personal_Wiki SHALL accept Ingest_API writes with `type=source` only when the target file does not already exist.
2. `[MVP]` IF a `type=source` write targets an existing file path, THEN THE Personal_Wiki SHALL reject the request with HTTP 409 and message `source notes are immutable`.
3. `[MVP]` THE Personal_Wiki SHALL NOT expose any API endpoint that updates or deletes a file under `10_sources/` once written.
4. `[MVP]` WHEN an Agent ingests an article and also produces a derived atomic note, THE Personal_Wiki SHALL accept two separate writes: one with `type=source` and one with `type=atom` (Harden) or `type=project` (MVP), each landing in its own directory.
5. `[MVP]` IF the file system reports that a file under `10_sources/` was modified after creation, THEN THE Personal_Wiki SHALL surface the discrepancy in the next health check log line `source-mutation-detected path=<...>`.

---

### Requirement 8: 旧数据迁移（Legacy Migration — Harden）

**User Story:** As a maintainer, I want 一个迁移脚本能把 legacy 内容分类到新结构, so that 我可以一次性把混乱的过去转成可审计的现在。

#### Acceptance Criteria

1. `[Harden]` THE Migration_Script SHALL read all Notes under `20_notes/`, `Personal OS Inbox/`, `Personal Wiki Mirror/`, `90_archive/legacy/` (if present) and classify each into one of `atom`, `project`, `journal`, `skill`, `source`, or `needs-review`.
2. `[Harden]` THE Migration_Script SHALL provide a `--dry-run` mode that prints the planned target path for every input file and writes nothing to disk.
3. `[Harden]` WHEN run with `--dry-run`, THE Migration_Script SHALL exit with code 0 if every legacy Note received a classification, and exit with code 1 if any Note remained unclassified.
4. `[Harden]` THE Migration_Script SHALL provide an `--apply` mode that performs the moves only after the user passes an explicit confirmation flag (e.g. `--yes`).
5. `[Harden]` IF the Migration_Script encounters a legacy Note for which classification confidence is below the configured threshold, THEN THE Migration_Script SHALL move the Note to `90_archive/needs-review/<original-relative-path>` and append the original path to a `migration-report.md` under `00_meta/`.
6. `[Harden]` WHEN the Migration_Script moves a legacy Note, THE Migration_Script SHALL backfill any missing Required_Frontmatter_Fields with best-effort values (`created_by=user`, `source_type=user-note`, `created_at` from file mtime, `type` from classification, `tags=[]`) and SHALL mark the Note with `migration: legacy-<batch-id>` in frontmatter so it is auditable later.
7. `[Harden]` THE Migration_Script SHALL produce a `migration-report.md` listing every moved file (source path → target path), every skipped file, and every Note dropped into `needs-review/`.
8. `[Harden]` IF the Migration_Script is interrupted mid-run, THEN re-running it with the same arguments SHALL resume safely and not re-move files already processed.
9. `[Harden]` THE Migration_Script SHALL leave `10_sources/` files untouched (in line with Requirement 7).

---

### Requirement 9: MOC 索引自动生成（MOC — Harden）

**User Story:** As a user, I want `00_meta/index.md` 始终反映最近内容, so that 我有一张全 Vault 的入口地图。

#### Acceptance Criteria

1. `[Harden]` THE MOC_Generator SHALL maintain `00_meta/index.md` containing sections for "最近的 Atoms"、"活跃项目"、"最近 Journal"、"Skills"、"待审 (needs-review)"、"孤儿任务".
2. `[Harden]` WHEN any Note is created or moved, THE MOC_Generator SHALL refresh `00_meta/index.md` within the same write request or within the same index refresh cycle.
3. `[Harden]` THE MOC_Generator SHALL list at most the 20 most recent items per section, sorted by `created_at` descending.
4. `[Harden]` THE MOC_Generator SHALL include in section "孤儿任务" every Note whose `task_id` does not resolve to a known Personal OS task (see Requirement 12 / P4).
5. `[Harden]` THE MOC_Generator SHALL NOT modify any field of `00_meta/index.md` beyond the auto-managed sections; it SHALL preserve any user-authored content delimited by `<!-- moc:user-block -->` markers.
6. `[Harden]` IF `00_meta/index.md` does not exist, THEN THE MOC_Generator SHALL create it on the first write event after Harden activation.

---

### Requirement 10: 标签治理（Tag Governance）

**User Story:** As a user, I want 一份维护中的标签字典 `00_meta/tags.md`, so that 不同 Agent 不会自创冲突的标签。

#### Acceptance Criteria

1. `[Harden]` THE Personal_Wiki SHALL treat `00_meta/tags.md` as the Tag_Registry and SHALL parse from it the set of approved tags and their definitions.
2. `[Harden]` WHEN an Ingest_API write contains a tag not present in Tag_Registry, THE Personal_Wiki SHALL accept the write but SHALL append the tag to a `pending tag review` section of `00_meta/tags.md` together with the requesting `created_by` and `task_id`.
3. `[Harden]` THE MOC_Generator SHALL surface the count of unreviewed tags in `00_meta/index.md`.
4. `[Harden]` IF a write contains a tag value that fails the registry's validation regex (default: `^[a-z0-9][a-z0-9\-]{0,40}$`), THEN THE Frontmatter_Validator SHALL reject the request with HTTP 400 and the offending tag.
5. `[MVP]` THE Personal_Wiki SHALL store tags case-folded so `Travel` and `travel` are treated as the same tag.

---

### Requirement 11: 向后兼容（Backward Compatibility）

**User Story:** As a maintainer, I want 旧的 `Personal OS Inbox/`、`Personal Wiki Mirror/` 内容在迁移前依然可读, so that 过渡期不破坏既有引用。

#### Acceptance Criteria

1. `[MVP]` WHILE the Migration_Script has not been applied, THE Personal_Wiki SHALL serve read requests for files under `Personal OS Inbox/` and `Personal Wiki Mirror/` exactly as before.
2. `[MVP]` THE Personal_Wiki SHALL NOT delete or rename any legacy Note as a side-effect of the new write rules.
3. `[MVP]` IF a legacy Note lacks the new frontmatter fields, THEN read endpoints SHALL still surface the Note in the index with `created_by=unknown` and `type=legacy` synthesized at read time only (not written back to disk).
4. `[Harden]` AFTER the Migration_Script has been applied, THE Personal_Wiki SHALL keep `Personal OS Inbox/` and `Personal Wiki Mirror/` empty (or absent) but SHALL retain their git history.
5. `[MVP]` WHEN any caller that was previously writing directly into `20_notes/` or `Personal OS Inbox/` calls the system after Cutover_Date, THE Personal_Wiki SHALL reject those direct writes if not channelled through Ingest_API (consistent with Requirement 3 AC1).

---

### Requirement 12: 边界情况与错误处理（Edge Cases）

**User Story:** As a user, I want 特殊和异常输入有明确的、可重复的处理规则, so that 我不会因为一个奇怪的字符或重复提交而丢数据或产生静默错误。

#### Acceptance Criteria

1. `[MVP]` IF `created_by` starts with `hermes:` AND `task_id` is missing, THEN THE Frontmatter_Validator SHALL reject the request (see Requirement 2 AC5; restated here for edge-case completeness).
2. `[MVP]` IF the `type` field has a value such as `atoms`、`Atom`、`PROJECT` (case or pluralization variants), THEN THE Frontmatter_Validator SHALL reject the request rather than coerce it.
3. `[MVP]` IF the `project` value contains characters not handled by the file system on Windows or Linux (e.g. `:`、`*`、`?`、`<`、`>`、`|`), THEN THE Slugifier SHALL strip them; the resulting slug SHALL still satisfy Requirement 4 AC8.
4. `[MVP]` WHEN `type=atom` AND the Note body exceeds 5,000 characters, THE Personal_Wiki SHALL accept the write but SHALL log a warning `atom-oversized title=<...> length=<...>`; classification is not changed automatically.
5. `[MVP]` WHEN an Agent re-submits a Note with the same `task_id` and same `type`, THE Personal_Wiki SHALL behave per Requirement 5 AC5 (revision suffix), not overwrite.
6. `[MVP]` WHEN a user manually edits an Agent-produced Note on disk and the index is refreshed, THE Personal_Wiki SHALL update `last_reviewed` to the file's mtime; it SHALL NOT modify `created_by` or `task_id`.
7. `[Harden]` IF a Note's `task_id` references a Personal OS task that no longer exists, THEN THE Personal_Wiki SHALL surface the Note in the MOC's "孤儿任务" section (see Requirement 9 AC4); it SHALL NOT auto-archive the Note.
8. `[MVP]` IF concurrent writes target the same file path, THEN serialization rules in Requirement 5 AC4 and Requirement 6 AC4 SHALL apply.
9. `[Harden]` IF the Migration_Script encounters a legacy Note with no plausible classification, THEN it SHALL fall through to `90_archive/needs-review/` per Requirement 8 AC5.
10. `[MVP]` IF an Ingest_API request includes both `task_id` and `agent_id`, but `agent_id` is empty string, THEN THE Frontmatter_Validator SHALL reject the request with HTTP 400 rather than silently drop the field.

---

### Requirement 13: 正确性属性（Correctness Properties — Property-Based Testing）

**User Story:** As a maintainer, I want 一组可被 property-based 测试覆盖的不变量, so that 我可以用大量随机输入证明系统在归属、路由、来源、标签、迁移上都不会偷偷破坏数据。

#### Acceptance Criteria

1. `[MVP] (P1 — Attribution Invariant)` FOR ALL Notes whose `created_at` is on or after Cutover_Date, THE Personal_Wiki SHALL guarantee that frontmatter satisfies Requirement 2 AC1–AC5; AND a query filtered by any non-empty `agent_id` SHALL never return a Note whose `created_by=user`.
2. `[MVP] (P2 — Folder/Type Consistency)` FOR ALL Notes in the Vault, THE Personal_Wiki SHALL guarantee:
   - `type=atom` → path starts with `20_atoms/` (Harden) or `90_archive/pending-harden/atom/` (MVP);
   - `type=project` → path starts with `30_projects/<slug>/`;
   - `type=journal` → path starts with `40_journals/`;
   - `type=skill` → path starts with `50_skills/` (Harden) or `90_archive/pending-harden/skill/` (MVP);
   - `type=source` → path starts with `10_sources/`.
3. `[MVP] (P3 — Source Immutability)` FOR ALL files under `10_sources/`, THE Personal_Wiki SHALL guarantee that no API path can modify or delete them after creation; only create operations are permitted (Requirement 7).
4. `[Harden] (P4 — task_id Traceability)` FOR ALL Notes with a non-empty `task_id`, THE Personal_Wiki SHALL guarantee that the MOC marks the Note as either resolved (task exists or is archived in Personal OS) or surfaced under "孤儿任务" (Requirement 9 AC4); no Note with `task_id` SHALL be silently dropped from indices.
5. `[Harden] (P5 — Tag Closure)` FOR ALL tags appearing in any Note, THE Personal_Wiki SHALL guarantee that the tag either appears in the approved section of `00_meta/tags.md` OR appears in the `pending tag review` section (Requirement 10 AC2); no third state is possible.
6. `[Harden] (P6 — Migration Idempotency)` FOR ALL Vault states `S` and migration arguments `A`, THE Migration_Script SHALL guarantee `migrate(migrate(S, A), A) == migrate(S, A)`; running the script twice produces the same Vault contents and the same `migration-report.md` summary as running it once.
7. `[MVP] (P7 — Round-trip Frontmatter)` FOR ALL valid Note inputs `N`, THE Personal_Wiki SHALL guarantee `parse(serialize(N)) ≡ N` on the Required_Frontmatter_Fields and Conditional_Frontmatter_Fields; this property SHALL be tested with a property-based test that generates random valid frontmatter and asserts round-trip equality after write+reread.
