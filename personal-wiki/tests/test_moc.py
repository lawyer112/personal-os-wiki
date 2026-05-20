from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from moc import rebuild_moc  # noqa: E402


def note(vault: Path, relpath: str, title: str, note_type: str, extra: str = "") -> Path:
    path = vault / relpath
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"""---
title: {title}
type: {note_type}
created_by: user
source_type: user-note
tags: []
created_at: 2026-05-13T10:00:00+08:00
{extra}---

# {title}
""",
        encoding="utf-8",
    )
    return path


def test_rebuild_moc_renders_sections_and_preserves_user_block(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    note(vault, "20_atoms/x-like.md", "X Like", "atom", extra="tags:\n  - x-likes\n  - content-matrix\nsummary: Useful x like\n")
    note(vault, "20_atoms/atom.md", "东京交通", "atom")
    note(vault, "30_projects/tokyo/README.md", "2026-05 东京行", "project")
    note(vault, "40_journals/2026-05-13.md", "2026-05-13 日志", "journal")
    note(vault, "50_skills/travel.md", "旅行规划", "skill")
    note(vault, "90_archive/needs-review/old.md", "旧笔记", "needs-review")
    index = vault / "00_meta" / "index.md"
    index.parent.mkdir(parents=True)
    index.write_text(
        "<!-- moc:user-block -->\n保留我的手写索引\n<!-- /moc:user-block -->\n",
        encoding="utf-8",
    )

    content = rebuild_moc(vault)

    assert "## 最近 Atoms" in content
    assert "[[20_atoms/atom]]" in content
    assert "[[30_projects/tokyo/README]]" in content
    assert "[[40_journals/2026-05-13]]" in content
    assert "[[50_skills/travel]]" in content
    assert "[[90_archive/needs-review/old]]" in content
    tag_map = vault / "00_meta" / "tag-maps" / "x-likes.md"
    assert tag_map.exists()
    assert "X Likes 知识地图" in tag_map.read_text(encoding="utf-8")
    assert "保留我的手写索引" in content


def test_rebuild_moc_limits_each_section_to_top_twenty(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    for index in range(25):
      note(
          vault,
          f"20_atoms/atom-{index}.md",
          f"Atom {index}",
          "atom",
          extra=f"created_at: 2026-05-{index + 1:02d}T10:00:00+08:00\n",
      )

    content = rebuild_moc(vault)

    atom_lines = [line for line in content.splitlines() if line.startswith("- [[20_atoms/atom-")]
    assert len(atom_lines) == 20


def test_rebuild_moc_places_missing_tasks_in_orphan_section(
    tmp_path: Path,
    monkeypatch,
) -> None:
    vault = tmp_path / "vault"
    note(vault, "20_atoms/lost.md", "Lost task", "atom", extra="task_id: task_lost\n")
    monkeypatch.setattr("moc.task_exists", lambda task_id: False)

    content = rebuild_moc(vault)

    assert "## 孤儿任务" in content
    assert "[[20_atoms/lost]] · task_id=task_lost" in content
    atoms = content.split("## 最近 Atoms", 1)[1].split("## 活跃项目", 1)[0]
    assert "[[20_atoms/lost]]" not in atoms
