# Obsidian Bridge Plan

This document defines the Obsidian integration direction for Personal OS +
Personal Wiki.

The goal is not to replace Obsidian. The goal is to let people keep using
Obsidian as a familiar Markdown reading and editing surface while Personal Wiki
continues to own the durable knowledge API, graph index, and agent-readable
context.

## Product Position

Obsidian is the human note surface. Personal Wiki is the knowledge service.
Personal OS is the execution and review layer.

```text
Obsidian plugin
  -> read/search Personal Wiki notes
  -> capture selected text or the current note
  -> show related tasks and evidence links

Personal Wiki
  -> Markdown vault
  -> note search, tags, concepts, graph
  -> ingest/update API

Personal OS
  -> tasks, claims, review, reminders, agent runs
```

The bridge should stay thin. It should not turn the Obsidian plugin into a
second task database or a hidden agent runtime.

## Current Project Support

Personal Wiki already exposes the read surfaces needed for a first plugin:

| Need | Current surface |
| --- | --- |
| Search notes | `GET /api/notes?q=...` |
| Filter by tag | `GET /api/notes?tag=...` |
| Filter by concept | `GET /api/notes?concept=...` |
| Read a note | `GET /api/note?path=...` |
| Read tags and concepts | `GET /api/tags`, `GET /api/concepts` |
| Read graph | `GET /api/graph` |
| Write captured knowledge | `POST /api/ingest` |

Personal OS already exposes the execution surfaces needed later:

| Need | Current surface |
| --- | --- |
| Read Today/work state | `GET /api/today` |
| Read task context | `GET /api/agent/context?taskId=...` |
| Create intake from a plugin/agent | `POST /api/intake` or `POST /api/inbox/items` |
| Create and review work | task claim, heartbeat, contribution, submit, review APIs |

## Implementation Phases

### Phase 1: Read-Only Companion

Build a minimal Obsidian plugin that stores:

- `Personal Wiki URL`
- `WIKI_READ_TOKEN`
- optional `Personal OS URL`
- optional `PERSONAL_OS_READ_TOKEN`

Commands:

- Search Personal Wiki.
- Open a Personal Wiki note by path.
- Insert a `wiki://...` or Personal Wiki browser link into the current note.
- Show related notes from `/api/graph`.

Acceptance criteria:

- The plugin can search a private Personal Wiki from Obsidian without copying
  the private vault into the public repository.
- Read tokens stay in Obsidian plugin settings storage, never in Markdown
  frontmatter, screenshots, logs, or Git.
- The plugin works if only Personal Wiki is running.

### Phase 2: Capture Adapter

Add commands that send the current note, selected text, or current clipboard URL
into the existing capture pipeline.

Preferred write path:

```text
Obsidian selection/current note
  -> POST /api/inbox/items or POST /api/intake
  -> InboxItem(status=new)
  -> later agent enrichment
  -> Wiki note / Task / Idea / Reminder payload
```

The plugin should not ask the user to fill in title, tags, summary, priority, or
task type during capture. Those are agent-enrichment fields.

Acceptance criteria:

- A capture creates a raw Inbox item without spending LLM tokens by default.
- If a write token is configured, it is stored only in private plugin storage.
- The plugin can report success/failure without logging note content or tokens.

### Phase 2A: Folder Inbox Mode

Before building a full write plugin, support a simpler Obsidian workflow:

```text
Obsidian vault
  +-- Personal OS Inbox/
        +-- links-and-notes.md
        +-- project-ideas.md
        +-- reading-dump.md
```

The user can open a normal Obsidian folder and paste links, copied text, short
notes, or rough project thoughts into these files. A small local adapter can
scan only this folder and send new blocks into Personal OS or Personal Wiki.

Rules:

- Treat each pasted URL, Markdown bullet, or fenced block as a raw candidate.
- Normalize URLs before deduplication: lowercase host, remove obvious tracking
  parameters, trim fragments when safe, and preserve the original source text.
- Compute a stable candidate hash from normalized URL or normalized text.
- Compare against Personal Wiki `source_hash` and Personal OS Inbox records
  before creating anything.
- If an item is already present, report it as `duplicate` and link to the
  existing note or inbox item instead of creating another copy.
- If an item is similar but not identical, report it as `possible_duplicate`
  and leave the merge decision to a human or reviewer agent.

This mode is deliberately not a sync engine. Obsidian remains the quick human
scratchpad; Personal OS and Personal Wiki decide what becomes durable knowledge,
task work, or ignored duplicate input.

Acceptance criteria:

- A user can paste ten links into one Obsidian file and run one adapter command.
- Already-ingested links are skipped or linked, not duplicated.
- New raw items enter `InboxItem(status=new)` or Wiki ingest with source
  evidence.
- The adapter writes a short local report, not private content-heavy logs.

### Phase 3: Generated Vault Mirror

Add an optional read-only mirror mode for users who want Personal Wiki notes to
appear inside an Obsidian vault.

Rules:

- Mirror into a generated folder, for example `Personal Wiki Mirror/`.
- Preserve source path, source hash, and updated time in machine-readable
  metadata.
- Treat mirrored files as generated. Do not edit them as the source of truth.
- Do not copy private `.env`, server inventory, database dumps, or runtime logs.

Acceptance criteria:

- Re-running sync updates generated files deterministically.
- Deleted/archived wiki notes are handled explicitly.
- Conflicts do not silently overwrite human edits.

### Phase 4: Task And Evidence Panel

Connect the Obsidian note surface back to Personal OS.

Commands and views:

- Show tasks related to the current note or concept.
- Create a task from the current selection.
- Attach the current note as evidence to a task contribution.
- Open the task in Personal OS.

Acceptance criteria:

- Obsidian can create or reference work, but Personal OS remains the task truth.
- The plugin never marks work `done` directly; review stays in Personal OS.
- Evidence links are stable and human-readable.

### Phase 5: Optional Writeback Editing

Only after the read, capture, mirror, and task flows are stable, consider direct
note editing from Obsidian back to Personal Wiki.

Required guardrails:

- optimistic concurrency using source hash or updated time;
- explicit conflict screen;
- human confirmation before overwrite;
- audit activity in Personal Wiki or Personal OS.

This phase is intentionally last. Editing is where a helpful bridge can become
a destructive sync tool.

## Security Rules

- Never put tokens in Markdown notes, frontmatter, URLs, screenshots, logs, or
  public docs.
- Keep read and write tokens separate.
- Prefer read-only by default.
- Treat private deployment data as deployment data, not release source.
- Do not make Obsidian's `.obsidian/` folder part of Personal Wiki's public
  release package.

## Non-Goals

- Replacing Obsidian, Logseq, or Notion.
- Making Obsidian the source of truth for task execution state.
- Running autonomous agents inside the Obsidian plugin.
- Syncing a private vault into GitHub.
- Publishing a public plugin that assumes one user's LAN hostnames or tokens.

## First Build Slice

The first useful build is small:

1. Create an Obsidian plugin skeleton.
2. Add settings for Wiki URL and read token.
3. Implement note search with `GET /api/notes?q=...`.
4. Implement "insert Wiki link into current note".
5. Add a private smoke test against a local/private Wiki.

That proves the bridge without touching write paths or sync conflicts.
