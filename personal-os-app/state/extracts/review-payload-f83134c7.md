# review-payload
Format: JSON
Top-level: object
Size: 3
Nested depth: 1

## Schema

- reviewer: string
- decision: string
- comment: string

## Preview

```json
{
  "reviewer": "hermes",
  "decision": "approve",
  "comment": "验证通过：source-ledger/evidence.md、repos.json、adoption-tasks.json 已产出；npm install 与 npm run lint 通过；已通过 /api/intake 写回并提交 review。批准关闭。"
}
```