# Ecosystem Review

This document positions Personal OS + Personal Wiki against nearby open-source projects and explains when to continue building, when to integrate, and when to stop.

## Short Conclusion

Continue building, but narrow the wedge.

The market already has strong tools for:

- LLM-maintained wikis;
- Obsidian RAG;
- agent memory;
- enterprise knowledge platforms;
- generic task queues.

Personal OS + Personal Wiki should not compete as another generic memory or note tool. Its differentiated wedge is:

```text
turn knowledge into explicit, claimable, reviewable agent work
```

## Nearby Projects

| Project | Category | Strength | Gap relative to this project |
| --- | --- | --- | --- |
| `SamurAIGPT/llm-wiki-agent` | LLM-maintained wiki | Strong agent-maintained Markdown knowledge base | Does not focus on Personal OS-style task claims, reviews, reminders, and work-state API |
| `nashsu/llm_wiki` | Desktop LLM Wiki | Strong document-to-wiki product direction | More knowledge organization than explicit agent execution state |
| `Tencent/WeKnora` | Enterprise knowledge/RAG/wiki platform | Mature RAG, autonomous reasoning, enterprise-grade knowledge layer | Much heavier; not a small local-first personal workbench |
| `Oshayr/LLM-Wiki` | Claude Code wiki plugin | Semantic search and wiki UI for agent work | Memory/wiki oriented; not a full task control plane |
| `mthehang/obsidian-agentic-rag` | Obsidian RAG/MCP | Local hybrid search over Obsidian vaults | Search layer only; no task ownership/review protocol |
| `sqliteai/sqlite-memory` | Agent memory database | Portable SQLite memory with semantic/hybrid retrieval | Memory substrate, not a human/agent work operating system |
| `amanaiproduct/personal-os` | Local AI-agent task management | Directly close in name and task angle | Needs comparison by protocol depth: evidence, review, Wiki integration, release packaging |
| `block/agent-task-queue` | Agent task queue | Simple local queue to prevent agent contention | Queue primitive only; no Wiki, project state, review, reminder surface |

## What To Absorb

From LLM Wiki projects:

- raw source vs generated wiki boundary;
- wiki linting;
- research-on-miss;
- semantic search with citations;
- readable graph/index pages.

From Obsidian RAG projects:

- hybrid retrieval baseline;
- local embeddings option;
- MCP-style context tools;
- chunk provenance.

From agent task queue projects:

- lease safety;
- concurrency control;
- stale claim recovery;
- worker heartbeat conventions.

From enterprise RAG platforms:

- evaluation datasets;
- retrieval metrics;
- reranking;
- source permissions.

## What Not To Copy

Do not copy features that move the project away from its wedge:

- generic chatbot over notes;
- full enterprise document management;
- noisy graph visualization before relationship quality;
- hidden memory writes without review;
- workflow automation without evidence and review.

## Continue / Stop Criteria

Continue building if the next release improves at least one of these:

1. Agent can find unfinished work.
2. Agent can claim work safely.
3. Agent can load a small context pack with citations.
4. Agent can submit evidence.
5. Human or reviewer can approve or reject.
6. The system can be installed by another user.

Stop or absorb another project if a feature only makes the Wiki prettier without improving execution.

## Vector Search Position

The ecosystem strongly supports hybrid retrieval, but vector search should be introduced as an optional layer, not as the product's identity.

Recommended path:

```text
BM25 / keyword / metadata
  + optional embeddings
  + rerank
  + cited context packs
```

This lets users run the product without a paid embedding provider, while allowing advanced users to plug in hosted or local embedding models.

## GitHub Positioning Sentence

Use this positioning in README and GitHub About:

```text
Local-first Personal OS + Markdown Wiki for AI agents: turn messy inputs into claimable tasks, cited context, evidence submissions, and reviewable execution.
```
