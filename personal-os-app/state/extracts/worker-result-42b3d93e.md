# worker-result
Format: JSON
Top-level: object
Size: 6
Nested depth: 2

## Schema

- taskId: string
- status: string
- artifacts: object (2 keys)
- subtasksCreated: number
- summary: string
- next: string

## Preview

```json
{
  "taskId": "cmqrtcdz0002o0jo8iprtzp0a",
  "status": "completed",
  "artifacts": {
    "evaluationNote": ".agent-runs/cmqrtcdz0002o0jo8iprtzp0a/swarmvault-evaluation.md",
    "repoJson": ".agent-runs/cmqrtcdz0002o0jo8iprtzp0a/repo.json"
  },
  "subtasksCreated": 2,
  "summary": "SwarmVault 评估完成。结论：值得吸收混合检索设计（RRF + manifest + doctor）和 ProviderAdapter 抽象；不值得直接依赖引擎库。",
  "next": "post intake with wiki note + subtasks"
}

```