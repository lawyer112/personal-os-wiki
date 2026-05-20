from __future__ import annotations

from dataclasses import dataclass
import datetime as dt
import os
from pathlib import Path
import time
from typing import Any
import urllib.error
import urllib.request

import yaml


AUTO_START = "<!-- moc:auto-block -->"
AUTO_END = "<!-- /moc:auto-block -->"
USER_START = "<!-- moc:user-block -->"
USER_END = "<!-- /moc:user-block -->"
TASK_CACHE_TTL_SECONDS = 300
_TASK_CACHE: dict[str, tuple[float, bool]] = {}


@dataclass(frozen=True)
class MocNote:
    path: Path
    relpath: str
    title: str
    note_type: str
    created_by: str
    created_at: str
    task_id: str


def rebuild_moc(vault_root: Path) -> str:
    vault_root.mkdir(parents=True, exist_ok=True)
    notes = scan_notes(vault_root)
    orphan_notes = [note for note in notes if note.task_id and not task_exists(note.task_id)]
    orphan_paths = {note.relpath for note in orphan_notes}
    main_notes = [note for note in notes if note.relpath not in orphan_paths]
    content = render_moc(vault_root, main_notes, orphan_notes)
    target = vault_root / "00_meta" / "index.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return content


def scan_notes(vault_root: Path) -> list[MocNote]:
    roots = [
        vault_root / "20_atoms",
        vault_root / "30_projects",
        vault_root / "40_journals",
        vault_root / "50_skills",
        vault_root / "90_archive" / "needs-review",
    ]
    notes = []
    for root in roots:
        if not root.exists():
            continue
        for path in sorted(root.rglob("*.md")):
            try:
                fm, body = parse_note(path)
            except FileNotFoundError:
                continue
            relpath = path.relative_to(vault_root).as_posix()
            notes.append(
                MocNote(
                    path=path,
                    relpath=relpath,
                    title=title_for(path, fm, body),
                    note_type=note_type_for(relpath, fm),
                    created_by=str(fm.get("created_by") or "unknown"),
                    created_at=str(fm.get("created_at") or ""),
                    task_id=str(fm.get("task_id") or ""),
                )
            )
    return sorted(notes, key=lambda note: sort_key(note), reverse=True)


def parse_note(path: Path) -> tuple[dict[str, Any], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text
    raw = text[4:end]
    body = text[end + 5 :]
    loaded = yaml.safe_load(raw) or {}
    return loaded if isinstance(loaded, dict) else {}, body


def note_type_for(relpath: str, fm: dict[str, Any]) -> str:
    if relpath.startswith("90_archive/needs-review/"):
        return "needs-review"
    return str(fm.get("type") or "legacy")


def title_for(path: Path, fm: dict[str, Any], body: str) -> str:
    title = str(fm.get("title") or "").strip()
    if title:
        return title
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip() or path.stem
    return path.stem


def sort_key(note: MocNote) -> float:
    try:
        return dt.datetime.fromisoformat(note.created_at.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return note.path.stat().st_mtime


def render_moc(vault_root: Path, notes: list[MocNote], orphan_notes: list[MocNote]) -> str:
    existing = vault_root / "00_meta" / "index.md"
    user_block = extract_user_block(existing.read_text(encoding="utf-8") if existing.exists() else "")
    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    sections = [
        AUTO_START,
        "# Vault Index",
        "",
        f"最后更新：{generated_at}",
        "",
        render_section("最近 Atoms", [note for note in notes if note.note_type == "atom"]),
        render_section("活跃项目", [note for note in notes if note.note_type == "project"]),
        render_section("最近 Journals", [note for note in notes if note.note_type == "journal"]),
        render_section("Skills", [note for note in notes if note.note_type == "skill"]),
        render_section("待审 needs-review", [note for note in notes if note.note_type == "needs-review"]),
        render_orphans(orphan_notes),
        AUTO_END,
        "",
        user_block,
    ]
    return "\n".join(sections).rstrip() + "\n"


def render_section(title: str, notes: list[MocNote]) -> str:
    lines = [f"## {title}", ""]
    if not notes:
        lines.append("- 暂无")
    for note in notes[:20]:
        lines.append(f"- {wikilink(note)} · {note.title} · created_by={note.created_by} · {date_part(note.created_at)}")
    lines.append("")
    return "\n".join(lines)


def render_orphans(notes: list[MocNote]) -> str:
    lines = ["## 孤儿任务", ""]
    if not notes:
        lines.append("- 暂无")
    for note in notes[:20]:
        lines.append(f"- {wikilink(note)} · task_id={note.task_id} · 已无对应 Personal OS 任务")
    lines.append("")
    return "\n".join(lines)


def wikilink(note: MocNote) -> str:
    return f"[[{note.relpath.removesuffix('.md')}]]"


def date_part(value: str) -> str:
    return value[:10] if value else ""


def extract_user_block(text: str) -> str:
    start = text.find(USER_START)
    end = text.find(USER_END)
    if start != -1 and end != -1 and end > start:
        return text[start : end + len(USER_END)].strip()
    return f"{USER_START}\n\n{USER_END}"


def task_exists(task_id: str) -> bool:
    now = time.monotonic()
    cached = _TASK_CACHE.get(task_id)
    if cached and now - cached[0] < TASK_CACHE_TTL_SECONDS:
        return cached[1]

    base_url = os.environ.get("PERSONAL_OS_BASE_URL", "").strip()
    if not base_url:
        return True
    url = f"{base_url.rstrip('/')}/api/tasks/{task_id}"
    request = urllib.request.Request(url)
    token = os.environ.get("PERSONAL_OS_READ_TOKEN", "").strip()
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            exists = response.status != 404
    except urllib.error.HTTPError as error:
        exists = error.code != 404
    except OSError:
        exists = True
    _TASK_CACHE[task_id] = (now, exists)
    return exists
