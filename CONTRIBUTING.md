# Contributing

Thanks for helping improve Personal OS + Personal Wiki.

This project is local-first software for private knowledge and task execution.
The most important contribution rule is simple: never submit real private data.

## Contribution Flow

1. Fork the repository.
2. Create a feature branch.
3. Keep changes focused and reviewable.
4. Run the relevant checks.
5. Open a pull request using the template.

Maintainers merge through pull requests. The `main` branch is protected and
should stay releasable.

## Required Checks

For Personal OS changes:

```bash
cd personal-os-app
npm ci
npm run prisma:generate
npm test
npm audit --omit=dev --audit-level=moderate
npx tsc --noEmit
npm run lint
npm run build
```

For Personal Wiki changes:

```bash
python -m py_compile personal-wiki/api/server.py
```

When Docker is available:

```bash
DOCKER_BUILDKIT=1 docker build --build-arg NPM_CONFIG_REGISTRY=https://registry.npmjs.org -t personal-os-app:test personal-os-app
DOCKER_BUILDKIT=1 docker build -f personal-wiki/api/Dockerfile -t personal-wiki:test personal-wiki
```

## Data Safety

Do not include:

- real `.env` files
- API tokens, cookies, SSH keys, deploy keys, or agent env exports
- populated Wiki vaults or Personal OS database dumps
- server inventories, private LAN addresses, private domains, ports, paths, or
  business mappings
- real inbox/task/project/reminder data
- logs, screenshots, generated bundles, `.next`, `node_modules`, or archives

Use invented demo data and `localhost` examples.

## Security Issues

Do not open public issues for exploitable vulnerabilities. Follow
[`SECURITY.md`](./SECURITY.md).
