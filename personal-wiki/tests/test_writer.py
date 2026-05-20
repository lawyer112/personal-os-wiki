from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from frontmatter import Frontmatter, IngestError, parse  # noqa: E402
from writer import write_note  # noqa: E402


def fm(note_type: str = "project", **overrides: object) -> Frontmatter:
    data = {
        "title": "Plan",
        "type": note_type,
        "created_by": "hermes:worker",
        "task_id": "task-1",
        "project": "Demo Project",
        "source_type": "agent-output",
        "tags": ["demo"],
        "created_at": "2026-05-13T10:00:00+08:00",
    }
    data.update(overrides)
    return Frontmatter.model_validate(data)


def test_write_note_creates_parent_and_file(tmp_path: Path) -> None:
    target = tmp_path / "30_projects" / "Demo-Project" / "Plan.md"

    result = write_note(target, fm(), "Body")

    assert result.status == "created"
    assert result.path == target
    assert target.exists()


def test_write_note_uses_revision_suffix_for_existing_file(tmp_path: Path) -> None:
    target = tmp_path / "30_projects" / "Demo-Project" / "Plan.md"
    write_note(target, fm(), "First")

    result = write_note(target, fm(), "Second")

    assert result.status == "revision"
    assert result.path.name == "Plan-r2.md"
    assert target.read_text(encoding="utf-8").endswith("First")


def test_revision_suffix_increments_for_repeated_writes(tmp_path: Path) -> None:
    target = tmp_path / "30_projects" / "Demo-Project" / "Plan.md"
    results = [write_note(target, fm(), f"Body {index}") for index in range(5)]

    assert [result.path.name for result in results] == [
        "Plan.md",
        "Plan-r2.md",
        "Plan-r3.md",
        "Plan-r4.md",
        "Plan-r5.md",
    ]
    assert all(result.status == "revision" for result in results[1:])


def test_project_write_creates_readme_stub(tmp_path: Path) -> None:
    target = tmp_path / "30_projects" / "Demo-Project" / "Plan.md"

    write_note(target, fm(project="Demo Project"), "Body")

    readme = target.parent / "README.md"
    readme_fm, readme_body = parse(readme.read_text(encoding="utf-8"))
    assert readme_fm.type == "project"
    assert readme_fm.project == "Demo Project"
    assert "# Demo Project" in readme_body


def test_source_conflict_returns_409(tmp_path: Path) -> None:
    target = tmp_path / "10_sources" / "2026-05-13" / "Article.md"
    write_note(target, fm("source", title="Article", project=None), "First")

    with pytest.raises(IngestError) as error:
        write_note(target, fm("source", title="Article", project=None), "Second")

    assert error.value.status_code == 409
    assert error.value.code == "source-immutable"
