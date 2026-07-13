# verify-adhoc
Format: JSON
Top-level: object
Size: 8
Nested depth: 2

## Schema

- kind: string
- scriptPath: string
- scriptCleanedUp: boolean
- exitCode: number
- stdout: string
- stderr: string
- checks: array (6 items)
- note: string

## Preview

```json
{
  "kind": "ad-hoc verification",
  "scriptPath": "/var/folders/wc/xnmkdjc96h3bz18t09dqnk800000gn/T/hermes-verify-04hqj718.sh",
  "scriptCleanedUp": true,
  "exitCode": 0,
  "stdout": "check: worker CLI help\ncheck: worker syntax\ncheck: no dotenv/config dependency\ncheck: package wiki worker script exists\ncheck: compose interpolation\ncheck: compose wiki-worker service shape\nad-hoc verification passed\n",
  "stderr": "",
  "checks": [
    "worker CLI help loads without dotenv/config",
    "node --check scripts/process-wiki-write-jobs.mjs",
    "scripts/process-wiki-write-jobs.mjs no longer imports dotenv/config",
    "package.json wiki:worker script still points at worker script",
    "docker compose config --quiet with dummy non-secret env",
    "rendered compose contains wiki-worker loop command and required env keys"
  ],
  "note": "Uses dummy env values only; does not prove live 6.37 deployment, database migration, or queue drain."
}

```