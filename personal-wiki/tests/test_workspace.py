from __future__ import annotations
import concurrent.futures
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))
import server as wiki
import workspace_server as workspace

class WorkspaceKnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        root = Path(self.directory.name)
        self.patches = [patch.object(wiki, key, value) for key, value in {
            "DATA_DIR": root, "VAULT_DIR": root / "vault", "SOURCES_DIR": root / "vault/10_sources",
            "NOTES_DIR": root / "vault/20_notes", "ARCHIVE_DIR": root / "vault/90_archive",
            "PUBLIC_DIR": root / "public", "NOTE_INDEX_PATH": root / "public/note-index.json",
            "SOURCE_INDEX_PATH": root / "public/source-index.json", "GRAPH_PATH": root / "public/graph-data.json",
        }.items()]
        for item in self.patches: item.start()
        workspace._CACHE.clear()
        self.payload = {"requestId": "test-manual-request-0001", "title": "部署操作手册", "content": "## 步骤\n\n先验证，再执行。", "metadata": {"space": "演示项目", "book": "运维手册", "chapter": "部署", "status": "draft", "confidence": "speculative", "sensitivity": "internal"}}
    def tearDown(self):
        for item in reversed(self.patches): item.stop()
        self.directory.cleanup()
    def test_create_read_metadata_and_catalog(self):
        result = workspace.write_managed_note(self.payload)
        note = result["note"]
        self.assertEqual(note["title"], "部署操作手册")
        self.assertEqual(note["content"], self.payload["content"])
        self.assertEqual(note["frontmatter"]["book"], "运维手册")
        self.assertEqual(len(note["revision"]), 64)
        rows = workspace.catalog({"q": ["先验证"]})
        self.assertEqual(rows["total"], 1)
        self.assertEqual(rows["tree"][0]["chapter"], "部署")
    def test_create_replay_is_idempotent_and_different_payload_conflicts(self):
        first = workspace.write_managed_note(self.payload)
        second = workspace.write_managed_note(self.payload)
        self.assertTrue(second["replayed"])
        self.assertEqual(first["note"]["id"], second["note"]["id"])
        with self.assertRaises(workspace.ConflictError): workspace.write_managed_note({**self.payload, "content": "不同的内容"})
    def test_edit_keeps_history_and_stable_identity(self):
        old = workspace.write_managed_note(self.payload)["note"]
        new = workspace.write_managed_note({**self.payload, "path": old["path"], "expectedRevision": old["revision"], "content": "修改后的正文"})["note"]
        self.assertNotEqual(old["revision"], new["revision"])
        self.assertEqual(old["id"], new["id"])
        historical = workspace.read_managed_note(old["path"], old["revision"])
        self.assertTrue(historical["historical"])
        self.assertEqual(historical["content"], old["content"])
    def test_concurrent_edit_has_exactly_one_winner(self):
        original = workspace.write_managed_note(self.payload)["note"]
        def edit(index):
            try:
                workspace.write_managed_note({**self.payload, "path": original["path"], "expectedRevision": original["revision"], "content": f"并发修改 {index}"})
                return "saved"
            except workspace.ConflictError: return "conflict"
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(edit, [1, 2]))
        self.assertCountEqual(results, ["saved", "conflict"])
    def test_old_revision_and_missing_revision_cannot_overwrite(self):
        note = workspace.write_managed_note(self.payload)["note"]
        for expected in [None, "0" * 64]:
            with self.assertRaises(workspace.ConflictError): workspace.write_managed_note({**self.payload, "path": note["path"], "expectedRevision": expected})
    def test_path_escape_raw_source_and_non_markdown_rejected(self):
        for path in ["../../etc/passwd", "vault/10_sources/raw.md", "vault/20_notes/file.json", "vault\\20_notes\\x.md"]:
            with self.assertRaises(ValueError): workspace.note_path(path)
    def test_unknown_history_is_not_replaced_by_current_version(self):
        note = workspace.write_managed_note(self.payload)["note"]
        with self.assertRaises(FileNotFoundError): workspace.read_managed_note(note["path"], "0" * 64)
    def test_index_failure_reports_saved_body_without_repeating_creation(self):
        with patch.object(wiki, "refresh_public_indexes", side_effect=OSError("test")):
            result = workspace.write_managed_note(self.payload)
        self.assertFalse(result["indexed"])
        self.assertEqual(workspace.read_managed_note(result["note"]["path"])["title"], self.payload["title"])
    def test_invalid_metadata_does_not_create_file(self):
        with self.assertRaises(ValueError): workspace.write_managed_note({**self.payload, "metadata": {"status": "complete"}})
        self.assertEqual(list(wiki.NOTES_DIR.rglob("*.md")), [])

if __name__ == "__main__": unittest.main()
