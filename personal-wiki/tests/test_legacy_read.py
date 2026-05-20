from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from server import read_note, read_note_records  # noqa: E402


def test_reads_legacy_note_with_synthesized_frontmatter_without_rewriting(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    data_dir = tmp_path / "data"
    legacy = data_dir / "vault" / "Personal OS Inbox" / "legacy.md"
    legacy.parent.mkdir(parents=True)
    original = "# Legacy title\n\nOld body"
    legacy.write_text(original, encoding="utf-8")
    monkeypatch.setattr("server.DATA_DIR", data_dir)
    monkeypatch.setattr("server.VAULT_DIR", data_dir / "vault")
    monkeypatch.setattr("server.PUBLIC_DIR", data_dir / "public")
    monkeypatch.setattr("server.NOTE_INDEX_PATH", data_dir / "public" / "note-index.json")
    monkeypatch.setattr("server.SOURCE_INDEX_PATH", data_dir / "public" / "source-index.json")
    monkeypatch.setattr("server.GRAPH_PATH", data_dir / "public" / "graph-data.json")

    note = read_note("vault/Personal OS Inbox/legacy.md")
    records = read_note_records()

    assert note["frontmatter"]["created_by"] == "unknown"
    assert note["frontmatter"]["type"] == "legacy"
    assert note["frontmatter"]["source_type"] == "user-note"
    assert note["frontmatter"]["tags"] == []
    assert note["frontmatter"]["created_at"]
    assert note["title"] == "Legacy title"
    assert records[0]["path"] == "vault/Personal OS Inbox/legacy.md"
    assert records[0]["type"] == "legacy"
    assert legacy.read_text(encoding="utf-8") == original
