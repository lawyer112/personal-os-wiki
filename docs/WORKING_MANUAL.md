# Working Manual

This is the operating manual for product work in this repository.

## Core Goal

Personal OS + Personal Wiki is not a better bookmark manager and not a prettier
note app. It is a loop:

```text
raw input -> durable knowledge -> owned work -> evidence -> review -> reminder
```

Personal OS owns execution state. Personal Wiki owns durable public/private
knowledge. Agents bridge the two.

## Responsibilities

| Surface | Responsibility | Must not do |
| --- | --- | --- |
| User capture | Accept the raw input with minimal friction. | Ask the user to classify, title, summarize, tag, or split tasks. |
| Personal OS | Store source trace, work state, task ownership, reviews, reminders. | Pretend to be the reasoning engine. |
| Personal Wiki | Store readable long-term knowledge, backlinks, tags, concepts, source evidence. | Become the task queue. |
| Agent | Enrich, fetch, summarize, classify, write Wiki notes, create tasks, and report evidence. | Spend tokens silently on every passive capture unless configured to do so. |

## Capture Rule

The capture surface should accept one raw entry: a URL or a short text blob. This
is true for browser capture, Telegram forwarding, share extensions, and future
browser plugins.

Bad capture UX:

```text
URL + title + selected text + note + tags + task fields
```

Good capture UX:

```text
Paste or drop one link.
```

The agent can later detect whether the URL is from a blog, X, Xiaohongshu,
Douyin, YouTube, GitHub, a media site, or a normal webpage.

## Processing Rule

Processing cadence is policy, not product law. Realtime, batched, daily, and
manual-only modes are all valid. The repository should document these as choices
instead of hard-coding a universal scan interval.

## Demo Rule

Public demos must show the simplest human action first. If the user only needs
to paste a link in real life, the demo should not show the user typing title,
selection, summary, tags, or task fields.

All public demo data must be fake. Do not publish real URLs from private work,
real chats, tokens, hostnames, LAN maps, vault contents, or task history.
