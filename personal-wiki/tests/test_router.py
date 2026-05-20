from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from frontmatter import Frontmatter  # noqa: E402
from router import resolve_target  # noqa: E402


def fm(note_type: str, **overrides: object) -> Frontmatter:
    data = {
        "title": "东京交通整理",
        "type": note_type,
        "created_by": "user",
        "source_type": "user-note",
        "tags": [],
        "created_at": "2026-05-13T10:00:00+08:00",
    }
    data.update(overrides)
    return Frontmatter.model_validate(data)


def test_routes_source_by_local_date(tmp_path: Path) -> None:
    assert resolve_target(fm("source"), tmp_path) == tmp_path / "10_sources" / "2026-05-13" / "东京交通整理.md"


def test_routes_project_under_project_slug(tmp_path: Path) -> None:
    assert resolve_target(fm("project", project="2026-05 东京行"), tmp_path) == (
        tmp_path / "30_projects" / "2026-05-东京行" / "东京交通整理.md"
    )


def test_routes_journal_to_daily_file(tmp_path: Path) -> None:
    assert resolve_target(fm("journal"), tmp_path) == tmp_path / "40_journals" / "2026-05-13.md"


def test_routes_atom_to_harden_path_by_default(tmp_path: Path) -> None:
    assert resolve_target(fm("atom"), tmp_path) == tmp_path / "20_atoms" / "东京交通整理.md"


def test_routes_skill_to_harden_path_by_default(tmp_path: Path) -> None:
    assert resolve_target(fm("skill"), tmp_path) == tmp_path / "50_skills" / "东京交通整理.md"


def test_routes_atom_to_mvp_quarantine_when_flag_disabled(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("WIKI_HARDEN_PATHS_ENABLED", "0")

    assert resolve_target(fm("atom"), tmp_path) == (
        tmp_path / "90_archive" / "pending-harden" / "atom" / "东京交通整理.md"
    )


def test_routes_skill_to_mvp_quarantine_when_flag_disabled(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("WIKI_HARDEN_PATHS_ENABLED", "0")

    assert resolve_target(fm("skill"), tmp_path) == (
        tmp_path / "90_archive" / "pending-harden" / "skill" / "东京交通整理.md"
    )
