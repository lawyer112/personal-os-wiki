from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import migrate_vault  # noqa: E402


def write_note(vault: Path, relpath: str, body: str) -> Path:
    path = vault / relpath
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


def fixture_vault(vault: Path) -> list[str]:
    files = {
        "20_notes/2026-05-13 daily.md": "# Daily\n\nToday",
        "20_notes/deeptalk export.md": "# Transcript\n\nraw",
        "20_notes/project-alpha.md": "## next action\nShip it\n\n## DoD\nDone",
        "20_notes/workflow checklist.md": "# Workflow\n\nSteps",
        "20_notes/atom-link.md": "Short [[Concept]]",
        "20_notes/unknown.md": "Long background without clear markers",
        "Personal OS Inbox/inbox-project.md": "## next action\nPlan\n\n## DoD\nReview",
        "Personal Wiki Mirror/skill-playbook.md": "# Playbook\n\n流程",
        "Personal Wiki Mirror/export-source.md": "# Export\n\nsource",
        "Personal Wiki Mirror/2026-05-14.md": "# Journal\n\nentry",
        "10_sources/2026-05-13/keep.md": "Do not scan",
    }
    for relpath, body in files.items():
        write_note(vault, relpath, body)
    return [relpath for relpath in files if not relpath.startswith("10_sources/")]


def test_dry_run_outputs_plan_without_writing(tmp_path: Path, capsys) -> None:
    vault = tmp_path / "vault"
    expected = fixture_vault(vault)

    exit_code = migrate_vault.main(["--dry-run", "--vault", str(vault)])

    output = capsys.readouterr().out
    assert exit_code == 0
    assert output.count("PLAN ") == len(expected)
    assert (vault / "20_notes/atom-link.md").exists()
    assert not (vault / "00_meta" / "migration-report.md").exists()


def test_apply_moves_files_and_writes_report(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    fixture_vault(vault)

    exit_code = migrate_vault.main(["--apply", "--yes", "--vault", str(vault)])

    assert exit_code == 0
    assert not (vault / "20_notes/atom-link.md").exists()
    assert (vault / "20_atoms" / "atom-link.md").exists()
    assert (vault / "40_journals" / "2026-05-13-daily.md").exists()
    assert (vault / "10_sources" / "2026-05-13" / "keep.md").exists()
    report = vault / "00_meta" / "migration-report.md"
    assert report.exists()
    assert "Migration Report" in report.read_text(encoding="utf-8")
    state = json.loads((vault / "00_meta" / ".migration-state.json").read_text(encoding="utf-8"))
    assert all(entry["status"] == "done" for entry in state["entries"])


def test_resume_skips_done_entries(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    source = write_note(vault, "20_notes/already-done.md", "Short [[Done]]")
    write_note(vault, "20_notes/new-atom.md", "Short [[New]]")
    state_path = vault / "00_meta" / ".migration-state.json"
    state_path.parent.mkdir(parents=True)
    state_path.write_text(
        json.dumps(
            {
                "batch_id": "test-batch",
                "entries": [
                    {
                        "src": "20_notes/already-done.md",
                        "target": "20_atoms/already-done.md",
                        "status": "done",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    exit_code = migrate_vault.main(["--apply", "--yes", "--resume", "--vault", str(vault)])

    assert exit_code == 0
    assert source.exists()
    assert (vault / "20_atoms" / "new-atom.md").exists()
