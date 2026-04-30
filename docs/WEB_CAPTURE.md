# Web Capture

Web capture is the lowest-friction input surface. The user gives Personal OS one
raw thing: usually a URL, sometimes a short note. Personal OS records it. Agents
do the enrichment later.

## Product Boundary

Use `/capture` when the user wants to save an entry point and move on.

Use `/api/intake` when an agent is already active and should immediately turn the
input into Wiki notes, tasks, ideas, project events, or notification payloads.

```text
browser/link/share sheet -> /capture -> InboxItem(status=new)
chat/agent window        -> /api/intake -> InboxItem + AgentRun + Wiki/Task/Idea output
```

The capture path must not ask the user to fill metadata. Titles, platform
classification, content extraction, summaries, Wiki notes, tasks, tags, concepts,
and reminder copy are agent work.

## Browser Flow

Open:

```text
http://localhost:3000/capture
```

Paste or drop one value:

```text
https://example.com/article
```

Saving creates one `InboxItem`:

```json
{
  "sourceType": "link",
  "sourcePlatform": "web",
  "sourceUrl": "https://example.com/article",
  "rawText": "https://example.com/article",
  "status": "new",
  "createdBy": "user"
}
```

If the user pastes plain text without a URL, the item is stored as
`sourceType: "text"` and still waits for agent enrichment.

## Bookmarklet

The `/capture` page includes a bookmarklet that opens a pre-filled single-field
capture form from the current browser page:

```text
javascript:(()=>{const b="http://localhost:3000/capture";const q=new URLSearchParams({content:location.href});open(b+"?"+q.toString(),"_blank","noopener,noreferrer");})();
```

For a production install, replace `http://localhost:3000` with the private
Personal OS URL. Do not embed write tokens in bookmarklets or browser URLs.

## Agent Enrichment

Capture cadence is an agent policy, not an application rule.

An enrichment worker may:

- detect the platform, such as a blog, X, Xiaohongshu, Douyin, YouTube, GitHub,
  or a normal website;
- fetch the page title, metadata, transcript, post text, or readable article
  body when the platform allows it;
- summarize the material;
- decide whether it belongs in Personal Wiki, Personal OS tasks, ideas, project
  events, notifications, or only the raw Inbox;
- call `POST /api/intake` only when it is actually doing that processing work.

The important rule is that passive capture should not silently spend LLM tokens.
Realtime, batched, daily, or manual-only processing are all valid operator
choices.

## Extension Pattern

A browser extension should prefer opening `/capture?content=<url>`. If it needs
background writes, it can call `POST /api/inbox/items` with
`PERSONAL_OS_API_TOKEN`, but that token must stay in private extension storage
and must never appear in page JavaScript, URLs, screenshots, logs, or public
docs.
