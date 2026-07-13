# gate
Format: JSON
Top-level: object
Size: 9
Nested depth: 4

## Schema

- task_id: string
- status: string
- reviewer: object (3 keys)
- verifier: object (3 keys)
- wiki_writeback: object (3 keys)
- deployment: object (4 keys)
- production_regression: object (2 keys)
- synthesizer: object (3 keys)
- writeback: object (3 keys)

## Preview

```json
{
  "task_id": "cmqqb0ddq00080jnsxuwdqoa5",
  "status": "pass",
  "reviewer": {
    "status": "pass",
    "findings": [],
    "notes": "Dependabot config validated by GitHub CI. No secrets leaked. Requirements.txt is declarative."
  },
  "verifier": {
    "status": "pass",
    "commands": [
      {
        "cmd": "npm audit",
        "exit_code": 0,
        "evidence": "0 vulnerabilities"
      },
      {
        "cmd": "npx tsc --noEmit",
        "exit_code": 0,
        "evidence": "no errors"
      },
      {
        "cmd": "npm run build",
        "exit_code": 0,
        "evidence": "build success"
      },
      {
        "cmd": "npm test",
        "exit_code": 0,
        "evidence": "20 passed (78 tests)"
      },
      {
        "cmd": "GitHub Actions CI verify job",
        "exit_code": 0,
        "evidence": "https://github.com/lawyer112/personal-os-wiki/actions/runs/28038332124"
      }
    ],
    "screenshots": []
  },
  "wiki_writeback": {
…
```