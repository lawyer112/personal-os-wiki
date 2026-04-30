# Service Topology

Personal OS + Personal Wiki is one product package, but it is not one monolithic
web process.

The repository ships one integrated stack:

```text
Personal OS + Personal Wiki repository / release package
  |
  +-- Personal OS     Next.js app and API for work state
  +-- Personal Wiki   Python app and API for Markdown knowledge
  +-- Postgres        database used by Personal OS
```

For the full product loop, run all three components. For Wiki-only usage, run
only Personal Wiki.

## One Download, Multiple Runtime Services

Users do not need to download two unrelated projects. The public repository and
release archive contain both services.

The demo path starts the whole stack with one command:

```bash
docker compose up -d --build
```

That command starts:

| Runtime component | Purpose | Demo URL |
| --- | --- | --- |
| Personal OS | Inbox, tasks, projects, agent runs, reviews, reminders, Web Capture | `http://localhost:3000` |
| Personal Wiki | Markdown vault, notes, tags, concepts, graph, Wiki pages | `http://localhost:3422` |
| Postgres | Personal OS database | internal Docker network, plus local dev `54329` |
| `personal-os-seed` | One-shot fake demo data loader | exits after seeding |

Seeing two browser URLs is expected. They are two services inside one product
stack.

## Why Two Web Services?

Personal OS and Personal Wiki own different data boundaries:

| Layer | Owns | Should not own |
| --- | --- | --- |
| Personal OS | Work state: Inbox, tasks, claims, reviews, project events, notifications | Long-form Markdown vault rendering |
| Personal Wiki | Durable knowledge: Markdown notes, links, tags, concepts, graph data | Task truth, task ownership, review decisions |

Keeping them as separate services makes the boundaries explicit:

- Personal OS can be upgraded or replaced without rewriting the Wiki vault.
- Personal Wiki can run by itself as a private Markdown knowledge service.
- Agents can use the OS task protocol and Wiki knowledge API independently.
- Token boundaries are separate: OS read/write tokens are not Wiki read/write tokens.

## How They Talk To Each Other

Personal OS uses environment variables to locate Personal Wiki:

```env
NEXT_PUBLIC_WIKI_URL="http://localhost:3422"
WIKI_READ_TOKEN="replace-with-your-wiki-read-token"
WIKI_API_TOKEN="replace-with-your-wiki-write-token"
```

The integration has two paths:

| Path | Direction | What happens |
| --- | --- | --- |
| Browser link | Personal OS UI -> Personal Wiki UI | OS renders links to the Wiki URL for reading notes or opening the Wiki. |
| Server API | Personal OS API -> Personal Wiki API | OS intake/context routes can read or write Wiki notes using configured Wiki tokens. |

Personal OS does not currently serve Personal Wiki pages through an internal
`/wiki/*` route. The Wiki remains its own HTTP service.

## Ports

| Mode | Personal OS | Personal Wiki | Postgres |
| --- | --- | --- | --- |
| Root demo compose | `127.0.0.1:3000` | `127.0.0.1:3422` | `127.0.0.1:54329` |
| OS production compose | `127.0.0.1:3100 -> 3000` | usually `127.0.0.1:3422` | Docker-internal `5432` |
| Local development | `localhost:3000` via `npm run dev` | `localhost:3422` via Docker or Python | `localhost:54329` |

Do not expose these raw ports directly to the public internet.

## Reverse Proxy Shape

For private or public remote access, keep raw services bound to localhost and
publish only authenticated HTTPS entrypoints.

Recommended shape:

```text
https://os.example.internal     -> 127.0.0.1:3100
https://wiki.example.internal   -> 127.0.0.1:3422
```

This keeps the two services separate while giving users stable URLs.

Path-based routing such as `https://example.internal/os` and
`https://example.internal/wiki` is not the default supported deployment shape.
It may break asset paths, auth redirects, or application links unless both apps
are configured and tested for subpath mounting. Use separate hostnames first.

## What To Tell A New User

Use this short explanation:

> Install one repository. Run one compose stack. It starts two web services:
> Personal OS for tasks and agent work state, Personal Wiki for Markdown
> knowledge. They use separate ports locally, and a reverse proxy can give them
> stable private HTTPS URLs.

If a user only wants a Markdown knowledge service, they can run Personal Wiki
alone. If they want the full agent work loop, they need Personal OS, Personal
Wiki, and Postgres.
