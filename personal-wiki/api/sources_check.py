from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path


@dataclass(frozen=True)
class Mutation:
    path: str
    old_sha: str
    new_sha: str


def build_baseline(vault_root: Path) -> dict[str, str]:
    source_root = vault_root / "10_sources"
    if not source_root.exists():
        return {}
    return {
        path.relative_to(vault_root).as_posix(): sha256_file(path)
        for path in sorted(source_root.rglob("*.md"))
        if path.is_file()
    }


def diff_against_baseline(vault_root: Path, baseline: dict[str, str]) -> list[Mutation]:
    current = build_baseline(vault_root)
    paths = sorted(set(baseline) | set(current))
    mutations = []
    for path in paths:
        old_sha = baseline.get(path, "")
        new_sha = current.get(path, "")
        if old_sha != new_sha:
            mutations.append(Mutation(path=path, old_sha=old_sha, new_sha=new_sha))
    return mutations


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
