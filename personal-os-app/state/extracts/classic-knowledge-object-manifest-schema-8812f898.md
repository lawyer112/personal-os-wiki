# classic-knowledge-object-manifest.schema
Format: JSON
Top-level: object
Size: 9
Nested depth: 9

## Schema

- $schema: string
- $id: string
- title: string
- description: string
- type: string
- additionalProperties: boolean
- required: array (17 items)
- properties: object (20 keys)
- allOf: array (3 items)

## Preview

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://classic.local/schemas/classic-knowledge-object-manifest.schema.json",
  "title": "Classic Knowledge Object Manifest v0",
  "description": "A provenance-first manifest for Classic knowledge objects. Every task, project, evidence, decision, SOP, status record, context pack, and project hub must carry source_path, hash, freshness, and sensitivity metadata; objects without a source must be explicitly marked speculative.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "id",
    "type",
    "title",
    "summary",
    "source_path",
    "source_url",
    "source_type",
    "hash",
    "freshness",
    "sensitivity",
    "owner",
    "created_at",
    "updated_at",
    "confidence",
    "lifecycle",
    "relationships"
  ],
  "properties": {
    "schema_version": {
      "const": "classic-knowledge-object-manifest/v0"
    },
    "id": {
      "type": "string",
      "minLength": 3,
      "pattern": "^(task|project|evidence|decision|sop|project_hub|status|context_pack|agent_run|idea|note):[A-Za-z0-9._:/#-]+$",
      "description": "Stable object id prefixed by object type, for example task:<personal-os-task-id>."
    },
    "type": {
      "type": "string",
      "enum": [
        "task",
…
```