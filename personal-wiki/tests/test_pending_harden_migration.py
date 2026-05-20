from __future__ import annotations

import hashlib
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import migrate_pending_harden  # noqa: E402


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_migrate_pending_harden_dry_run_does_not_move(tmp_path: Path, capsys) -> None:
    vault = tmp_path / "vault"
    source = vault / "90_archive" / "pending-harden" / "atom" / "a.md"
    source.parent.mkdir(parents=True)
    source.write_text("atom", encoding="utf-8")

    exit_code = migrate_pending_harden.main(["--dry-run", "--vault", str(vault)])

    assert exit_code == 0
    assert "PLAN 90_archive/pending-harden/atom/a.md -> 20_atoms/a.md" in capsys.readouterr().out
    assert source.exists()


def test_migrate_pending_harden_moves_atom_and_skill_with_same_sha(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    atom = vault / "90_archive" / "pending-harden" / "atom" / "a.md"
    skill = vault / "90_archive" / "pending-harden" / "skill" / "s.md"
    atom.parent.mkdir(parents=True)
    skill.parent.mkdir(parents=True)
    atom.write_text("atom body", encoding="utf-8")
    skill.write_text("skill body", encoding="utf-8")
    atom_sha = sha(atom)
    skill_sha = sha(skill)

    exit_code = migrate_pending_harden.main(["--apply", "--yes", "--vault", str(vault)])

    assert exit_code == 0
    assert not atom.exists()
    assert not skill.exists()
    assert sha(vault / "20_atoms" / "a.md") == atom_sha
    assert sha(vault / "50_skills" / "s.md") == skill_sha
