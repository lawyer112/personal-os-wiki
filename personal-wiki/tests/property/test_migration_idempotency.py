from __future__ import annotations

import hashlib
import sys
import tempfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import migrate_vault  # noqa: E402


DIRS = ["20_notes", "Personal OS Inbox", "Personal Wiki Mirror"]


@st.composite
def vault_files(draw):
    count = draw(st.integers(min_value=10, max_value=30))
    names = draw(
        st.lists(
            st.text(
                alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd")),
                min_size=1,
                max_size=16,
            ),
            min_size=count,
            max_size=count,
            unique=True,
        )
    )
    result = []
    for index, name in enumerate(names):
        directory = draw(st.sampled_from(DIRS))
        prefix = draw(st.sampled_from(["", "2026-05-13-", "project-", "skill-", "export-"]))
        body = draw(
            st.sampled_from(
                [
                    "Short [[Concept]]",
                    "## next action\nDo it\n\n## DoD\nDone",
                    "# Playbook\n流程",
                    "Long background without links or markers",
                ]
            )
        )
        result.append((f"{directory}/{prefix}{index}-{name}.md", body))
    return result


def snapshot(vault: Path) -> dict[str, str]:
    files = {}
    for path in sorted(vault.rglob("*")):
        if not path.is_file():
            continue
        relpath = path.relative_to(vault).as_posix()
        files[relpath] = hashlib.sha256(path.read_bytes()).hexdigest()
    return files


@given(files=vault_files())
@settings(max_examples=100, deadline=None)
def test_migration_is_idempotent(files: list[tuple[str, str]]) -> None:
    with tempfile.TemporaryDirectory() as directory:
        vault = Path(directory) / "vault"
        for relpath, body in files:
            path = vault / relpath
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(body, encoding="utf-8")

        migrate_vault.run_migration(vault, apply=True, yes=True, batch_id="test-batch")
        once = snapshot(vault)
        migrate_vault.run_migration(vault, apply=True, yes=True, batch_id="test-batch")
        twice = snapshot(vault)

        assert twice == once
