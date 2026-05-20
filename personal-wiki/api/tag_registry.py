from __future__ import annotations

from dataclasses import dataclass
import datetime as dt
from pathlib import Path
import re

from filelock import FileLock


TAG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9\-]{0,40}$")
APPROVED_HEADER = "## 已批准"
PENDING_HEADER = "## 待审"


@dataclass(frozen=True)
class TagRegistry:
    approved: set[str]
    pending: set[str]


def load_registry(vault_root: Path) -> TagRegistry:
    path = registry_path(vault_root)
    if not path.exists():
        ensure_registry_template(vault_root)
    text = path.read_text(encoding="utf-8")
    return TagRegistry(
        approved=parse_section(text, APPROVED_HEADER),
        pending=parse_section(text, PENDING_HEADER),
    )


def append_pending(
    vault_root: Path,
    tag: str,
    created_by: str,
    task_id: str | None,
    first_seen: str | None = None,
) -> None:
    if not TAG_PATTERN.match(tag):
        return
    path = registry_path(vault_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(path.with_suffix(".lock")), timeout=5):
        if not path.exists():
            ensure_registry_template(vault_root)
        registry = load_registry(vault_root)
        if tag in registry.approved or tag in registry.pending:
            return
        text = path.read_text(encoding="utf-8")
        line = f"- `{tag}` — 首次出现 created_by={created_by} task_id={task_id or ''} {first_seen or now_iso()}"
        if PENDING_HEADER not in text:
            text = text.rstrip() + f"\n\n{PENDING_HEADER}\n"
        text = text.rstrip() + f"\n{line}\n"
        path.write_text(text, encoding="utf-8")


def ensure_registry_template(vault_root: Path) -> None:
    path = registry_path(vault_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    path.write_text("# Tag Registry\n\n## 已批准\n\n## 待审\n", encoding="utf-8")


def registry_path(vault_root: Path) -> Path:
    return vault_root / "00_meta" / "tags.md"


def parse_section(text: str, header: str) -> set[str]:
    start = text.find(header)
    if start == -1:
        return set()
    rest = text[start + len(header) :]
    next_header = rest.find("\n## ")
    section = rest if next_header == -1 else rest[:next_header]
    return {match.group(1).lower() for match in re.finditer(r"-\s+`([^`]+)`", section)}


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
