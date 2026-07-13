# gate
Format: JSON
Top-level: object
Size: 3
Nested depth: 2

## Schema

- status: string
- tests: object (4 keys)
- healthCheck: object (4 keys)

## Preview

```json
{
  "status": "pass",
  "tests": {
    "agent-context.test.ts": "9 passed",
    "tsc": "clean",
    "lint": "clean",
    "build": "production build succeeded (Docker)"
  },
  "healthCheck": {
    "apiOk": true,
    "evidenceField": true,
    "episodesCount": 6,
    "tiersOk": true
  }
}

```