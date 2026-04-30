# Web Capture

Web capture is the low-cost input surface for links, selected text, and loose
thoughts. It records data in Personal OS; it does not run an LLM, write the
Wiki, create tasks, or send Telegram messages by itself.

## Product Boundary

Use `/capture` when the user wants to save something now and let an agent decide
what to do later.

Use `/api/intake` when an agent is already active and should immediately turn the
input into Wiki notes, tasks, ideas, project events, or notification payloads.

```text
browser page -> /capture -> InboxItem(status=new)
chat/agent window -> /api/intake -> InboxItem + AgentRun + Wiki/Task/Idea output
```

This keeps token cost under the operator's control. A user can configure an
agent to process captures every few minutes, every few hours, once a day, or only
when explicitly asked. Personal OS only preserves the source trace.

## Browser Flow

Open:

```text
http://localhost:3000/capture
```

The page accepts:

- URL
- title
- selected text
- user note

Saving creates one `InboxItem`:

```json
{
  "sourceType": "link",
  "sourcePlatform": "web",
  "status": "new",
  "createdBy": "user"
}
```

The item remains in Inbox until an agent or user processes it.

## Bookmarklet

The `/capture` page includes a bookmarklet that opens a pre-filled capture form
from the current browser page:

```text
javascript:(()=>{const b="http://localhost:3000/capture";const q=new URLSearchParams({url:location.href,title:document.title,selection:String(getSelection())});open(b+"?"+q.toString(),"_blank","noopener,noreferrer");})();
```

For a production install, replace `http://localhost:3000` with the private
Personal OS URL. Do not embed write tokens in bookmarklets or browser URLs.

## Agent Processing Policy

Capture cadence is an agent policy, not an application rule.

Reasonable defaults:

- low-cost personal setup: process captures a few times per day;
- active research session: process captures more often while the user is working;
- expensive model or large context: batch captures and summarize first;
- manual mode: leave captures in Inbox until the user asks the agent to process
  them.

The important rule is that a passive capture should not silently spend LLM tokens.
Agents should read new Inbox items, choose the useful ones, then call
`POST /api/intake` only when they are actually doing the classification and write
work.

## Extension Pattern

A browser extension should prefer opening `/capture` with query parameters. If it
needs background writes, it can call `POST /api/inbox/items` with
`PERSONAL_OS_API_TOKEN`, but that token must stay in the private extension
storage and must never appear in page JavaScript, URLs, screenshots, logs, or
public docs.
