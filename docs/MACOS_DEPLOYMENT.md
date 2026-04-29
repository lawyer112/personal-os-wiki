# macOS Deployment Guide

This guide is for running Personal OS + Personal Wiki on a Mac as a private
single-user workstation. It covers macOS in general, not one specific Mac mini.

For an internet-facing public deployment, use the main
[Deployment Guide](./DEPLOYMENT.md): keep raw services on localhost and put an
authenticated HTTPS reverse proxy in front of them. macOS is a good personal
host, but it should not be treated as a hardened public server by default.

## Choose A macOS Install Mode

| Mode | Use when | Runtime | Notes |
| --- | --- | --- | --- |
| Docker Desktop demo | You want the fastest local trial | Docker Desktop | One command, fake data, demo tokens only. |
| Docker Desktop private install | You want a stable local workstation setup | Docker Desktop | Recommended for most Mac users. |
| Colima private install | You prefer CLI-only Docker on macOS | Colima + Docker CLI | Good for developer machines and headless-ish Macs. |
| Native Homebrew install | You already operate Node, Python, and Postgres yourself | Homebrew services / launchd | Advanced path; you own supervision and upgrades. |

The root `docker compose up -d --build` path is a demo. It is useful for seeing
the product loop. It is not the same as a real private deployment with your own
tokens, backups, and upgrade plan.

## What Runs On The Mac

| Component | Default local URL | Data |
| --- | --- | --- |
| Personal Wiki | `http://localhost:3422` | Markdown vault and generated indexes |
| Personal OS | `http://localhost:3000` for dev/demo, `http://localhost:3100` for prod compose | Postgres plus local app attachments |
| Postgres | internal Docker network, or `localhost:54329` for dev compose | Personal OS work state |
| Optional Mac adapter | no public port | Apple Reminders / desktop notification delivery |

Personal OS owns tasks, projects, claims, reviews, and Today state. Personal
Wiki owns durable Markdown knowledge and evidence. Apple Reminders, Telegram,
Feishu, email, and desktop notifications are adapters only.

## Prerequisites

Recommended:

- macOS 13 or newer.
- Apple Silicon or Intel Mac.
- 4 CPU cores, 8 GB RAM, and 20 GB free disk for a comfortable install.
- Git and `curl`.
- Docker Desktop or Colima.
- A password manager for tokens.

Install Xcode command line tools if Git is missing:

```bash
xcode-select --install
git --version
curl --version
```

### Docker Desktop Path

Install Docker Desktop from Docker's official site, start it once, then verify:

```bash
docker version
docker compose version
```

If this fails, open Docker Desktop and wait until it reports that the engine is
running.

### Colima Path

Install Homebrew first, then:

```bash
brew install colima docker docker-compose git curl
colima start --cpu 4 --memory 6 --disk 40
docker version
docker compose version
```

Keep Colima running while Personal OS + Personal Wiki are running:

```bash
colima status
```

### Native Homebrew Path

Use this only if you do not want Docker:

```bash
brew install node@24 python@3.12 postgresql@16
node --version
python3 --version
psql --version
```

Native deployment is flexible, but you must manage process supervision, logs,
upgrades, backups, and auth boundaries yourself.

## Run The Demo

Clone a fixed release tag or download a GitHub Release. For the current source
tree:

```bash
git clone https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
docker compose up -d --build
```

Open:

```text
Personal OS:   http://localhost:3000/auth/read
Read token:    demo-read-token

Personal Wiki: http://localhost:3422/auth/read
Read token:    demo-wiki-read-token
```

Check containers and health:

```bash
docker compose ps
curl -fsS http://localhost:3422/api/health
curl -fsS -H "Authorization: Bearer demo-read-token" http://localhost:3000/api/today
```

Stop the demo without deleting data:

```bash
docker compose down
```

Delete demo data only when you are sure you no longer need it:

```bash
docker compose down -v
```

## Create A Real Private Install

Use separate component compose files for a private workstation install. This
keeps real tokens out of the root demo compose.

### 1. Configure Personal Wiki

```bash
cd personal-wiki
cp .env.example .env
```

Edit `personal-wiki/.env`:

```env
WIKI_API_TOKEN="replace-with-a-long-random-write-token"
WIKI_READ_TOKEN="replace-with-a-long-random-read-token"
WIKI_REQUIRE_API_READ_AUTH="1"
WIKI_REQUIRE_PAGE_READ_AUTH="1"
WIKI_TRUST_LOCALHOST_READ_AUTH="0"
WIKI_ALLOW_UNAUTHENTICATED_WRITE="0"
WIKI_SITE_TITLE="Personal Wiki"
WIKI_HOST="127.0.0.1"
WIKI_PORT="3422"
```

For Docker, the compose file listens on `0.0.0.0` inside the container but binds
the host port to `127.0.0.1:3422`. That is safe for local use.

Start Wiki:

```bash
docker compose up -d --build
curl -fsS http://localhost:3422/api/health
```

### 2. Configure Personal OS

```bash
cd ../personal-os-app
cp .env.prod.example .env
```

Edit `personal-os-app/.env`:

```env
POSTGRES_PASSWORD="replace-with-a-long-random-database-password"
PERSONAL_OS_API_TOKEN="replace-with-a-long-random-write-token"
PERSONAL_OS_READ_TOKEN="replace-with-a-long-random-read-token"
WIKI_READ_TOKEN="same-as-personal-wiki-read-token"
WIKI_API_TOKEN="same-as-personal-wiki-write-token"
NEXT_PUBLIC_APP_URL="http://localhost:3100"
NEXT_PUBLIC_WIKI_URL="http://localhost:3422"
```

Start Personal OS:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -fsS -H "Authorization: Bearer $PERSONAL_OS_READ_TOKEN" http://localhost:3100/api/today
```

Open:

```text
Personal OS:   http://localhost:3100/auth/read
Personal Wiki: http://localhost:3422/auth/read
```

Use the read tokens from your `.env` files.

## Network Boundaries On macOS

`localhost` always means "this Mac." If a different machine or a remote agent
needs access, do not change ports to `0.0.0.0` casually.

| Need | Recommended approach |
| --- | --- |
| Use only on this Mac | Keep all ports bound to `127.0.0.1`. |
| Control from another trusted LAN machine | Prefer an SSH tunnel into the Mac. |
| Expose to a browser on LAN | Put an authenticated reverse proxy in front of it. |
| Expose to the internet | Use HTTPS, auth, narrow routes, and a real backup/restore plan. |

Do not port-forward `3000`, `3100`, or `3422` directly from a router to the
public internet.

## Optional: Connect The Mac Agent Adapter

The Mac adapter is not required to run the services. It is only the delivery
layer for Apple Reminders, desktop notifications, or similar local surfaces.

For a local prod compose install:

```bash
export PERSONAL_OS_BASE_URL="http://localhost:3100"
export PERSONAL_OS_READ_TOKEN="<personal-os-read-token>"
export PERSONAL_OS_API_TOKEN="<personal-os-write-token>"
export MAC_ADAPTER_ID="mac-reminders-adapter"
export MAC_REMINDER_LIST="Personal OS"
```

For the root demo:

```bash
export PERSONAL_OS_BASE_URL="http://localhost:3000"
export PERSONAL_OS_READ_TOKEN="demo-read-token"
export PERSONAL_OS_API_TOKEN="demo-write-token"
```

For a remote Personal OS server, use the HTTPS URL or an SSH tunnel URL. Do not
assume that `localhost` on the Mac points to a service running on another
machine.

Read the adapter contract:

- [Mac Agent Adapter](./MAC_AGENT_ADAPTER.md)
- [Agent Guide](./AGENT_GUIDE.md)

## Safe launchd Pattern For Mac Jobs

Do not embed tokens directly in LaunchAgent plist files. Prefer macOS Keychain
or a private env file outside the repository.

If using an env file:

```bash
mkdir -p "$HOME/.config/personal-os"
touch "$HOME/.config/personal-os/agent.env"
chmod 600 "$HOME/.config/personal-os/agent.env"
```

Example `agent.env`:

```bash
PERSONAL_OS_BASE_URL=http://localhost:3100
PERSONAL_OS_READ_TOKEN=replace-with-read-token
PERSONAL_OS_API_TOKEN=replace-with-write-token
MAC_ADAPTER_ID=mac-reminders-adapter
MAC_REMINDER_LIST=Personal OS
```

Your LaunchAgent should source this file inside a wrapper script. Keep logs in a
private directory and rotate or delete them if they contain task summaries.

## Backups

Create backups before upgrades.

For the root demo compose:

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U personal_os -d personal_os > backups/personal_os_$(date +%Y%m%d).sql
docker compose exec -T personal-wiki tar -czf - /data > backups/personal_wiki_data_$(date +%Y%m%d).tgz
```

For the component Wiki compose with `./data:/data`:

```bash
mkdir -p backups
tar -czf backups/personal_wiki_data_$(date +%Y%m%d).tgz -C personal-wiki data
```

For the Personal OS prod compose:

```bash
cd personal-os-app
mkdir -p ../backups
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U personal_os -d personal_os > ../backups/personal_os_$(date +%Y%m%d).sql
```

Store `.env` values in a password manager, not in Git or backup archives copied
to public storage.

## Upgrade

1. Back up Wiki data and Postgres.
2. Stop worker jobs that write reminders or tasks.
3. Check out the new release tag or extract the new release archive.
4. Reapply your private `.env` values.
5. Rebuild and start:

   ```bash
   docker compose up -d --build
   ```

   Or for component prod OS:

   ```bash
   cd personal-os-app
   docker compose -f docker-compose.prod.yml up -d --build
   ```

6. Run health checks and smoke checks.
7. Re-enable worker jobs.

## Troubleshooting

### Docker is not running

```bash
docker info
```

Start Docker Desktop or run `colima start`.

### Port is already in use

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3100 -sTCP:LISTEN
lsof -nP -iTCP:3422 -sTCP:LISTEN
```

Stop the conflicting service or change the host port in compose.

### Wiki asks for auth

Use `WIKI_READ_TOKEN` at:

```text
http://localhost:3422/auth/read
```

### Personal OS links point to the wrong port

For prod compose, set:

```env
NEXT_PUBLIC_APP_URL="http://localhost:3100"
```

For dev mode, set:

```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Planner or reminder API returns 401

Use the read token for these read-only endpoints:

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_READ_TOKEN" \
  "$PERSONAL_OS_BASE_URL/api/planner/today?mode=morning"
```

Use the write token only for mutations, task claims, heartbeats, submissions,
reviews, and intake.

### Apple Reminders does not write

Check macOS Privacy & Security permissions for Reminders, Automation, and the
terminal or runner app that executes the adapter. Also confirm that there is
exactly one reminder list with the configured name.

## macOS Security Checklist

- Replace all demo and placeholder tokens.
- Keep read tokens and write tokens separate.
- Keep services bound to `127.0.0.1` unless a reverse proxy provides TLS and
  authentication.
- Do not expose raw ports through a router.
- Do not put tokens in LaunchAgent plist files, Apple Reminder notes, URLs, or
  screenshots.
- Do not commit `.env`, `personal-wiki/data`, Postgres dumps, logs, reminders,
  or real task history.
- Use a dedicated hostname if proxying Personal OS and Personal Wiki. Do not
  co-host untrusted apps on the same hostname because browser cookies are
  scoped by host.
