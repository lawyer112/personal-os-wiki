from __future__ import annotations

from dataclasses import dataclass
import datetime as dt
import os
from pathlib import Path
from typing import Literal

from frontmatter import Frontmatter, IngestError, serialize
from locks import journal_lock
from router import resolve_target


@dataclass(frozen=True)
class WriteResult:
    path: Path
    status: Literal["created", "revision", "journal-rolled"]
    directory: Path
    rolled_to: Path | None = None


def write_note(
    target: Path,
    fm: Frontmatter,
    body: str,
    *,
    allow_journal_append: bool = False,
) -> WriteResult:
    target.parent.mkdir(parents=True, exist_ok=True)

    if fm.type == "source" and target.exists():
        raise IngestError(409, "source-immutable", {"path": str(target)})

    if fm.type == "project":
        _ensure_project_readme(target.parent, fm)

    final_path = target
    status: Literal["created", "revision"] = "created"
    if final_path.exists() and not allow_journal_append:
        final_path = next_revision_path(final_path)
        status = "revision"

    final_path.write_text(serialize(fm, body), encoding="utf-8")
    return WriteResult(path=final_path, status=status, directory=final_path.parent)


def append_journal(
    vault_root: Path,
    fm: Frontmatter,
    body: str,
    *,
    lock_timeout: float = 5,
) -> WriteResult:
    target = resolve_target(fm, vault_root)
    date = target.stem
    with journal_lock(vault_root, date, timeout=lock_timeout):
        target.parent.mkdir(parents=True, exist_ok=True)
        final_path = target
        status: Literal["created", "revision", "journal-rolled"] = "created"
        rolled_to = None
        if final_path.exists() and final_path.stat().st_size > max_journal_size_bytes():
            final_path = _next_journal_roll_path(target)
            status = "journal-rolled"
            rolled_to = final_path

        section = _journal_section(fm, body)
        if final_path.exists():
            with final_path.open("a", encoding="utf-8") as handle:
                handle.write(section)
        else:
            title = f"{final_path.stem} 日志"
            first_fm = fm.model_copy(update={"title": title, "type": "journal"})
            content = f"# {title}\n\n{section.lstrip()}"
            final_path.write_text(serialize(first_fm, content), encoding="utf-8")

        return WriteResult(path=final_path, status=status, directory=final_path.parent, rolled_to=rolled_to)


def next_revision_path(target: Path) -> Path:
    if not target.exists():
        return target
    base = target.with_suffix("")
    revision = 2
    while True:
        candidate = Path(f"{base}-r{revision}.md")
        if not candidate.exists():
            return candidate
        revision += 1


def _ensure_project_readme(project_dir: Path, fm: Frontmatter) -> None:
    readme = project_dir / "README.md"
    if readme.exists():
        return
    project_name = fm.project or project_dir.name
    stub_fm = Frontmatter(
        title=project_name,
        type="project",
        created_by=fm.created_by,
        project=project_name,
        source_type=fm.source_type,
        tags=[],
        created_at=fm.created_at,
        task_id=fm.task_id,
        agent_id=fm.agent_id,
    )
    body = f"# {project_name}\n\n项目档案。Note 自动归集到本目录。\n"
    readme.write_text(serialize(stub_fm, body), encoding="utf-8")


def max_journal_size_bytes() -> int:
    raw = os.environ.get("MAX_JOURNAL_SIZE_BYTES", "").strip()
    if not raw:
        return 1024 * 1024
    try:
        return int(raw)
    except ValueError:
        return 1024 * 1024


def _next_journal_roll_path(target: Path) -> Path:
    revision = 2
    while True:
        candidate = target.with_name(f"{target.stem}-{revision}.md")
        if not candidate.exists():
            return candidate
        revision += 1


def _journal_section(fm: Frontmatter, body: str) -> str:
    created = dt.datetime.fromisoformat((fm.created_at or "").replace("Z", "+00:00"))
    if created.tzinfo is None:
        created = created.replace(tzinfo=dt.timezone.utc)
    local_time = created.astimezone().strftime("%H:%M")
    return f"\n## {fm.created_by} @ {local_time}\n\n{body}\n\n---\n"
