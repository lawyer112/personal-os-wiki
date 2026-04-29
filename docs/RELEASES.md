# Releases And Packages

This project is distributed as source plus versioned release archives. It is
not yet published as a one-click desktop app or a hosted SaaS service.

## Version Model

- The root [`VERSION`](../VERSION) file is the release version for the whole
  repository.
- `personal-os-app/package.json` should match the root version for public
  releases.
- Personal Wiki follows the root version because it is a Python service inside
  the same product package.
- Git tags use `vX.Y.Z`, for example `v0.1.1`.
- User-facing changes are recorded in [`CHANGELOG.md`](../CHANGELOG.md).

## What A Release Contains

Release archives include:

- Personal OS source, Prisma schema, tests, docs, and Docker files.
- Personal Wiki source, docs, scripts, and Docker files.
- Root docs, `.env.example` templates, fake demo data, and release metadata.

Release archives do not include:

- `.env` files, tokens, cookies, SSH keys, or agent env exports.
- Populated Wiki vaults, Personal OS database dumps, task history, reminders,
  server inventory, private screenshots, logs, `node_modules`, `.next`, or
  generated runtime data.

## User Install Paths

### Path A: Download A GitHub Release

Download one of the release assets:

```text
personal-os-wiki-v0.1.1.zip
personal-os-wiki-v0.1.1.tar.gz
SHA256SUMS.txt
```

Verify the checksum, extract the archive, then follow:

- [Getting Started](./GETTING_STARTED.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [macOS Deployment Guide](./MACOS_DEPLOYMENT.md)

On macOS or Linux:

```bash
shasum -a 256 -c SHA256SUMS.txt
```

### Path B: Clone A Version Tag

```bash
git clone --branch v0.1.1 https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
```

Then follow the same Getting Started or Deployment guide.

### Path C: Track `main`

Use `main` only if you are actively developing or reviewing the project. Normal
users should prefer a release tag.

## Maintainer Packaging

Create local release archives:

```powershell
pwsh ./scripts/package-release.ps1 -Version 0.1.1
```

On Windows PowerShell without PowerShell 7:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-release.ps1 -Version 0.1.1
```

Expected output:

```text
dist/personal-os-wiki-v0.1.1.zip
dist/personal-os-wiki-v0.1.1.tar.gz   # created when tar is available
dist/SHA256SUMS.txt
```

The script stages a clean package, removes runtime/generated folders, refuses
private `.env` files, and writes SHA256 checksums.

## GitHub Release Flow

After the release checklist is clean:

```bash
git tag v0.1.1
git push origin v0.1.1
```

The `Release` workflow verifies the app, packages the source archives, and
creates a GitHub Release with the generated artifacts.

Manual fallback:

```bash
pwsh ./scripts/package-release.ps1 -Version 0.1.1
gh release create v0.1.1 dist/personal-os-wiki-v0.1.1.zip dist/SHA256SUMS.txt --title v0.1.1 --generate-notes
gh release upload v0.1.1 dist/personal-os-wiki-v0.1.1.tar.gz --clobber
```

Skip the `gh release upload ...tar.gz` command if the packaging script reports
that `tar` is unavailable and only the zip archive was created.

## Docker Images

The first public release does not publish official container images to GHCR.
Users build images locally from the release source. Official image publishing
can be added later once the runtime upgrade path and registry policy are stable.
