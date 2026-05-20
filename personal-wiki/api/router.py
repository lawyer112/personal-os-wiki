from __future__ import annotations

import datetime as dt
import os
from pathlib import Path

from frontmatter import Frontmatter
from slugifier import slugify


def resolve_target(fm: Frontmatter, vault_root: Path) -> Path:
    date = _local_date(fm.created_at or dt.datetime.now(dt.timezone.utc).isoformat())
    title_slug = slugify(fm.title or "")

    if fm.type == "source":
        return vault_root / "10_sources" / date / f"{title_slug}.md"
    if fm.type == "project":
        return vault_root / "30_projects" / slugify(fm.project or "") / f"{title_slug}.md"
    if fm.type == "journal":
        return vault_root / "40_journals" / f"{date}.md"
    if fm.type == "atom":
        if harden_paths_enabled():
            return vault_root / "20_atoms" / f"{title_slug}.md"
        return vault_root / "90_archive" / "pending-harden" / "atom" / f"{title_slug}.md"
    if fm.type == "skill":
        if harden_paths_enabled():
            return vault_root / "50_skills" / f"{title_slug}.md"
        return vault_root / "90_archive" / "pending-harden" / "skill" / f"{title_slug}.md"

    raise ValueError(f"Unsupported note type: {fm.type}")


def _local_date(value: str) -> str:
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone().date().isoformat()


def harden_paths_enabled() -> bool:
    raw = os.environ.get("WIKI_HARDEN_PATHS_ENABLED")
    if raw is None:
        return True
    return raw.strip().lower() not in {"0", "false", "no", "off"}
