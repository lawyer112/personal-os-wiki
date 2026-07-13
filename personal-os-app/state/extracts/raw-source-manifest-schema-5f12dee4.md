# raw-source-manifest.schema
Format: JSON
Top-level: object
Size: 8
Nested depth: 6

## Schema

- $schema: string
- $id: string
- title: string
- type: string
- required: array (5 items)
- additionalProperties: boolean
- properties: object (5 keys)
- $defs: object (4 keys)

## Preview

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://classic.local/schemas/raw-source-manifest.schema.json",
  "title": "Classic Raw Source Manifest v0",
  "type": "object",
  "required": ["manifest_version", "generated_at", "root", "entries", "events"],
  "additionalProperties": false,
  "properties": {
    "manifest_version": {
      "const": "raw-manifest-v0"
    },
    "generated_at": {
      "type": "string",
      "format": "date-time"
    },
    "root": {
      "type": "string",
      "minLength": 1
    },
    "entries": {
      "type": "array",
      "items": { "$ref": "#/$defs/entry" }
    },
    "events": {
      "type": "array",
      "items": { "$ref": "#/$defs/event" }
    }
  },
  "$defs": {
    "sha256": {
      "type": "string",
      "pattern": "^sha256:[a-f0-9]{64}$"
    },
    "decision": {
      "enum": ["ingest", "skip", "update"]
    },
    "entry": {
      "type": "object",
      "required": [
        "source_id",
…
```