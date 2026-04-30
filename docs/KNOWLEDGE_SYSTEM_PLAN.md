# Knowledge System Plan

This document turns the current product direction into an operating plan. The
core rule is simple:

```text
Human throws in one raw thing. Agent decides what it means later.
```

That raw thing can come from a browser page, bookmarklet, browser extension,
mobile share sheet, Telegram message, desktop app, file drop, or a future app.
The entry surface can change; the contract should not.

## Product Direction

The system should behave like an agent inbox, not like a manual note form.

Good capture:

```text
paste one link
drop one file
send one rough thought
```

Bad capture:

```text
url + title + selected text + summary + tags + task fields
```

Titles, platform detection, summaries, tags, tasks, reminders, Wiki links, and
relationship scoring are agent work. The user only preserves the source before
the thought is lost.

## Processing Boundary

Passive capture must be cheap:

```text
/capture, browser extension, app, Telegram forward, file drop
  -> InboxItem(status=new)
  -> no LLM token spend by default
```

Agent processing is policy-driven:

```text
manual review, active chat, batch worker, scheduled run, or project-specific agent
  -> AgentRun
  -> source fetch / transcript / metadata
  -> Wiki note / Idea / Task / Reminder payload
  -> evidence and review
```

This is how the product avoids wasting tokens. Capture preserves intent; agent
work spends tokens only when a worker is actually processing the queue.

## Wiki Landing Model

Use the Karpathy-style LLM Wiki pattern, but keep the execution layer that this
project already has.

| Layer | Current location | Owner | Rule |
| --- | --- | --- | --- |
| Raw sources | `vault/10_sources` and `InboxItem.rawText` | Personal OS / Wiki | Immutable source trace. Do not rewrite away provenance. |
| Durable Wiki | `vault/20_notes` | Agent-maintained Markdown | Human-readable notes, concepts, source evidence, and backlinks. |
| Operating schema | `docs/WORKING_MANUAL.md`, `docs/AGENT_GUIDE.md` | Product docs | Tells agents how to ingest, query, lint, and avoid noisy work. |
| Execution state | Personal OS Postgres | Personal OS | Tasks, claims, reviews, reminders, and activity logs. |

Prior art to keep in mind:

- [Karpathy llm-wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):
  raw sources, wiki, schema; operations are ingest, query, and lint.
- [Pratiyush/llm-wiki](https://github.com/Pratiyush/llm-wiki): a shipped
  implementation that exports agent-consumable wiki data and treats raw sources
  as separate from generated pages.

The local difference is deliberate: Personal Wiki keeps knowledge readable;
Personal OS keeps work accountable.

## Relationship Model

The graph should not draw every possible association. Weak guesses create noise
and make the Wiki feel random.

Relationship bands:

| Score | Meaning | Default graph behavior |
| --- | --- | --- |
| `0.80-1.00` | Strong: explicit wikilink, same project, same source lineage, or multiple shared concepts. | Draw clearly. |
| `0.50-0.79` | Useful: enough shared concepts/tags to help navigation. | Draw as a related note edge. |
| `0.15-0.49` | Weak: possible search/ranking signal only. | Do not draw by default. |
| `<0.15` | Noise. | Ignore. |

The graph API now emits `score` and `strength` for links. Explicit wikilinks are
high confidence. Tag links are lower confidence and hidden unless the user asks
to see tags. Note-to-note `related` links are emitted only when the score is at
least `0.50`.

This gives the product the semantics the user expects: a 70% relationship is
visually meaningful; a 3% or 10% relationship should not become a line.

## Cleanup And Linting

Wiki cleanup is not a one-time rename job. It should become a repeatable lint
pass.

Minimum lint checks:

- duplicate source hashes or normalized URLs;
- notes with machine-like titles instead of human titles;
- generic tags dominating the graph, such as `auto-ingested` or `web-capture`;
- orphan notes with no inbound links and no useful tags;
- concepts that appear many times but have no concept page;
- stale claims that conflict with newer source notes;
- private hostnames, tokens, cookies, or real vault paths in public notes;
- tasks that reference Wiki evidence that no longer exists.

The lint pass should produce reviewable tasks, not silently rewrite everything.

## Browser Extension Direction

The browser extension should be a thin capture adapter.

Required behavior:

```text
click extension button
  -> capture current tab URL as content
  -> optionally include selected text only as raw content
  -> show saved/failed state
```

It should not ask the user for title, tags, summary, task category, or priority.
If it writes in the background, tokens must stay in private extension storage and
must never appear in URLs, screenshots, logs, or public docs.

## Implementation Order

1. Keep `/capture` as the canonical one-field raw intake.
2. Add a browser extension that writes the same `content` contract.
3. Add platform fetch adapters for common links: normal web pages, GitHub, X,
   YouTube, Douyin, Xiaohongshu, and blogs.
4. Add an enrichment worker that picks up `InboxItem(status=new)` only when
   policy allows token spending.
5. Expand Wiki lint into a visible report and task generator.
6. Recompute relation scores during index rebuilds and use the score threshold
   to keep the graph quiet.

The product should stay disciplined: capture is cheap; enrichment is explicit;
Wiki is durable; Personal OS owns execution.
