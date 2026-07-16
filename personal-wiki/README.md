# Personal Wiki

Personal Wiki is a small private Markdown knowledge service for agents and
operators. It stores source items and curated notes in a local vault, maintains a
JSON index and graph, renders browser pages, and exposes read/write APIs.
Graph links include relationship scores so explicit links and strong related
notes are visible without drawing every weak association.

Personal Wiki is one half of the larger Personal OS + Personal Wiki stack:

- [Project README](../README.md)
- [Architecture](../docs/ARCHITECTURE.md)
- [Agent guide](../docs/AGENT_GUIDE.md)
- [Repository strategy](../docs/REPOSITORY_STRATEGY.md)

## Quick Start

```bash
cp .env.example .env
# Edit WIKI_API_TOKEN and WIKI_READ_TOKEN before exposing the service.
docker compose up -d --build
```

Open `http://localhost:3422/`.

The Docker Compose file binds the browser/API port to `127.0.0.1` by default.
For LAN or public access, keep the service behind a TLS reverse proxy with
authentication and replace every placeholder token first.

For user-mode Python deployment instead of Docker, see
`deploy/README.md`.

## Security Notes

- Keep `.env`, `data/`, logs, and generated bundles out of Git.
- Use `WIKI_API_TOKEN` only for writes.
- Use `WIKI_READ_TOKEN` for read-only agent and browser access.
- Replace placeholder tokens before binding the service to a LAN or public host.
- Keep `WIKI_TRUST_LOCALHOST_READ_AUTH=0` unless every same-host caller is
  trusted; reverse proxies also reach the Wiki service from localhost.
- Leave `WIKI_CORS_ALLOW_ORIGIN` empty unless a browser client must call the
  Wiki API directly from another origin. Prefer an exact origin over `*`.
- Do not publish a populated vault unless it has been explicitly scrubbed.
