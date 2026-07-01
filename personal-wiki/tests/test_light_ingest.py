from __future__ import annotations

import json
import sys
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

import server  # noqa: E402


class LightIngestTests(unittest.TestCase):
    def test_light_ingest_marks_note_dirty_without_rebuilding_indexes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            data_dir = Path(tmp_dir)
            vault_dir = data_dir / "vault"
            public_dir = data_dir / "public"
            notes_dir = vault_dir / "20_notes"
            atoms_dir = vault_dir / "20_atoms"
            dirty_path = public_dir / "ingestion" / "dirty-notes.json"

            patches = [
                patch.object(server, "DATA_DIR", data_dir),
                patch.object(server, "VAULT_DIR", vault_dir),
                patch.object(server, "SOURCES_DIR", vault_dir / "10_sources"),
                patch.object(server, "NOTES_DIR", notes_dir),
                patch.object(server, "ATOMS_DIR", atoms_dir),
                patch.object(server, "NOTE_CONTENT_DIRS", (notes_dir, atoms_dir)),
                patch.object(server, "ARCHIVE_DIR", vault_dir / "90_archive"),
                patch.object(server, "PUBLIC_DIR", public_dir),
                patch.object(server, "GRAPH_PATH", public_dir / "graph-data.json"),
                patch.object(server, "NOTE_INDEX_PATH", public_dir / "note-index.json"),
                patch.object(server, "INGESTION_DIR", public_dir / "ingestion"),
                patch.object(server, "DIRTY_NOTES_PATH", dirty_path, create=True),
                patch.object(server, "init_git"),
                patch.object(server, "refresh_public_indexes", side_effect=AssertionError("should not rebuild")),
                patch.object(server, "git_commit", side_effect=AssertionError("should not commit")),
            ]

            with ExitStack() as stack:
                for item in patches:
                    stack.enter_context(item)
                result = server.ingest(
                    {
                        "title": "Light ingest note",
                        "content": "Body",
                        "source_type": "agent-output",
                        "tags": ["personal-os"],
                    },
                    light=True,
                )

            dirty = json.loads(dirty_path.read_text(encoding="utf-8"))

            self.assertEqual(result["status"], "created")
            self.assertEqual(result["indexing"], "deferred")
            self.assertEqual(result["git"], "deferred")
            self.assertTrue(Path(data_dir / result["note_path"]).exists())
            self.assertIn(result["note_path"], dirty["paths"])


if __name__ == "__main__":
    unittest.main()
