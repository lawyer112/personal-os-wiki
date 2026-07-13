# intake-payload
Format: JSON
Top-level: object
Size: 6
Nested depth: 5

## Schema

- source: object (4 keys)
- agent: object (4 keys)
- project: object (4 keys)
- wikiNotes: array (1 items)
- tasks: array (1 items)
- projectEvents: array (1 items)

## Preview

```json
{
  "source": {
    "sourceType": "agent-output",
    "sourcePlatform": "cron/github-radar",
    "rawText": "GitHub 雷达运行：筛选 8 个 repo，生成 1 个候选任务。",
    "createdBy": "hermes"
  },
  "agent": {
    "model": "hermes-github-radar-script",
    "classification": {
      "kind": "github-radar",
      "repos": [
        "swarmclawai/swarmvault",
        "EverMind-AI/Raven",
        "dzhng/duet-agent",
        "Zhonghao1995/agentic-swmm-workflow",
        "willynikes2/knowledge-base-server",
        "AVIDS2/memorix",
        "mnemon-dev/mnemon",
        "caura-ai/caura-memclaw"
      ]
    },
    "reasoningSummary": "GitHub 雷达脚本检索开源 Personal OS/Wiki/Agent Memory/RAG 项目，抽取可吸收设计并转成 Agent 可执行任务。",
    "outputSummary": "已筛选 8 个 repo，写入 Wiki，并生成 1 个任务候选。"
  },
  "project": {
    "name": "Personal OS / Wiki 知识库升级",
    "status": "active",
    "priority": "P0",
    "currentFocus": "GitHub 外部方案转成 Agent 自驱执行闭环"
  },
  "wikiNotes": [
    {
      "title": "GitHub 知识雷达 2026-07-02 Personal OS Wiki 自驱候选",
      "frontmatter": {
        "title": "GitHub 知识雷达 2026-07-02 Personal OS Wiki 自驱候选",
        "type": "project",
        "created_by": "hermes:worker",
        "source_type": "agent-output",
        "tags": [
…
```