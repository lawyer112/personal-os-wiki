from __future__ import annotations

import re
import sys
import tempfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "api"))

import moc  # noqa: E402


@given(count=st.integers(min_value=2, max_value=30))
@settings(max_examples=100, deadline=None)
def test_each_task_id_is_in_main_or_orphan_section_not_both(count: int) -> None:
    with tempfile.TemporaryDirectory() as directory:
        vault = Path(directory) / "vault"
        existing = {f"task_{index}" for index in range(count) if index % 2 == 0}
        for index in range(count):
            path = vault / "20_atoms" / f"note-{index}.md"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                f"""---
title: Note {index}
type: atom
created_by: hermes:worker
task_id: task_{index}
source_type: agent-output
tags: []
created_at: 2026-05-13T10:00:00+08:00
---

# Note {index}
""",
                encoding="utf-8",
            )

        original = moc.task_exists
        moc.task_exists = lambda task_id: task_id in existing
        try:
            content = moc.rebuild_moc(vault)
        finally:
            moc.task_exists = original

        main = content.split("## 孤儿任务", 1)[0]
        orphan = content.split("## 孤儿任务", 1)[1]
        for index in range(count):
            task_id = f"task_{index}"
            in_main = task_id in main or f"[[20_atoms/note-{index}]]" in main
            in_orphan = re.search(rf"task_id={task_id}\b", orphan) is not None
            assert in_main != in_orphan
