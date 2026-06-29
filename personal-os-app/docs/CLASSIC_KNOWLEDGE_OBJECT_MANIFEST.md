# Knowledge Object Manifest v0

This manifest is the first guardrail for turning the operator's Personal OS / Wiki records into reusable knowledge objects without losing evidence.

Source: `docs/sources/personal-os-evolution-council-report-v1-excerpt.md`, excerpted from `private-source/personal-os-evolution-council-report-v1.md` lines 6-14, 31-38 and 121-126.

## Scope

Use this schema for:

- `task`
- `project`
- `evidence`
- `decision`
- `sop`
- `project_hub`
- `status`
- `context_pack`
- `agent_run`
- `idea`
- `note`

## Required traceability

Every object must carry:

- `id`: stable typed id, for example `task:<personal-os-task-id>`.
- `type`: one of the supported knowledge object types.
- `source_path`: canonical local source path, or `null` only for speculative drafts.
- `hash`: `sha256` or `sha1` content hash of `source_path`; must be `null` for speculative objects without a source.
- `freshness`: captured time, TTL, `valid_until`, and last check state.
- `sensitivity`: public/internal/private/secret boundary plus allowed uses.
- `owner`: user / agent / system / external owner.
- `confidence`: `verified`, `inferred`, or `speculative`.
- `relationships`: project/task/run links plus supersession links.

Objects without a source are not facts. They must set:

```json
{
  "source_path": null,
  "hash": null,
  "confidence": "speculative"
}
```

## Files

- Schema: `schemas/classic-knowledge-object-manifest.schema.json`
- Examples:
  - `examples/knowledge-objects/task.classic-knowledge-object.json`
  - `examples/knowledge-objects/decision.classic-knowledge-object.json`
  - `examples/knowledge-objects/sop.classic-knowledge-object.json`
- Lint script: `scripts/lint-classic-knowledge-object-manifest.mjs`
- Portable source excerpt: `docs/sources/personal-os-evolution-council-report-v1-excerpt.md`

## Lint checks

The lint script implements the minimum checks from the council report:

1. `required-field-missing`: object lacks required manifest fields.
2. `source-missing`: `source_path` does not exist.
3. `hash-changed`: current source file hash differs from manifest hash.
4. `ttl-expired`: `freshness.valid_until` is past due.
5. `owner-missing`: `owner.type` or `owner.id` is absent.
6. `decision-superseded`: a decision has `superseded_by` but is not marked `lifecycle.status=superseded`.
7. `sensitivity-violation`: secret-bearing objects are not marked `secret`, or secret objects are allowed into unsafe uses.
8. `no-source-must-be-speculative`: no-source objects are not explicitly speculative.

## Local verification

From `personal-os-app`:

```bash
node scripts/lint-classic-knowledge-object-manifest.mjs examples/knowledge-objects/*.json
npm test -- tests/services/knowledge-manifest.test.ts
```

This is a schema/manifest guardrail. It does not write the production database. The source excerpt is checked into the repo so the shipped examples can be linted both locally and on 6.37.
