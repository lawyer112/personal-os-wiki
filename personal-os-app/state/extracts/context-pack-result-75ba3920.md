# context-pack-result
Format: JSON
Top-level: object
Size: 8
Nested depth: 1

## Schema

- ok: boolean
- targetTaskId: string
- archiveTaskId: string
- out: string
- runDir: string
- taskTitle: string
- gateStatus: string
- intake: null

## Preview

```json
{
  "ok": true,
  "targetTaskId": "cmqqb0d7h00050jnsh6q221l1",
  "archiveTaskId": "cmqqfl6rk00090jn58kastmq9",
  "out": ".agent-runs/cmqqfl6rk00090jn58kastmq9/artifacts/context-pack-sample-cmqqb0d7h00050jnsh6q221l1",
  "runDir": ".agent-runs/cmqqb0d7h00050jnsh6q221l1",
  "taskTitle": "实现 wikiClient 读写分离抽象并补齐 401 / 降级测试",
  "gateStatus": "pass",
  "intake": null
}

```