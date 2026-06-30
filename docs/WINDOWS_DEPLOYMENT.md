# Windows Deployment Guide

This guide is for running Personal OS + Personal Wiki on a Windows workstation.

Recommended path: Windows 11 + WSL2 + Docker Desktop. Native Windows without WSL2 is not the primary target because the stack uses Docker Compose, Node.js, Python, and Postgres; WSL2 keeps the runtime closer to Linux and reduces path and shell differences.

## Choose A Windows Install Mode

| Mode | Use when | Recommendation |
| --- | --- | --- |
| Docker Desktop + WSL2 demo | You want to try the product locally | Recommended |
| Docker Desktop + WSL2 private install | You want a stable single-user workstation setup | Recommended |
| Native Windows services | You already operate Node, Python, and Postgres on Windows | Advanced, not documented as the default |
| Remote Linux server from Windows | You want Windows only as the client | Often best for always-on use |

## Prerequisites

- Windows 11 or recent Windows 10.
- WSL2 enabled.
- Docker Desktop with WSL2 backend.
- Git for Windows or Git inside WSL.
- PowerShell 7 recommended; Windows PowerShell also works for the demo script.
- 4 CPU cores, 8 GB RAM, and 20 GB free disk for a comfortable install.

Install or verify WSL2:

```powershell
wsl --install
wsl --status
```

Install Docker Desktop, enable the WSL2 backend, then verify:

```powershell
docker version
docker compose version
```

If Docker commands fail, open Docker Desktop and wait until it reports that the engine is running.

## Run The Demo

PowerShell path:

```powershell
git clone https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1
```

Equivalent Docker command:

```powershell
docker compose up -d --build
```

Open:

```text
Personal OS:   http://localhost:3000/auth/read
Read token:    demo-read-token

Personal Wiki: http://localhost:3422/auth/read
Read token:    demo-wiki-read-token
```

Check health:

```powershell
docker compose ps
curl.exe -fsS http://localhost:3422/api/health
```

Stop without deleting data:

```powershell
docker compose down
```

Delete demo data only when you are sure:

```powershell
docker compose down -v
```

## Private Install

For real use, do not keep demo tokens.

1. Copy example env files.
2. Replace all placeholder tokens and passwords with long random values.
3. Keep ports on localhost.
4. Back up Wiki data and Postgres.

Personal Wiki:

```powershell
cd personal-wiki
copy .env.example .env
# edit .env

docker compose up -d --build
curl.exe -fsS http://localhost:3422/api/health
```

Personal OS production-like compose:

```powershell
cd ..\personal-os-app
copy .env.prod.example .env
# edit .env

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Open:

```text
Personal OS:   http://localhost:3100/auth/read
Personal Wiki: http://localhost:3422/auth/read
```

## WSL2 Notes

If you work inside WSL:

```bash
git clone https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
docker compose up -d --build
```

Keep the repository inside the WSL filesystem, for example under `~/projects`, not under `/mnt/c/...`, when doing development. This avoids slow file watching and permission surprises.

Browser access from Windows still uses `http://localhost:3000` and `http://localhost:3422`.

## Common Windows Issues

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `docker` command not found | Docker Desktop not installed or not in PATH | Install Docker Desktop and restart the terminal |
| Docker engine unavailable | Docker Desktop is not running | Start Docker Desktop and wait for the engine |
| Ports do not open | Containers still building or port conflict | Run `docker compose ps` and check logs |
| Very slow install | Repo under `/mnt/c` in WSL | Move repo into WSL home directory |
| Script blocked | PowerShell execution policy | Use `-ExecutionPolicy Bypass` for the demo script |
| Auth fails | Demo token vs private token mismatch | Use the read token from the matching `.env` |

## Security Boundary

Do not expose raw ports directly to the internet from a Windows workstation.

Safe local defaults:

```text
Personal OS   localhost only
Personal Wiki localhost only
Postgres      Docker internal network or localhost only
```

For remote access, prefer a Linux server or a reverse proxy with HTTPS and authentication.

## Backup Targets

Back up:

- Wiki data directory or Docker volume.
- Personal OS Postgres database.
- `.env` values in a password manager, not Git.

Example Postgres dump from the root demo compose:

```powershell
mkdir backups
docker compose exec -T postgres pg_dump -U personal_os -d personal_os > backups\personal_os.sql
```

## Related Docs

- [Getting Started](./GETTING_STARTED.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Service Topology](./SERVICE_TOPOLOGY.md)
- [Data Safety](./DATA_SAFETY.md)
