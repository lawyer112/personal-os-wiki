# Deployment Guide

This project can run in three modes:

| Mode | Recommended for | What runs |
| --- | --- | --- |
| Docker Compose | Most users and small private servers | Personal Wiki container, Postgres container, optional Personal OS container |
| Local development | Contributors and people changing code | Wiki through Docker or Python, Postgres through Docker, Personal OS through `npm run dev` |
| Bare Linux service | Operators who already manage systemd, reverse proxies, and backups | Python Wiki service, Node/Next.js service, external Postgres |

The recommended public template is Docker Compose on a Linux host, bound to
localhost behind an authenticated reverse proxy. Do not expose the raw app ports
directly to the internet.

For normal installs, start from a fixed GitHub Release or version tag. Tracking
`main` is for contributors and reviewers, not for stable personal deployments.
See [Releases and packages](./RELEASES.md).

## What Gets Deployed

| Component | Runtime | Default port | Persistent data |
| --- | --- | --- | --- |
| Personal Wiki | Python 3.12 container or Python 3.11+ bare runtime | `3422` | `personal-wiki/data` or `WIKI_DATA_DIR` |
| Personal OS | Next.js 16 / Node.js 24+ | `3000` in dev, `3100 -> 3000` in prod compose | Postgres plus `personal_os_data` volume |
| Postgres | PostgreSQL 16 | `54329` in local dev compose, internal `5432` in prod compose | `personal_os_postgres` volume |

Personal Wiki can run by itself. Personal OS needs Postgres. The full
OS/Wiki loop needs both services plus matching Wiki read/write tokens.

## Recommended Host

Minimum for a private single-user install:

| Resource | Minimum | Comfortable |
| --- | --- | --- |
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4-8 GB |
| Disk | 10 GB free | 20+ GB plus backups |
| OS | Linux x86_64, macOS, or Windows with WSL2/Docker Desktop | Ubuntu/Debian server |

The app itself is lightweight. Disk usage depends mostly on your Markdown vault,
attachments, screenshots, and Postgres history.

## Required Tools

For the recommended Docker path:

- Docker Engine or Docker Desktop.
- Docker Compose v2.
- Git.
- `curl` for health checks.
- A password manager or secret manager for tokens and database passwords.

For local development:

- Node.js 24 or newer.
- npm, installed with Node.js.
- Python 3.11 or newer if running Personal Wiki without Docker.
- Docker Compose for local Postgres.

For a production-like Linux deployment:

- Docker Engine and Compose v2, or a Node.js 24 runtime plus Python 3.11+.
- PostgreSQL 16.
- A reverse proxy such as Caddy, Nginx, Traefik, or Cloudflare Tunnel.
- HTTPS and an authentication layer in front of any public endpoint.
- Backup automation for Postgres and Wiki data.

## Ports And Network Boundaries

| Port | Service | Default exposure |
| --- | --- | --- |
| `3422` | Personal Wiki | Local/demo only unless protected by auth and reverse proxy |
| `3000` | Personal OS dev server | Local development only |
| `3100` | Personal OS production compose host port | Bound to `127.0.0.1` by default |
| `54329` | Local Postgres dev port | Bound to `127.0.0.1` |
| `5432` | Postgres inside Docker network | Internal only in production compose |

Safe default: keep app ports bound to localhost and publish only a reverse proxy
URL that has TLS and authentication.

## Required Environment Variables

Personal Wiki:

```env
WIKI_API_TOKEN="replace-with-a-long-random-write-token"
WIKI_READ_TOKEN="replace-with-a-long-random-read-token"
WIKI_REQUIRE_API_READ_AUTH="1"
WIKI_REQUIRE_PAGE_READ_AUTH="1"
WIKI_TRUST_LOCALHOST_READ_AUTH="0"
WIKI_ALLOW_UNAUTHENTICATED_WRITE="0"
WIKI_SITE_TITLE="Personal Wiki"
WIKI_HOST="0.0.0.0"
WIKI_PORT="3422"
```

Personal OS:

```env
DATABASE_URL="postgresql://personal_os:replace-with-a-long-random-database-password@localhost:54329/personal_os?schema=public"
PERSONAL_OS_API_TOKEN="replace-with-a-long-random-write-token"
PERSONAL_OS_READ_TOKEN="replace-with-a-long-random-read-token"
WIKI_READ_TOKEN="replace-with-your-personal-wiki-read-token"
WIKI_API_TOKEN="replace-with-your-personal-wiki-token"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WIKI_URL="http://localhost:3422"
```

Use separate read and write tokens. Do not reuse the Wiki write token for browser
handoff or read-only agent access.

## Quick Deploy Paths

### Start from a release package

Download and extract a release archive:

```text
personal-os-wiki-v0.1.0.zip
personal-os-wiki-v0.1.0.tar.gz
```

Or clone a fixed tag:

```bash
git clone --branch v0.1.0 https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
```

Then continue with the Wiki-only, full local, or production-like path below.

### Wiki-only Docker install

```bash
cd personal-wiki
cp .env.example .env
# edit WIKI_API_TOKEN and WIKI_READ_TOKEN
docker compose up -d --build
curl http://localhost:3422/api/health
```

### Full local development install

```bash
cd personal-wiki
cp .env.example .env
docker compose up -d --build

cd ../personal-os-app
cp .env.example .env
docker compose up -d postgres
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open:

- Personal Wiki: `http://localhost:3422`
- Personal OS: `http://localhost:3000`

### Production-like Personal OS compose

```bash
cd personal-os-app
cp .env.example .env
# set POSTGRES_PASSWORD, PERSONAL_OS_API_TOKEN, PERSONAL_OS_READ_TOKEN,
# WIKI_READ_TOKEN, WIKI_API_TOKEN, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_WIKI_URL
docker compose -f docker-compose.prod.yml up -d --build
```

The production compose file binds Personal OS to `127.0.0.1:3100`. Put a reverse
proxy in front of it rather than opening the container port directly.

## Security Checklist Before Exposing Anything

- Replace every `replace-with-*` and `change-me` value.
- Keep `.env`, Wiki vault data, Postgres data, logs, and screenshots out of Git.
- Keep services on localhost unless a reverse proxy provides TLS and auth.
- Keep `WIKI_TRUST_LOCALHOST_READ_AUTH=0` unless every localhost caller is trusted;
  same-host reverse proxies also appear as localhost to the Wiki service.
- Use separate read/write tokens for Personal OS and Personal Wiki.
- Back up Postgres and Wiki data before upgrades.
- Test restore, not only backup creation.
- Do not publish server ledgers, private LAN addresses, real project mappings,
  or business-sensitive task history.

## Backup Targets

Back up at least:

- `personal-wiki/data` or the directory configured by `WIKI_DATA_DIR`.
- The Postgres database used by Personal OS.
- The `.env` values through a password manager or secret manager, not through Git.

For Docker volumes, use `pg_dump` for Postgres and a normal file backup for the
Wiki data directory.

## When Docker Is Not Required

Docker is not strictly required. It is the recommended path because it reduces
setup drift and keeps Postgres/Python/Node versions predictable.

If you already operate Linux services, you can run:

- Personal Wiki as a Python service with `WIKI_*` environment variables.
- Personal OS as a Node.js app after `npm ci`, `npm run prisma:generate`,
  `npm run build`, and `npm run start:prod`.
- Postgres as a managed or system package database.

Bare deployment is more flexible, but you own process supervision, upgrades,
logs, TLS, auth, and backups.

## More Reading

- [Getting Started](./GETTING_STARTED.md)
- [Data Safety](./DATA_SAFETY.md)
- [Repository Permissions](./PERMISSIONS.md)
- [Personal OS README](../personal-os-app/README.md)
- [Personal Wiki README](../personal-wiki/README.md)
