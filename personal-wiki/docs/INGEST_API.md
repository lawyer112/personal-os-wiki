# Personal Wiki Ingest API

## Request

`POST /api/ingest`

Headers:

- `Authorization: Bearer <WIKI_API_TOKEN>`
- `Content-Type: application/json`

Body:

```json
{
  "frontmatter": {
    "title": "东京交通整理",
    "type": "project",
    "created_by": "hermes:worker",
    "task_id": "task_abc123",
    "agent_id": "worker-001",
    "project": "2026-05 东京行",
    "source_type": "agent-output",
    "tags": ["travel", "tokyo", "transit"],
    "created_at": "2026-05-13T10:00:00+08:00"
  },
  "content": "## Summary\n\nMarkdown body..."
}
```

## Frontmatter Fields

| Field | Required | Notes |
|---|---:|---|
| `title` | yes | Non-empty note title. |
| `type` | yes | One of `atom`, `project`, `journal`, `skill`, `source`. |
| `created_by` | yes | One of `user`, `hermes:intake`, `hermes:dispatcher`, `hermes:worker`. |
| `source_type` | yes | One of `user-note`, `article`, `transcript`, `agent-output`. |
| `tags` | yes | Array of strings; may be empty. Tags are lowercased and deduplicated. |
| `created_at` | yes | ISO-8601 with timezone. If omitted, the server fills current UTC time. |
| `task_id` | conditional | Required when `created_by` starts with `hermes:`. |
| `agent_id` | optional | If present, it must not be an empty string. |
| `project` | conditional | Required when `type=project`. |

## Success Response

```json
{
  "status": "created",
  "path": "30_projects/2026-05-东京行/东京交通整理.md",
  "directory": "30_projects/2026-05-东京行",
  "task_id": "task_abc123",
  "url": "http://wiki.local/note?path=30_projects%2F2026-05-%E4%B8%9C%E4%BA%AC%E8%A1%8C%2F%E4%B8%9C%E4%BA%AC%E4%BA%A4%E9%80%9A%E6%95%B4%E7%90%86.md"
}
```

Possible `status` values:

- `created`
- `revision`
- `journal-rolled`

## Routing

`/api/ingest` computes the vault path from frontmatter. Callers cannot provide
or override a target path.

| `type` | Default Harden path |
|---|---|
| `source` | `10_sources/<YYYY-MM-DD>/<title_slug>.md` |
| `project` | `30_projects/<project_slug>/<title_slug>.md` |
| `journal` | `40_journals/<YYYY-MM-DD>.md` |
| `atom` | `20_atoms/<title_slug>.md` |
| `skill` | `50_skills/<title_slug>.md` |

`WIKI_HARDEN_PATHS_ENABLED` defaults to enabled. If explicitly set to
`0`, `false`, `no`, or `off`, `atom` and `skill` keep the MVP quarantine
paths:

- `90_archive/pending-harden/atom/<title_slug>.md`
- `90_archive/pending-harden/skill/<title_slug>.md`

## Error Response

All errors use the same shape:

```json
{
  "error": "task-id-required-for-agent",
  "code": "task-id-required-for-agent",
  "details": { "created_by": "hermes:worker" }
}
```

Error codes:

| HTTP | Code | Trigger |
|---:|---|---|
| 400 | `invalid-json` | Request body is not valid JSON. |
| 400 | `frontmatter-parse-error` | `frontmatter` is missing, malformed, or cannot be parsed. |
| 400 | `frontmatter-missing-fields` | One or more required fields are missing. |
| 400 | `invalid-type` | `type` is not one of the allowed lowercase values. |
| 400 | `invalid-created-by` | `created_by` is outside the allowed set. |
| 400 | `task-id-required-for-agent` | `created_by=hermes:*` without `task_id`. |
| 400 | `project-field-required` | `type=project` without `project`. |
| 400 | `agent-id-empty-string` | `agent_id` is present but empty. |
| 400 | `invalid-source-type` | `source_type` is outside the allowed set. |
| 400 | `invalid-timestamp` | `created_at` has no timezone or is not ISO-8601. |
| 400 | `invalid-tag-format` | One or more tags do not match `[a-z0-9][a-z0-9-]{0,40}` after normalization. |
| 401 | `missing-or-invalid-token` | Missing or wrong bearer token. |
| 409 | `source-immutable` | A `source` note would overwrite an existing source path. |
| 413 | `body-too-large` | Body exceeds `WIKI_MAX_BODY_BYTES` (default 2 MB). |
| 503 | `lock-timeout` | Project, journal, or migration lock wait timed out. |

The validation contract includes these frontmatter error codes:
`frontmatter-parse-error`, `frontmatter-missing-fields`, `invalid-type`,
`invalid-created-by`, `task-id-required-for-agent`,
`project-field-required`, `agent-id-empty-string`,
`invalid-source-type`, and `invalid-timestamp`.

## Tag Registry

The API keeps a registry at `00_meta/tags.md`.

- Tags are normalized by lowercasing, deduplicating, and removing a leading
  `#`.
- Tags must match `[a-z0-9][a-z0-9-]{0,40}`.
- Existing tags can appear in either the approved or pending registry section.
- A valid but previously unseen tag is appended to the pending section with
  `created_by`, `task_id`, and first-seen timestamp.
- Invalid tags are rejected with `invalid-tag-format` and the note is not
  written.

## Logging

Each ingest attempt writes one JSON log line on logger `personal_wiki.ingest`.

Fields:

- `ts`
- `event=ingest`
- `outcome=accepted|rejected`
- `task_id`
- `created_by`
- `type`
- `path`
- `duration_ms`
- `reason` when rejected

Tokens and request bodies are never logged.

## Examples

```bash
curl -X POST "$PERSONAL_WIKI_BASE_URL/api/ingest" \
  -H "Authorization: Bearer $WIKI_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "frontmatter": {
      "title": "东京交通整理",
      "type": "project",
      "created_by": "hermes:worker",
      "task_id": "task_abc123",
      "agent_id": "worker-001",
      "project": "2026-05 东京行",
      "source_type": "agent-output",
      "tags": ["travel", "tokyo"]
    },
    "content": "## Summary\n\n交通方案已整理。"
  }'
```

```ts
await ingestWikiNote({
  frontmatter: {
    title: "东京交通整理",
    type: "project",
    created_by: "hermes:worker",
    task_id: "task_abc123",
    agent_id: process.env.AGENT_ID,
    project: "2026-05 东京行",
    source_type: "agent-output",
    tags: ["travel", "tokyo"],
  },
  content: "## Summary\n\n交通方案已整理。",
});
```
