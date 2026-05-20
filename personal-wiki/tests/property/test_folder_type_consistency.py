from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "api"))

from frontmatter import Frontmatter  # noqa: E402
from router import resolve_target  # noqa: E402


@given(note_type=st.sampled_from(["source", "project", "journal", "atom", "skill"]))
@settings(max_examples=100, deadline=None)
def test_folder_matches_type_with_harden_enabled(note_type: str) -> None:
    old = os.environ.get("WIKI_HARDEN_PATHS_ENABLED")
    os.environ["WIKI_HARDEN_PATHS_ENABLED"] = "1"
    try:
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            fm = make_fm(note_type)
            path = resolve_target(fm, vault).relative_to(vault).as_posix()

            expected = {
                "source": "10_sources/",
                "project": "30_projects/",
                "journal": "40_journals/",
                "atom": "20_atoms/",
                "skill": "50_skills/",
            }[note_type]
            assert path.startswith(expected)
    finally:
        if old is None:
            os.environ.pop("WIKI_HARDEN_PATHS_ENABLED", None)
        else:
            os.environ["WIKI_HARDEN_PATHS_ENABLED"] = old


def test_atom_skill_quarantine_when_harden_disabled(tmp_path: Path) -> None:
    old = os.environ.get("WIKI_HARDEN_PATHS_ENABLED")
    os.environ["WIKI_HARDEN_PATHS_ENABLED"] = "0"
    try:
        assert resolve_target(make_fm("atom"), tmp_path).relative_to(tmp_path).as_posix().startswith(
            "90_archive/pending-harden/atom/"
        )
        assert resolve_target(make_fm("skill"), tmp_path).relative_to(tmp_path).as_posix().startswith(
            "90_archive/pending-harden/skill/"
        )
    finally:
        if old is None:
            os.environ.pop("WIKI_HARDEN_PATHS_ENABLED", None)
        else:
            os.environ["WIKI_HARDEN_PATHS_ENABLED"] = old


def make_fm(note_type: str) -> Frontmatter:
    data = {
        "title": "Tokyo",
        "type": note_type,
        "created_by": "user",
        "source_type": "user-note",
        "tags": [],
        "created_at": "2026-05-13T10:00:00+08:00",
    }
    if note_type == "project":
        data["project"] = "Project"
    return Frontmatter.model_validate(data)
