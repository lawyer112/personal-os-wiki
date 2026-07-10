# Personal OS API Stability Contract v0

This document defines the v0 compatibility surface for Personal OS agents and fallback workers. The machine-readable source is `tests/fixtures/api_stability_contract_v0.json`; `tests/services/api_stability_contract.test.ts` keeps this document and the current schemas aligned.

## Goals

- Give Codex, Hermes, and launchd fallback workers a stable set of fields to depend on.
- Mark newer context pack fields as experimental until they have enough production history.
- Keep implementation diagnostics internal so worker prompts do not depend on debug-only shapes.
- Avoid leaking concrete tokens, cookies, SMTP secrets, private emails, or `.env` contents into contract artifacts.

## Stability Tiers

`stable` fields are safe for routine automation. They can receive additive fields, but removal, rename, or semantic narrowing requires deprecation.

`experimental` fields are useful and returned by current APIs, but they may change while the feature matures. Experimental changes must not break stable fields.

`internal` fields are diagnostics or implementation details. They may change without compatibility guarantees and must not be required by worker prompts.

`deprecated` fields are retained temporarily. Removing a deprecated field requires at least 14 days of notice, a contract test update, a migration note, and Personal OS writeback.

## GET /api/agent/context

Purpose: return task or keyword context for Codex, Hermes, and fallback workers.

Stable query parameters:

- `taskId`
- `q`

Experimental query parameters:

- `budget`

Stable response envelope:

- `ok`
- `context`

Stable `context` fields:

- `generatedAt`
- `task`
- `searchQueries`
- `wiki`
- `recentTasks`
- `relatedIdeas`
- `activity`
- `evidence`
- `nextAction`
- `tiers`
- `policy`

Experimental `context` fields:

- `swarmvault`
- `queryPlan`
- `requiredRefs`
- `memoryItems`
- `tokenBudget`
- `budget`
- `cited`
- `omissions`

Internal `context` fields:

- `debug`

Compatibility tests:

- `tests/routes/agent-context-route.test.ts`
- `tests/services/agent-context.test.ts`
- `tests/services/api_stability_contract.test.ts`

## POST /api/agent/context

Purpose: run scoped hybrid recall and optionally require exact, versioned Wiki evidence.

Stable request body fields:

- `query`

Experimental request body fields:

- `scope`
- `required_refs`
- `top_k`
- `budget`

Each required reference may select a `memory_id` or Wiki `path`, an optional `version`, and an optional Markdown heading `chunk_id`. Missing, retracted, superseded, or version-mismatched required evidence fails with HTTP 422 unless `on_missing` is explicitly `omit`.

Compatibility tests:

- `tests/routes/agent_context_post.test.ts`
- `tests/services/agent-context.test.ts`
- `tests/services/api_stability_contract.test.ts`

## POST /api/intake

Purpose: record agent, user, project, task, idea, note, notification, and Wiki write intents.

Stable request body fields:

- `source`
- `agent`
- `project`
- `wikiNotes`
- `tasks`
- `ideas`
- `projectEvents`
- `notes`
- `notification`

Experimental request body fields:

- `taskProposals`

Stable response body fields:

- `ok`
- `inbox`
- `agentRunId`
- `project`
- `tasks`
- `ideas`
- `notes`
- `projectEvents`
- `wiki`
- `wiki_write_status`
- `notification`

Experimental response body fields:

- `taskProposals`

Stable `wiki_write_status` fields:

- `status`
- `requested`
- `succeeded`
- `failed`
- `errors`

Experimental `wiki_write_status` fields:

- `queued`
- `job_ids`

Compatibility tests:

- `tests/routes/intake-wiki-fallback.test.ts`
- `tests/services/api_stability_contract.test.ts`

## GET /api/wiki-write-jobs

Purpose: expose non-sensitive Wiki write diagnostics derived from AgentRun classifications.

Stable query parameters:

- `taskId`
- `q`
- `limit`

Stable response body fields:

- `ok`
- `count`
- `filters`
- `statusCounts`
- `jobs`

Stable job fields:

- `id`
- `runId`
- `status`
- `requested`
- `queued`
- `succeeded`
- `failed`
- `taskIds`
- `model`
- `sourcePlatform`
- `summary`
- `startedAt`
- `completedAt`

Experimental job fields:

- `review`
- `candidate`

`review` and `candidate` are read-only candidate review PoC fields. They may include a candidate queue status, structured diff summary, sanitized evidence links, and disabled promote/archive decision drafts. They must not auto-approve, mutate Personal Wiki, or expose concrete credentials or private mailbox details.

The `summary` field is stable as a sanitized diagnostic summary, not as raw log storage. It must not expose concrete credentials or private mailbox details.

Compatibility tests:

- `tests/routes/wiki-write-jobs.test.ts`
- `tests/services/api_stability_contract.test.ts`

## scripts/agent-writeback.mjs

Purpose: submit or contribute worker results to Personal OS without approving the task.

Stable CLI flags:

- `--agent-id`
- `--task-id`
- `--summary`
- `--evidence`
- `--artifact`
- `--next`
- `--contribute`
- `--submit`
- `--dod-met`
- `--dod-not-met`

Experimental CLI flags:

- `--archive-context-pack`
- `--archive-target-task-id`
- `--archive-run-dir`
- `--archive-out`
- `--archive-project-name`

Internal CLI flags:

- `--token`
- `--base-url`

Stable contribution body fields:

- `agentId`
- `summary`
- `evidenceLinks`
- `artifactUrls`
- `nextRecommendation`

Stable submit body fields:

- `agentId`
- `summary`
- `evidenceLinks`
- `artifactUrls`
- `nextRecommendation`
- `resultType`
- `definitionOfDoneMet`
- `needsHumanDecision`

Stable writeback result fields:

- `ok`
- `mode`
- `taskId`
- `result`

Experimental writeback result fields:

- `archive`

Automation workers must not call `--approve`. Final task approval remains a user or independent verifier decision.

Compatibility tests:

- `tests/services/agent_writeback.test.ts`
- `tests/services/api_stability_contract.test.ts`

## Personal Wiki frontmatter

Purpose: metadata contract for direct Wiki ingest and Personal OS `wikiNotes` writes.

Stable frontmatter fields:

- `title`
- `type`
- `created_by`
- `source_type`
- `tags`
- `created_at`
- `task_id`
- `agent_id`
- `project`

Experimental frontmatter fields:

- `last_reviewed`
- `migration`

Allowed `created_by` values for this Personal OS contract are:

- `user`
- `hermes:intake`
- `hermes:dispatcher`
- `hermes:worker`

Allowed `source_type` values are:

- `user-note`
- `article`
- `transcript`
- `agent-output`

When `created_by` starts with `hermes:`, `task_id` is required and must be non-empty. `tags` should remain between two and six stable tags. Wiki notes should store conclusions, decisions, evidence, and next steps rather than raw chat logs.

Stable ingest result fields:

- `ok`
- `title`
- `status`
- `note_path`
- `url`
- `error`

Compatibility tests:

- `tests/services/wiki-ingest.test.ts`
- `tests/services/api_stability_contract.test.ts`

## Change Process

1. Update `tests/fixtures/api_stability_contract_v0.json`.
2. Update this document.
3. Add or adjust the narrowest compatibility test that protects the change.
4. Run the contract test and the touched route or service tests.
5. Write back the change to Personal OS or Personal Wiki with evidence paths.

Stable removals are not allowed in v0 without first moving the field to `deprecated`, publishing a migration note, and waiting at least 14 days.
