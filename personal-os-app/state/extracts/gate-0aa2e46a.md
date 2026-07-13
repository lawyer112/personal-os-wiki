# gate
Format: JSON
Top-level: object
Size: 6
Nested depth: 3

## Schema

- taskId: string
- generatedAt: string
- status: string
- checks: array (8 items)
- residualRisk: array (2 items)
- synthesizer: object (1 keys)

## Preview

```json
{
  "taskId": "cmqq4eq8z00320jmjaef38k5t",
  "generatedAt": "2026-06-23T06:59:30Z",
  "status": "pass",
  "checks": [
    {
      "name": "dependency install",
      "command": "npm ci",
      "status": "pass",
      "evidence": "added 499 packages; npm audit reported existing vulnerabilities but install completed"
    },
    {
      "name": "prisma client generation",
      "command": "DATABASE_URL=<dummy local value> npm run prisma:generate",
      "status": "pass",
      "evidence": "Generated Prisma Client (v7.7.0) to ./node_modules/@prisma/client"
    },
    {
      "name": "unit tests",
      "command": "npm test -- tests/services/wiki-client.test.ts tests/services/agent-context.test.ts",
      "status": "pass",
      "evidence": "2 test files passed; 8 tests passed"
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "status": "pass",
      "evidence": "eslint . exited 0"
    },
    {
      "name": "typecheck",
      "command": "npx tsc --noEmit --pretty false",
      "status": "pass",
      "evidence": "tsc exited 0"
    },
    {
      "name": "direct Personal Wiki fetch cleanup",
      "command": "search src for fetch(wikiUrl(",
      "status": "pass",
      "evidence": "0 matches"
…
```