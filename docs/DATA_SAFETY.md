# Data Safety

Personal OS + Personal Wiki is local-first, but "local-first" does not
automatically mean "safe." This document explains what data exists, where it
lives, and what must stay out of public Git history.

## Data Classes

| Data | Stored in | Public Git? | Notes |
| --- | --- | --- | --- |
| Application source | Repository | Yes | Code, tests, docs, migrations, templates. |
| Fake demo data | Repository seed files | Yes | Must be obviously fictional. |
| Inbox items | PostgreSQL | No | Raw user text can contain private intent. |
| Tasks and project state | PostgreSQL | No | Reveals priorities, plans, and unfinished work. |
| Agent runs and reasoning summaries | PostgreSQL | No | May reveal private decision traces. |
| Wiki notes | Markdown vault | No by default | Publish only sanitized example notes. |
| Tokens and credentials | `.env` / secret store | Never | Use `.env.example` placeholders only. |
| Server inventory | Private vault/docs | Never | Private IPs, ports, paths, and business mapping are sensitive. |
| Logs and screenshots | Runtime files | No | Can contain URLs, tokens, file paths, or private text. |

## Runtime Storage

Personal OS stores execution state in PostgreSQL:

- Inbox items
- Ideas
- Tasks
- Projects
- Notes
- Agent runs
- Task claims
- Contributions
- Reviews
- Activity events
- Notification payloads

Personal Wiki stores durable knowledge in a Markdown vault and JSON indexes:

- Markdown notes
- Tags and concepts
- Search index data
- Graph data
- Archived notes

The public repository should contain the software engine, not populated runtime
state.

## Token Boundaries

Use separate read and write tokens:

- `PERSONAL_OS_API_TOKEN` for mutating Personal OS routes.
- `PERSONAL_OS_READ_TOKEN` for read-only Personal OS routes.
- `WIKI_API_TOKEN` for Wiki writes.
- `WIKI_READ_TOKEN` for Wiki reads and browser handoff.

Do not fall back from read token to write token for browser cookies. Do not put
tokens in URLs. Do not paste real tokens into issues, screenshots, examples, or
agent prompts.

## Backups

Back up runtime state separately from source code:

- PostgreSQL dumps for Personal OS state.
- Markdown vault backups for Personal Wiki.
- `.env` and deployment secrets in a password manager or secret manager.

Do not store real backups in the public repository.

## Scrubbing Before Public Release

Before publishing or opening a PR from a private working tree:

1. Confirm `.env`, vault data, logs, screenshots, dumps, and generated bundles
   are ignored.
2. Run the CI secret/private-data scan.
3. Search for private network ranges, real domains, usernames, and deployment
   paths.
4. Review demo data manually.
5. Publish from clean history if private artifacts ever existed in old commits.

See [`../OPEN_SOURCE_RELEASE.md`](../OPEN_SOURCE_RELEASE.md) for the full
release checklist.

## Current Limitations

- Runtime data is not encrypted by the app itself; use disk, database, and host
  security controls.
- This release is not a multi-tenant SaaS system.
- Built-in auth is token based; put public deployments behind an authenticated
  reverse proxy.
- Agent autonomy is constrained by the task protocol, but a bad agent can still
  submit bad output. Review gates matter.
- Deleting public Git history after a leak is not enough; rotate exposed tokens.
