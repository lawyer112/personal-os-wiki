# Personal Wiki Deployment

This service stores Markdown notes, builds a JSON search/graph index, and exposes
small HTTP APIs for browser use and agent ingestion.

## URLs

Assuming the default port:

- Home: `http://localhost:3422/`
- Browse: `http://localhost:3422/notes`
- Manual: `http://localhost:3422/docs/USAGE.md`
- Health: `http://localhost:3422/api/health`
- Ingest: `POST http://localhost:3422/api/ingest`
- Search/list: `GET http://localhost:3422/api/notes`
- Graph data: `GET http://localhost:3422/api/graph`

## Docker Compose

```bash
cp .env.example .env
# edit WIKI_API_TOKEN and WIKI_READ_TOKEN
docker compose up -d --build
```

The compose stack mounts `./data` as the private wiki data directory. Do not
commit `data/`, `.env`, logs, pid files, or generated archives.

## User-Mode Script

For a simple non-Docker deployment:

```bash
cp .env.example .env
export WIKI_HOST=127.0.0.1
scripts/start.sh
scripts/status.sh
scripts/restart.sh
tail -f logs/personal-wiki.log
```

`scripts/start.sh` defaults to `127.0.0.1`. Keep that default for local and
Mac installs. If you bind to `0.0.0.0`, put the service behind an authenticated
reverse proxy first and keep read/write tokens enabled.

## Ingest Request

```bash
curl -X POST http://localhost:3422/api/ingest \
  -H "Authorization: Bearer $WIKI_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Example note",
    "content": "This is a source item from an agent.",
    "source_type": "manual",
    "source_url": "manual://example",
    "tags": ["inbox", "agent"],
    "metadata": {
      "from": "Agent"
    }
  }'
```

## Agent Maintenance API

Read endpoints:

```text
GET /api/notes?q=keyword&tag=agent&concept=Project&page=1&page_size=20
GET /api/note?path=vault/20_notes/2026-04-20/example.md
GET /api/tags
GET /api/concepts
GET /api/graph
```

`/api/graph` links include `score` and `strength`; note-to-note `related` links
are emitted only for useful relationships, while weak associations remain search
signals instead of graph lines.

Write endpoints require `Authorization: Bearer $WIKI_API_TOKEN`:

```text
POST /api/rebuild
POST /api/note/update   {"path":"...","title":"...","content":"...","tags":["..."]}
POST /api/note/tag      {"path":"...","add":["reviewed"],"remove":["inbox"]}
POST /api/note/archive  {"path":"..."}
POST /api/note/delete   {"path":"..."}
POST /api/relink        {"from":"Old Concept","to":"New Concept"}
```

`/api/note/delete` is archive-style: it moves the note into
`vault/90_archive/` and keeps Git history instead of hard-deleting data.
