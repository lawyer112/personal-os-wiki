#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import dataclass
import datetime as dt
import json
import os
from pathlib import Path
import re
import shutil
import sys
from typing import Any

import yaml


API_DIR = Path(__file__).resolve().parents[1] / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from slugifier import slugify  # noqa: E402


VALID_TYPES = {"atom", "project", "journal", "skill", "source"}
SCAN_ROOTS = ("20_notes", "Personal OS Inbox", "Personal Wiki Mirror")


@dataclass(frozen=True)
class MigrationPlan:
    src: Path
    target: Path
    rel_src: str
    rel_target: str
    note_type: str
    confidence: float
    status: str = "planned"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Restructure a Personal Wiki vault.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument("--yes", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--confidence-min", type=float, default=0.7)
    parser.add_argument("--vault", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "vault")
    args = parser.parse_args(argv)

    return run_migration(
        args.vault,
        dry_run=args.dry_run,
        apply=args.apply,
        yes=args.yes,
        resume=args.resume,
        confidence_min=args.confidence_min,
    )


def run_migration(
    vault: Path,
    *,
    dry_run: bool = False,
    apply: bool = False,
    yes: bool = False,
    resume: bool = False,
    confidence_min: float = 0.7,
    batch_id: str | None = None,
) -> int:
    vault = vault.resolve()
    if apply and not yes:
        raise SystemExit("--apply requires --yes")

    batch_id = batch_id or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    state = load_state(vault) if resume else {"batch_id": batch_id, "entries": []}
    done = {entry.get("src") for entry in state.get("entries", []) if entry.get("status") == "done"}
    plans = [
        plan
        for plan in build_plan(vault, confidence_min=confidence_min)
        if not resume or plan.rel_src not in done
    ]

    if dry_run:
        for plan in plans:
            print(f"PLAN {plan.rel_src} -> {plan.rel_target} type={plan.note_type} confidence={plan.confidence:.2f}")
        return 0

    if apply and not plans and migration_report_path(vault).exists():
        return 0

    moved = []
    for plan in plans:
        write_state(vault, state_with_entry(state, plan, "pending"))
        move_one(plan, batch_id)
        done_plan = MigrationPlan(
            src=plan.src,
            target=plan.target,
            rel_src=plan.rel_src,
            rel_target=plan.rel_target,
            note_type=plan.note_type,
            confidence=plan.confidence,
            status="moved",
        )
        moved.append(done_plan)
        state = state_with_entry(state, plan, "done")
        write_state(vault, state)

    if apply:
        write_report(vault, batch_id, moved)
    return 0


def build_plan(vault: Path, *, confidence_min: float = 0.7) -> list[MigrationPlan]:
    plans = []
    for path in iter_candidates(vault):
        text = path.read_text(encoding="utf-8")
        fm, body = split_frontmatter(text)
        note_type, confidence = classify(path, vault, fm, body)
        if confidence < confidence_min:
            note_type = "needs-review"
        target = target_for(path, vault, fm, body, note_type)
        plans.append(
            MigrationPlan(
                src=path,
                target=target,
                rel_src=path.relative_to(vault).as_posix(),
                rel_target=target.relative_to(vault).as_posix(),
                note_type=note_type,
                confidence=confidence,
            )
        )
    return plans


def iter_candidates(vault: Path):
    for root_name in SCAN_ROOTS:
        root = vault / root_name
        if not root.exists():
            continue
        for path in sorted(root.rglob("*.md")):
            if path.is_file():
                yield path


def split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text
    raw = text[4:end]
    body = text[end + 5 :]
    loaded = yaml.safe_load(raw) or {}
    return loaded if isinstance(loaded, dict) else {}, body


def classify(path: Path, vault: Path, fm: dict[str, Any], body: str) -> tuple[str, float]:
    rel_lower = path.relative_to(vault).as_posix().lower()
    name = path.name
    if re.search(r"transcript|export|deeptalk", rel_lower):
        return "source", 1.0
    if re.search(r"journal|daily|diary", rel_lower):
        return "journal", 0.9
    if re.match(r"^\d{4}-\d{2}-\d{2}", name):
        return "journal", 0.9
    if str(fm.get("type") or "") in VALID_TYPES:
        return str(fm["type"]), 1.0
    if re.search(r"project|工程|项目", rel_lower) or (
        "Personal OS Inbox" in path.parts and re.search(r"(?im)^##\s*(next action|DoD)\s*$", body)
    ):
        return "project", 0.8
    if re.search(r"skill|workflow|流程|playbook|手册", rel_lower):
        return "skill", 0.8
    if len(body) <= 800 and re.search(r"\[\[[^\]]+\]\]", body):
        return "atom", 0.7
    return "needs-review", 0.0


def target_for(path: Path, vault: Path, fm: dict[str, Any], body: str, note_type: str) -> Path:
    title = title_for(path, fm, body)
    created_date = dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc).date().isoformat()
    slug = slugify(title)
    if note_type == "source":
        return unique_target(vault / "10_sources" / created_date / f"{slug}.md")
    if note_type == "journal":
        return unique_target(vault / "40_journals" / f"{slugify(path.stem)}.md")
    if note_type == "project":
        project = str(fm.get("project") or title).strip()
        return unique_target(vault / "30_projects" / slugify(project) / f"{slug}.md")
    if note_type == "skill":
        return unique_target(vault / "50_skills" / f"{slug}.md")
    if note_type == "atom":
        return unique_target(vault / "20_atoms" / f"{slug}.md")
    return unique_target(vault / "90_archive" / "needs-review" / path.relative_to(vault))


def unique_target(target: Path) -> Path:
    if not target.exists():
        return target
    base = target.with_suffix("")
    for index in range(2, 1000):
        candidate = Path(f"{base}-r{index}{target.suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError(f"Cannot find unique target for {target}")


def title_for(path: Path, fm: dict[str, Any], body: str) -> str:
    title = str(fm.get("title") or "").strip()
    if title:
        return title
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip() or path.stem
    return path.stem


def move_one(plan: MigrationPlan, batch_id: str) -> None:
    stat = plan.src.stat()
    text = plan.src.read_text(encoding="utf-8")
    fm, body = split_frontmatter(text)
    next_text = render_with_frontmatter(plan.src, fm, body, plan.note_type, batch_id)
    plan.target.parent.mkdir(parents=True, exist_ok=True)
    plan.target.write_text(next_text, encoding="utf-8")
    os.utime(plan.target, (stat.st_atime, stat.st_mtime))
    plan.src.unlink()
    prune_empty_dirs(plan.src.parent)


def render_with_frontmatter(
    path: Path,
    fm: dict[str, Any],
    body: str,
    note_type: str,
    batch_id: str,
) -> str:
    created_at = dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc).isoformat()
    title = title_for(path, fm, body)
    next_fm = {
        **fm,
        "title": str(fm.get("title") or title),
        "type": note_type,
        "created_by": str(fm.get("created_by") or "user"),
        "agent_id": str(fm.get("agent_id") or ""),
        "task_id": str(fm.get("task_id") or ""),
        "project": str(fm.get("project") or (title if note_type == "project" else "")),
        "source_type": str(fm.get("source_type") or "user-note"),
        "tags": fm.get("tags") if isinstance(fm.get("tags"), list) else [],
        "created_at": str(fm.get("created_at") or created_at),
        "migration": str(fm.get("migration") or f"legacy-{batch_id}"),
    }
    yaml_text = yaml.safe_dump(next_fm, allow_unicode=True, sort_keys=False).strip()
    return f"---\n{yaml_text}\n---\n\n{body.strip()}\n"


def prune_empty_dirs(path: Path) -> None:
    while path.exists() and path.name not in SCAN_ROOTS:
        try:
            path.rmdir()
        except OSError:
            return
        path = path.parent


def migration_report_path(vault: Path) -> Path:
    return vault / "00_meta" / "migration-report.md"


def state_path(vault: Path) -> Path:
    return vault / "00_meta" / ".migration-state.json"


def load_state(vault: Path) -> dict[str, Any]:
    path = state_path(vault)
    if not path.exists():
        return {"batch_id": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(), "entries": []}
    return json.loads(path.read_text(encoding="utf-8"))


def state_with_entry(state: dict[str, Any], plan: MigrationPlan, status: str) -> dict[str, Any]:
    entries = [
        entry
        for entry in state.get("entries", [])
        if entry.get("src") != plan.rel_src
    ]
    entries.append({"src": plan.rel_src, "target": plan.rel_target, "status": status})
    return {"batch_id": state.get("batch_id"), "entries": entries}


def write_state(vault: Path, state: dict[str, Any]) -> None:
    path = state_path(vault)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_report(vault: Path, batch_id: str, plans: list[MigrationPlan]) -> None:
    path = migration_report_path(vault)
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = [
        "# Migration Report — batch " + batch_id,
        "",
        "| 原路径 | 分类 | 置信度 | 目标路径 | 状态 |",
        "|---|---|---|---|---|",
    ]
    for plan in plans:
        rows.append(
            f"| {plan.rel_src} | {plan.note_type} | {plan.confidence:.2f} | {plan.rel_target} | {plan.status} |"
        )
    path.write_text("\n".join(rows) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
