# Security Policy

Personal OS + Personal Wiki is local-first software. The public repository is
the reusable engine only; private vaults, task history, runtime databases,
server inventories, tokens, cookies, logs, screenshots, and agent environment
files must stay outside Git.

## Supported Versions

Security fixes target the latest public release and the latest `main` branch.
Release packages are tagged as `vX.Y.Z`; see [`VERSION`](./VERSION) and
[`CHANGELOG.md`](./CHANGELOG.md).

## Deployment Boundary

- The default production compose file binds Personal OS to `127.0.0.1`.
- The browser UI is not a public multi-user SaaS surface.
- Do not expose Personal OS or Personal Wiki directly to the Internet.
- If you expose them to LAN or the Internet, put them behind an authenticated
  reverse proxy first.
- Write APIs require write tokens. Agent-facing read APIs require read tokens in
  production. Browser Wiki handoff must use `WIKI_READ_TOKEN`, not
  `WIKI_API_TOKEN`.

## Secret Handling

Safe to commit:

- source code
- tests
- docs
- `.env.example`
- fake demo data

Never commit:

- `.env` files
- API tokens, cookies, SSH keys, deploy keys, or agent env exports
- populated Wiki vaults or Personal OS database dumps
- real inbox/task/project/reminder data
- server inventories, private LAN addresses, private domains, ports, paths, or
  business mappings
- logs, screenshots, generated bundles, `.next`, `node_modules`, or archives

## Reporting Vulnerabilities

While this repository is still private, report issues through the private review
workflow. Once public, open a GitHub security advisory or contact the maintainer
privately instead of filing a public issue for exploitable vulnerabilities.

Include:

- affected commit or version
- vulnerable endpoint or file path
- reproduction steps using fake data
- expected impact
- whether credentials, private data, or public network exposure are involved

## Known Non-Goals

- This project does not provide hosted multi-tenant authentication out of the
  box.
- This project does not publish or migrate your private knowledge base.
- This project does not make local tokens safe to paste into chats, screenshots,
  browser history, or logs.
