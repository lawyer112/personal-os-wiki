from __future__ import annotations

import threading
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from frontmatter import Frontmatter, parse  # noqa: E402
from writer import append_journal  # noqa: E402


def fm(**overrides: object) -> Frontmatter:
    data = {
        "title": "Daily log",
        "type": "journal",
        "created_by": "hermes:dispatcher",
        "task_id": "task-1",
        "source_type": "agent-output",
        "tags": [],
        "created_at": "2026-05-13T10:15:00+08:00",
    }
    data.update(overrides)
    return Frontmatter.model_validate(data)


def test_first_append_creates_journal_with_frontmatter(tmp_path: Path) -> None:
    result = append_journal(tmp_path, fm(), "Morning plan")

    assert result.status == "created"
    journal = tmp_path / "40_journals" / "2026-05-13.md"
    frontmatter, body = parse(journal.read_text(encoding="utf-8"))
    assert frontmatter.type == "journal"
    assert frontmatter.created_by == "hermes:dispatcher"
    assert "# 2026-05-13 日志" in body
    assert "## hermes:dispatcher @ 10:15" in body
    assert "Morning plan" in body


def test_second_append_keeps_existing_frontmatter(tmp_path: Path) -> None:
    append_journal(tmp_path, fm(created_by="user", task_id=None), "First")
    append_journal(tmp_path, fm(created_by="user", task_id=None, created_at="2026-05-13T11:00:00+08:00"), "Second")

    text = (tmp_path / "40_journals" / "2026-05-13.md").read_text(encoding="utf-8")
    frontmatter, body = parse(text)
    assert frontmatter.created_at == "2026-05-13T10:15:00+08:00"
    assert "First" in text
    assert "Second" in body


def test_concurrent_appends_are_not_lost(tmp_path: Path) -> None:
    threads = [
        threading.Thread(target=append_journal, args=(tmp_path, fm(created_at=f"2026-05-13T10:1{index}:00+08:00"), f"Entry {index}"))
        for index in range(2)
    ]

    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    text = (tmp_path / "40_journals" / "2026-05-13.md").read_text(encoding="utf-8")
    assert "Entry 0" in text
    assert "Entry 1" in text


def test_journal_rolls_when_file_exceeds_threshold(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("MAX_JOURNAL_SIZE_BYTES", "10")
    journal = tmp_path / "40_journals" / "2026-05-13.md"
    journal.parent.mkdir(parents=True)
    journal.write_text("x" * 20, encoding="utf-8")

    result = append_journal(tmp_path, fm(), "Rolled entry")

    assert result.status == "journal-rolled"
    assert result.rolled_to == tmp_path / "40_journals" / "2026-05-13-2.md"
    assert "Rolled entry" in result.rolled_to.read_text(encoding="utf-8")
