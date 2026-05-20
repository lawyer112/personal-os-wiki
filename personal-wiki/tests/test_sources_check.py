from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from sources_check import build_baseline, diff_against_baseline  # noqa: E402


def test_diff_against_baseline_reports_only_changed_source(tmp_path: Path) -> None:
    first = tmp_path / "10_sources" / "2026-05-13" / "first.md"
    second = tmp_path / "10_sources" / "2026-05-13" / "second.md"
    first.parent.mkdir(parents=True)
    first.write_text("First source\n", encoding="utf-8")
    second.write_text("Second source\n", encoding="utf-8")
    baseline = build_baseline(tmp_path)

    first.write_text("First source changed\n", encoding="utf-8")

    mutations = diff_against_baseline(tmp_path, baseline)

    assert [mutation.path for mutation in mutations] == ["10_sources/2026-05-13/first.md"]
    assert mutations[0].old_sha == baseline["10_sources/2026-05-13/first.md"]
    assert mutations[0].new_sha != mutations[0].old_sha
