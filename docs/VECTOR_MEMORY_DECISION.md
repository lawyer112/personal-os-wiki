# Vector Memory And Plan Decision

This note explains where vector embeddings fit in Personal OS + Personal Wiki and when a paid agent plan that includes hosted embeddings is worth using.

## Short Decision

Personal OS + Personal Wiki does not require hosted vector embeddings for the current core loop.

The core product value is:

```text
capture -> Wiki evidence -> explicit task -> agent claim -> evidence -> review
```

That loop currently works with structured APIs, tags, source links, task IDs, status fields, reviews, and keyword search. Vector search is an optional retrieval upgrade, not the source of truth.

## What Vector Memory Is For

A vector model turns text into embeddings so the system can retrieve semantically similar context even when the words do not match exactly.

Useful examples:

| User asks | Keyword search may miss | Vector search should retrieve |
| --- | --- | --- |
| "How do agents keep working by themselves?" | docs that say `autodrive`, `claim`, `heartbeat`, `executor` | agent job orchestration, task claiming, cron/autodrive docs |
| "What broke in the automation loop?" | files that do not contain `automation loop` | trigger fixes, executor notes, agent-run context packs |
| "What did we decide about memory?" | notes using `Wiki`, `evidence`, `context pack`, `RAG` | memory boundary and knowledge-system design notes |

## What It Is Not For

Vector memory should not replace:

- task status;
- task ownership;
- claim leases;
- review decisions;
- source provenance;
- explicit Wiki links;
- audit logs.

Those are structured work-state records. They should stay in Personal OS and Personal Wiki, not disappear into an opaque memory layer.

## Current Baseline

The repository's public baseline is keyword/metadata search plus graph-style Wiki relationships. This is enough for:

- known task IDs;
- known project names;
- tags and concepts;
- recent activity;
- source-backed Wiki notes;
- reviewable agent runs.

For most local single-user deployments, this baseline is the right default because it is cheaper, easier to debug, and does not require a hosted embedding provider.

## When Hosted Embeddings Are Worth Paying For

Use a hosted vector model only when at least one of these is true:

1. The Wiki has enough documents that keyword search regularly misses useful context.
2. The user asks natural-language questions whose wording differs from the stored notes.
3. Agent workers need to assemble context packs across projects, sources, and old runs.
4. The system can show a measurable improvement over keyword search on a small benchmark.

Minimum benchmark before paying for embeddings:

| Check | Required result |
| --- | --- |
| Smoke test | embedding API returns a vector dimension and latency without leaking tokens |
| Recall comparison | at least 10 real queries compare keyword vs hybrid retrieval |
| Citation quality | returned context includes source note/task/run IDs |
| Cost visibility | monthly token/call estimate is documented |
| Fallback | keyword search still works when embedding provider is unavailable |

## Plan Recommendation

If choosing between a coding-focused plan and an agent plan only because the agent plan includes hosted embeddings:

```text
Choose the coding-focused plan first.
```

Reason: the immediate work is implementation, deployment, documentation, testing, review, and GitHub readiness. Hosted embeddings become worth paying for only after the hybrid retrieval benchmark proves that semantic recall changes real outcomes.

## Implementation Direction

When vector search is added, keep it as a hybrid retrieval layer:

```text
query
  -> keyword / metadata candidates
  -> optional embedding candidates
  -> rerank
  -> context pack with citations
```

Do not let agents read raw vector hits without citations. Every returned chunk should link back to a Wiki note, task, source, or agent-run artifact.

## Public Product Positioning

This project is not selling "vector memory" as the core feature. Its wedge is the execution contract:

```text
unfinished work + evidence + review + agent handoff
```

Vector retrieval is a useful accelerator for large knowledge bases, but the product should remain useful without it.
