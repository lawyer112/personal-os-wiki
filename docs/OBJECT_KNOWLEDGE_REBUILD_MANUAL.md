# Object Knowledge Rebuild Manual

This manual records the current product decision: stop treating Personal Wiki as
only a Markdown note browser, and rebuild it toward an agent-maintained object
knowledge system.

Short version:

```text
Wiki stores projects, tools, workflows, decisions, evidence, and relationships.
Personal OS schedules agent work against that knowledge, tracks execution,
collects evidence, and sends results through review.
```

## Current Decision

Keep the repository as a monorepo for now:

```text
personal-os-wiki/
  personal-os-app/   work state, tasks, agent execution, review, reminders
  personal-wiki/     Markdown vault, knowledge objects, graph, evidence, browsing
  docs/              agent manuals, deployment docs, product direction
```

One repository and one release package is still the right public shape. Runtime
deployment remains multiple services: Personal OS, Personal Wiki, and Postgres.

Do not split repositories yet. Splitting is a later packaging decision after the
OS/Wiki/API boundaries are stable and real users want only one component.

## Why Rebuild The Knowledge Layer

The current Wiki already has ingest, search, tags, concepts, backlinks, and a
graph. The weak points are semantic:

- Note types are not explicit enough.
- Graph relationships rely too much on wikilinks, shared concepts, and shared tags.
- Users can see edges, but not always why they exist.
- A global graph is noisy without local object views.
- There is no first-class Wiki lint queue for orphan notes, weak titles,
  generic tags, missing source evidence, stale conclusions, or missing project pages.
- Agents can write Wiki notes, but the object schema is not strict enough.

The goal is not only to make the graph prettier. The goal is to change the model:

```text
Markdown pages -> knowledge objects
graph lines -> typed, scored, explainable relationships
raw ingest -> reviewable knowledge-maintenance work
```

## Product Principles

1. Humans provide low-friction input: links, transcripts, files, and rough thoughts.
2. Agents classify, summarize, tag, link, and extract work after capture.
3. Wiki stores durable reusable knowledge, not raw chat garbage.
4. Personal OS stores task truth and execution state, not long-form knowledge.
5. Agents must leave structured traces: source, classification reason,
   relationship reason, confidence, missing information, and review needs.
6. Work ships in small batches: two to four coherent tasks, local verification,
   commit, push, CI, then the next batch.

## Target Model

```text
Source
  raw input, links, files, transcripts, webpages

KnowledgeObject
  project / tool / service / workflow / decision / evidence / concept / person / task-note

Relationship
  explicit_link / same_source / same_project / supports / contradicts /
  implements / depends_on / evidence_for / replaced_by / similar_to

LintIssue
  orphan / duplicate / weak_title / missing_source / stale / private_data_risk /
  missing_project_page / missing_workflow / weak_relation

AgentTask
  generated from lint, gaps, user input, and project progress; managed by Personal OS
```

Markdown remains the durable readable format. Frontmatter makes it machine
understandable.

## Initial Wiki Object Schema

```yaml
---
title: "OCR option evaluation"
type: "project | tool | service | workflow | decision | evidence | concept | source | task-note"
status: "draft | active | verified | stale | archived"
projects: ["document automation"]
entities: ["OCR", "PaddleOCR", "MinerU"]
sources:
  - "source:2026-04-30-ocr-link"
related_tasks:
  - "task:..."
confidence: 0.72
last_verified: "2026-04-30"
owner: "agent | human | mixed"
privacy: "public-demo | private | sensitive"
---
```

Do not require a perfect migration on day one. New and newly-curated notes
should follow the schema first.

## Graph Model V2

Relationships should use multiple signals:

| Signal | Meaning | Default strength |
| --- | --- | --- |
| Explicit wikilink | A deliberate `[[...]]` link | High |
| Same source | Objects came from the same source or ingest batch | High |
| Same project | Objects belong to the same project | High |
| OS task evidence | A task artifact/evidence points to the Wiki object | High |
| Type affinity | Workflow-tool, decision-evidence, project-service, etc. | Medium |
| Shared entity | Shared tool, service, person, or concept | Medium |
| Shared tag | Weak ranking signal only | Low |

Edges must explain themselves:

```json
{
  "type": "same_project",
  "score": 0.84,
  "reason": {
    "shared_projects": ["document automation"],
    "shared_sources": ["source:ocr-comparison"],
    "explicit_links": ["[[PaddleOCR]]"]
  }
}
```

If users cannot see why two objects are related, the graph is not doing its job.

## UI Direction

The global graph stays, but it should not be the main interaction surface.

Priority views:

| View | Purpose |
| --- | --- |
| Object page | Structured project/tool/workflow/evidence page |
| Local graph | Current object plus 1-2 hops, with weak edges filtered out |
| Related reasons | Explain why every related item appears |
| Gap list | Missing project pages, missing sources, stale conclusions, missing workflows |
| Maintenance queue | Wiki lint issues that can become OS tasks |
| Project knowledge page | Tools, decisions, evidence, tasks, and workflows for one project |

## OS Integration

Wiki problems should become executable Personal OS tasks:

```text
Wiki lint finds a problem
  -> Personal OS creates an agent_task
  -> an agent claims the task by capability
  -> the agent fixes Wiki/source/project/workflow/evidence
  -> the agent submits evidence
  -> review approves or rejects
  -> Wiki graph and object status update
```

This is the product wedge: the knowledge base produces maintainable work, and
agents can execute it with evidence.

## First Work Batches

1. Define the Wiki object frontmatter schema.
2. Add schema docs and example notes.
3. Parse frontmatter fields in Personal Wiki.
4. Include `type`, `status`, `projects`, `sources`, `confidence`, and
   `last_verified` in the graph API.
5. Rewrite relationship scoring with same-source, same-project, and type affinity.
6. Expose relationship `reason` in graph data and UI.
7. Add local graph API: `/api/graph?focus=<path>&depth=2&min_score=0.5`.
8. Add Wiki lint report for orphan notes, generic tags, missing sources, missing
   object type, and missing project pages.
9. Turn lint issues into claimable Personal OS tasks.
10. Update the demo to show one object becoming task, evidence, and review.

## Commit Cadence

Ship small coherent batches:

```text
Batch 1: docs/schema only
Batch 2: parser and graph metadata
Batch 3: relation scoring v2
Batch 4: local graph API
Batch 5: Wiki lint report
Batch 6: OS task generation from lint
Batch 7: UI polish and demo
```

Each batch should end with:

```text
git diff --check
npm test                 # if personal-os-app changed
npm run typecheck        # if TypeScript changed
python -m py_compile     # if personal-wiki changed
python -m unittest       # if Wiki tests changed
git commit
git push
gh run watch
```

## Non-Goals

- Do not split the repository yet.
- Do not build a hosted SaaS in this phase.
- Do not publish real private vault data.
- Do not migrate every old note in one giant edit.
- Do not let agents bypass review for high-risk work.
- Do not try to replace Obsidian, Logseq, Notion, or every editor.
- Do not optimize for flashy graph animation before semantic correctness.

## Acceptance Criteria

This rebuild succeeds when:

- New notes have explicit object types.
- Relationships explain why they exist.
- Weak edges stop polluting the graph.
- A project page can show related tools, decisions, evidence, tasks, and workflows.
- Wiki lint exposes maintenance issues.
- Maintenance issues can become Personal OS tasks.
- Agents can claim those tasks and submit evidence.
- Approved work makes Wiki and OS more accurate.

Final target:

```text
the user drops raw input
  -> agents curate object knowledge
  -> knowledge gaps become tasks
  -> agents execute
  -> evidence is reviewed
  -> Wiki and OS both improve
```
