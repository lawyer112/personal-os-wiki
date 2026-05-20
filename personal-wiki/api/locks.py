from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from filelock import FileLock, Timeout

from frontmatter import IngestError


@contextmanager
def project_lock(vault_root: Path, project_slug: str, timeout: float = 5) -> Iterator[None]:
    lock_path = vault_root / "30_projects" / project_slug / ".lock"
    with _lock(lock_path, timeout):
        yield


@contextmanager
def journal_lock(vault_root: Path, date: str, timeout: float = 5) -> Iterator[None]:
    lock_path = vault_root / "40_journals" / f"{date}.md.lock"
    with _lock(lock_path, timeout):
        yield


@contextmanager
def migration_lock(vault_root: Path, timeout: float = 300) -> Iterator[None]:
    lock_path = vault_root / "00_meta" / ".migration.lock"
    with _lock(lock_path, timeout):
        yield


@contextmanager
def _lock(lock_path: Path, timeout: float) -> Iterator[None]:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock = FileLock(str(lock_path), timeout=timeout)
    try:
        with lock:
            yield
    except Timeout as error:
        raise IngestError(503, "lock-timeout", {"resource": str(lock_path)}) from error
