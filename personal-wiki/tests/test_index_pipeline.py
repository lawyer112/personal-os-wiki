from __future__ import annotations

import sqlite3
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

import server  # noqa: E402


class IndexPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        data_dir = Path(self.temporary.name)
        vault_dir = data_dir / "vault"
        notes_dir = vault_dir / "20_notes"
        atoms_dir = vault_dir / "20_atoms"
        public_dir = data_dir / "public"
        self.paths = mock.patch.multiple(
            server,
            DATA_DIR=data_dir,
            VAULT_DIR=vault_dir,
            SOURCES_DIR=vault_dir / "10_sources",
            NOTES_DIR=notes_dir,
            ATOMS_DIR=atoms_dir,
            NOTE_CONTENT_DIRS=(notes_dir, atoms_dir),
            ARCHIVE_DIR=vault_dir / "90_archive",
            PUBLIC_DIR=public_dir,
            GRAPH_PATH=public_dir / "graph-data.json",
            NOTE_INDEX_PATH=public_dir / "note-index.json",
            SEARCH_DB_PATH=public_dir / "search" / "wiki_fts.sqlite",
            INDEX_STATE_PATH=public_dir / "index-state.json",
        )
        self.paths.start()
        server.ensure_dirs_no_git()
        server.clear_note_caches()
        with server.INDEX_REFRESH_CONDITION:
            server._INDEX_REFRESH_STATE.clear()
            server._INDEX_REFRESH_STATE.update(
                {
                    "status": "idle",
                    "requested_generation": 0,
                    "completed_generation": 0,
                    "requested_at": "",
                    "started_at": "",
                    "completed_at": "",
                    "reason": "",
                    "pending_paths": set(),
                    "last_error": "",
                    "last_result": {},
                    "worker_started": False,
                }
            )

    def tearDown(self) -> None:
        self.paths.stop()
        self.temporary.cleanup()

    def test_ingest_queues_index_work_without_sync_rebuild(self) -> None:
        payload = {
            "title": "Queued note",
            "content": "The Agent writes this note and returns immediately.",
            "source_type": "agent-output",
            "source_url": "agent://test",
            "tags": ["personal-wiki", "test"],
            "metadata": {"test": True},
        }

        with mock.patch.object(server, "init_git"), mock.patch.object(
            server,
            "refresh_public_indexes",
            side_effect=AssertionError("foreground write must not rebuild indexes"),
        ), mock.patch.object(
            server,
            "git_commit",
            side_effect=AssertionError("foreground write must not run git"),
        ), mock.patch.object(
            server,
            "iter_note_paths",
            side_effect=AssertionError("foreground ingest must not scan every note"),
        ):
            result = server.ingest(payload)

        self.assertEqual(result["status"], "created")
        self.assertEqual(result["index_status"], "queued")
        self.assertEqual(result["index_generation"], 1)
        self.assertTrue((server.DATA_DIR / result["note_path"]).exists())
        self.assertEqual(server.get_index_status()["pending_paths"], [result["note_path"]])

    def test_ingest_preserves_structured_frontmatter_contract(self) -> None:
        payload = {
            "title": "Structured writeback",
            "content": "Stable production conclusion.",
            "source_type": "agent-output",
            "tags": ["personal-wiki"],
            "frontmatter": {
                "title": "Structured writeback",
                "type": "project",
                "created_by": "hermes:worker",
                "source_type": "agent-output",
                "tags": ["personal-wiki", "evidence"],
                "created_at": "2026-07-11T04:14:40Z",
                "task_id": "wiki-cpu-index-fix-20260711",
                "agent_id": "codex",
                "project": "Personal OS / Wiki 知识库升级",
            },
        }

        with mock.patch.object(server, "init_git"):
            result = server.ingest(payload)
        note = server.read_note(result["note_path"])

        self.assertEqual(note["frontmatter"]["type"], "project")
        self.assertEqual(note["frontmatter"]["created_by"], "hermes:worker")
        self.assertEqual(note["frontmatter"]["task_id"], "wiki-cpu-index-fix-20260711")
        self.assertEqual(note["frontmatter"]["created_at"], "2026-07-11T04:14:40Z")
        self.assertIn("evidence", note["frontmatter"]["tags"])

    def test_reads_return_last_good_index_without_vault_scan_or_rebuild(self) -> None:
        index = {
            "generated_at": "test",
            "vault_signature": "old",
            "count": 1,
            "notes": [{"title": "Last good", "path": "vault/20_notes/last-good.md"}],
            "tags": [],
            "concepts": [],
            "source_types": [],
        }
        graph = {"generated_at": "test", "vault_signature": "old", "nodes": [], "links": []}
        server.write_json(server.NOTE_INDEX_PATH, index)
        server.write_json(server.GRAPH_PATH, graph)
        server.clear_note_caches()

        with mock.patch.object(
            server,
            "vault_signature",
            side_effect=AssertionError("GET must not scan the vault"),
        ), mock.patch.object(
            server,
            "refresh_public_indexes",
            side_effect=AssertionError("GET must not rebuild indexes"),
        ):
            loaded_index = server.load_note_index()
            loaded_graph = server.load_graph()

        self.assertEqual(loaded_index["count"], 1)
        self.assertEqual(loaded_graph["generated_at"], "test")

    def test_search_index_upserts_metadata_and_removes_archived_notes(self) -> None:
        records = [
            {
                "title": "Alpha note",
                "path": "vault/20_notes/alpha.md",
                "search_text": "alpha searchable body",
                "created": "2026-07-11",
                "source_type": "agent-output",
                "source_url": "agent://alpha",
                "status": "active",
                "quality_status": "reviewed",
                "tags": ["alpha"],
                "concepts": ["Indexing"],
            },
            {
                "title": "Beta note",
                "path": "vault/20_notes/beta.md",
                "search_text": "beta searchable body",
                "created": "2026-07-11",
                "source_type": "manual",
                "status": "active",
                "tags": ["beta"],
                "concepts": ["Search"],
            },
        ]

        first = server.sync_search_index(records)
        alpha = server.search_chunks("alpha", 5)
        second = server.sync_search_index(records[:1])
        beta = server.search_chunks("beta", 5)

        self.assertEqual(first["notes"], 2)
        self.assertEqual(alpha["count"], 1)
        self.assertEqual(alpha["results"][0]["status"], "active")
        self.assertEqual(alpha["results"][0]["source_type"], "agent-output")
        self.assertEqual(alpha["results"][0]["tags"], ["alpha"])
        self.assertEqual(second["notes"], 1)
        self.assertEqual(second["deleted_notes"], 1)
        self.assertEqual(beta["count"], 0)

    def test_incremental_refresh_reads_only_changed_notes(self) -> None:
        first_path = server.NOTES_DIR / "alpha.md"
        second_path = server.NOTES_DIR / "beta.md"
        server.write_text_atomic(first_path, server.render_note_document("Alpha", "alpha old body", {"tags": ["one"]}))
        server.write_text_atomic(second_path, server.render_note_document("Beta", "beta stable body", {"tags": ["two"]}))
        initial = server.refresh_public_indexes(force=True)
        self.assertEqual(initial["refresh_mode"], "full")

        server.write_text_atomic(first_path, server.render_note_document("Alpha", "alpha new body", {"tags": ["one"]}))
        with mock.patch.object(
            server,
            "read_note_records",
            side_effect=AssertionError("incremental refresh must not read the whole vault"),
        ):
            refreshed = server.refresh_public_indexes(force=True, changed_paths=[server.rel(first_path)])

        self.assertEqual(refreshed["refresh_mode"], "incremental")
        self.assertEqual(refreshed["fts"]["updated_notes"], 1)
        self.assertEqual(refreshed["index"]["count"], 2)
        self.assertEqual(server.search_chunks("alpha new", 5)["count"], 1)
        self.assertEqual(server.search_chunks("beta stable", 5)["count"], 1)

    def test_incremental_graph_matches_full_graph_for_relation_change(self) -> None:
        alpha_path = server.NOTES_DIR / "alpha.md"
        beta_path = server.NOTES_DIR / "beta.md"
        alpha_frontmatter = {"concepts": ["Personal OS", "Indexing"], "tags": ["knowledge"]}
        beta_frontmatter = {"concepts": ["Personal OS", "Indexing"], "tags": ["knowledge"]}
        server.write_text_atomic(alpha_path, server.render_note_document("Alpha", "alpha body", alpha_frontmatter))
        server.write_text_atomic(beta_path, server.render_note_document("Beta", "beta body", beta_frontmatter))
        initial = server.refresh_public_indexes(force=True)
        self.assertEqual(len([link for link in initial["graph"]["links"] if link["type"] == "related"]), 1)

        server.write_text_atomic(
            alpha_path,
            server.render_note_document("Alpha", "alpha changed", {"concepts": ["Deployment"], "tags": ["release"]}),
        )
        incremental = server.refresh_public_indexes(force=True, changed_paths=[server.rel(alpha_path)])
        records = server.read_note_records(include_body=True)
        rebuilt = server.build_graph_from_records(records, signature="compare", generation="compare")

        def nodes_by_id(graph: dict[str, object]) -> dict[str, object]:
            return {str(node["id"]): node for node in graph["nodes"]}  # type: ignore[index]

        def link_rows(graph: dict[str, object]) -> set[tuple[object, ...]]:
            return {
                (link.get("source"), link.get("target"), link.get("type"), link.get("score"))
                for link in graph["links"]  # type: ignore[index]
            }

        self.assertEqual(nodes_by_id(incremental["graph"]), nodes_by_id(rebuilt))
        self.assertEqual(link_rows(incremental["graph"]), link_rows(rebuilt))
        self.assertEqual(incremental["graph"]["incremental"]["relation_notes"], 2)

    def test_public_index_pair_rejects_mixed_generations(self) -> None:
        server.write_json(
            server.NOTE_INDEX_PATH,
            {
                "schema_version": server.PUBLIC_INDEX_SCHEMA_VERSION,
                "index_generation": "new",
                "vault_signature": "same",
                "notes": [],
            },
        )
        server.write_json(
            server.GRAPH_PATH,
            {
                "schema_version": server.PUBLIC_INDEX_SCHEMA_VERSION,
                "index_generation": "old",
                "vault_signature": "same",
                "nodes": [],
                "links": [],
            },
        )

        self.assertIsNone(server.fresh_public_indexes())

    def test_search_index_repairs_missing_chunks_when_hash_is_unchanged(self) -> None:
        record = {
            "title": "Repair note",
            "path": "vault/20_notes/repair.md",
            "search_text": "repairable searchable body",
            "created": "2026-07-11",
            "source_type": "agent-output",
            "status": "active",
            "tags": [],
            "concepts": [],
        }
        server.sync_search_index([record])
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        connection.execute("delete from chunks_fts where path = ?", (record["path"],))
        connection.execute("delete from chunks where path = ?", (record["path"],))
        connection.commit()
        connection.close()

        repaired = server.sync_search_index([record], delete_missing=False)

        self.assertEqual(repaired["updated_notes"], 1)
        self.assertEqual(server.search_chunks("repairable", 5)["count"], 1)

    def test_search_index_migrates_legacy_metadata_without_rewriting_healthy_fts(self) -> None:
        record = {
            "title": "Legacy note",
            "path": "vault/20_notes/legacy.md",
            "search_text": "legacy searchable body",
            "created": "2026-07-11",
            "source_type": "manual",
            "status": "active",
            "tags": ["legacy"],
            "concepts": ["Migration"],
        }
        server.sync_search_index([record])
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        connection.execute(
            "update notes set sha256 = ?, content_sha256 = null, metadata_json = null where path = ?",
            ("legacy-hash", record["path"]),
        )
        connection.commit()
        connection.close()

        with mock.patch.object(
            server,
            "build_structured_chunks",
            side_effect=AssertionError("healthy legacy chunks must be reused during metadata migration"),
        ):
            migrated = server.sync_search_index([record])

        self.assertEqual(migrated["legacy_chunks_reused"], 1)
        self.assertEqual(migrated["metadata_updated_notes"], 1)
        self.assertEqual(migrated["written_chunks"], 0)
        self.assertEqual(server.search_chunks("legacy searchable", 5)["count"], 1)

    def test_structured_chunks_preserve_heading_paths_and_source_ranges(self) -> None:
        body = (
            "# Personal OS\n\n"
            "The overview remains attached to the top-level heading.\n\n"
            "## Deployment\n\n"
            "Use the canonical release and keep the old index for rollback.\n\n"
            "### Verification\n\n"
            "Check the health endpoint and then run a real retrieval request."
        )

        chunks = server.build_structured_chunks(
            body,
            title="Personal OS Runbook",
            path="vault/20_notes/runbook.md",
            size=240,
        )

        self.assertGreaterEqual(len(chunks), 3)
        self.assertIn(["Personal OS", "Deployment"], [chunk["heading_path"] for chunk in chunks])
        self.assertIn(
            ["Personal OS", "Deployment", "Verification"],
            [chunk["heading_path"] for chunk in chunks],
        )
        root = next(chunk for chunk in chunks if chunk["heading_path"] == ["Personal OS"])
        deployment = next(
            chunk for chunk in chunks if chunk["heading_path"] == ["Personal OS", "Deployment"]
        )
        verification = next(
            chunk
            for chunk in chunks
            if chunk["heading_path"] == ["Personal OS", "Deployment", "Verification"]
        )
        self.assertEqual(deployment["parent_id"], root["section_id"])
        self.assertEqual(verification["parent_id"], deployment["section_id"])
        for chunk in chunks:
            self.assertEqual(
                body[int(chunk["start_char"]) : int(chunk["end_char"])].strip(),
                chunk["text"],
            )

    def test_structured_chunks_ignore_heading_markers_inside_code_fences(self) -> None:
        body = (
            "# Real Heading\n\n"
            "```markdown\n"
            "# Example Only\n"
            "This line remains code.\n"
            "```\n\n"
            "## Actual Child\n\n"
            "Real evidence."
        )

        chunks = server.build_structured_chunks(
            body,
            title="Fence",
            path="vault/20_notes/fence.md",
            size=900,
        )

        heading_paths = [chunk["heading_path"] for chunk in chunks]
        self.assertNotIn(["Example Only"], heading_paths)
        self.assertIn(["Real Heading", "Actual Child"], heading_paths)
        self.assertTrue(any("# Example Only" in chunk["text"] for chunk in chunks))

    def test_matched_snippet_prefers_the_complete_query_over_an_earlier_generic_term(self) -> None:
        text = "alpha " + ("irrelevant filler " * 30) + "alpha needle target is the evidence"

        snippet = server.matched_snippet(text, "alpha needle target", radius=40)

        self.assertIn("[alpha needle target]", snippet)
        self.assertIn("is the evidence", snippet)

    def test_matched_snippet_prefers_the_densest_query_term_window(self) -> None:
        text = (
            "context appears in a generic introduction "
            + ("irrelevant filler " * 30)
            + "memory retrieval evidence is concentrated here"
        )

        snippet = server.matched_snippet(text, "context memory retrieval", radius=70)

        self.assertIn("memory", snippet)
        self.assertIn("retrieval", snippet)
        self.assertNotIn("generic introduction", snippet)

    def test_matched_snippet_reserves_occurrence_budget_for_late_query_tokens(self) -> None:
        tokens = [f"q{index:02d}" for index in range(32)]
        early = " ".join(
            ((token + " ") * 20) + ("filler " * 40) for token in tokens[:16]
        )
        text = early + " EVIDENCE " + " ".join(tokens[16:])

        snippet = server.matched_snippet(text, " ".join(tokens), radius=80)

        self.assertIn("EVIDENCE", snippet)
        self.assertIn("q31", snippet)

    def test_exact_probe_query_preserves_cjk_full_token_scoring(self) -> None:
        required = server.fts_required_query("知识库召回")

        self.assertIn('"知识库召回" OR', required)
        self.assertIn('"知识" AND "识库" AND "库召" AND "召回"', required)
        self.assertEqual(server.fts_required_query("alpha beta"), '"alpha" AND "beta"')
        self.assertEqual(server.fts_required_query("alpha alpha"), '"alpha"')
        self.assertEqual(server.fts_required_query("知识"), '"知识"')

        server.sync_search_index(
            [
                {
                    "title": "知识库召回",
                    "path": "vault/20_notes/cjk-exact.md",
                    "body": "# Evidence\n\nexact",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
                {
                    "title": "知识库召回方案",
                    "path": "vault/20_notes/cjk-substring.md",
                    "body": "# Evidence\n\nsubstring",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
                {
                    "title": "alpha",
                    "path": "vault/20_notes/alpha.md",
                    "body": "# Evidence\n\nalpha",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
            ]
        )
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))

        def scores(fts_query: str) -> dict[str, float]:
            return {
                str(path): float(rank)
                for path, rank in connection.execute(
                    "select c.path,bm25(chunks_fts,8.0,1.0,0.0,0.0) "
                    "from chunks_fts join chunks c on c.id=chunks_fts.chunk_id "
                    "where chunks_fts match ?",
                    (fts_query,),
                ).fetchall()
            }

        for query in ["知识库召回", "知识", "alpha alpha"]:
            general_scores = scores(server.fts_or_query(query))
            required_scores = scores(server.fts_required_query(query))
            self.assertEqual(required_scores.keys(), general_scores.keys())
            for path, score in general_scores.items():
                self.assertAlmostEqual(required_scores[path], score, places=8)
        connection.close()

    def test_search_chunks_orders_by_bm25_and_exact_title_boost(self) -> None:
        records = [
            {
                "title": "Needle Operations",
                "path": "vault/20_notes/title-hit.md",
                "body": "# Overview\n\nA concise operating note.",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            },
            {
                "title": "Generic note",
                "path": "vault/20_notes/body-hit.md",
                "body": "# Details\n\nneedle needle needle appears repeatedly in this body.",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            },
        ]
        server.sync_search_index(records)

        result = server.search_chunks("needle", 5)

        self.assertEqual(result["retrieval"], "fts5-bm25-structured-v2")
        self.assertEqual(result["results"][0]["path"], "vault/20_notes/title-hit.md")
        self.assertEqual(result["results"][0]["match_type"], "exact-title")
        self.assertNotIn("text", result["results"][0])
        self.assertIn("snippet", result["results"][0])
        self.assertLessEqual(
            result["results"][0]["estimated_tokens"],
            result["results"][0]["available_estimated_tokens"],
        )
        self.assertIn("expand", result["results"][0])

    def test_complete_folded_title_match_skips_heading_and_general_fts(self) -> None:
        server.sync_search_index(
            [
                {
                    "title": "Needle Operations",
                    "path": "vault/20_notes/complete-title.md",
                    "body": "# Overview\n\nneedle evidence",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            ]
        )
        inner = sqlite3.connect(str(server.SEARCH_DB_PATH))

        class RecordingConnection:
            def __init__(self) -> None:
                self.fts_match_queries = 0

            def execute(self, sql: str, parameters: tuple[object, ...] = ()):
                if "chunks_fts match" in sql:
                    self.fts_match_queries += 1
                return inner.execute(sql, parameters)

            def close(self) -> None:
                inner.close()

        connection = RecordingConnection()
        with mock.patch.object(server.sqlite3, "connect", return_value=connection):
            result = server.search_chunks("NEEDLE OPERATIONS", 5, max_per_path=1)

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["retrieval"], "fts5-bm25-structured-v2")
        self.assertEqual(result["ranking"], "folded-exact-title-fast-path")
        self.assertEqual(result["rank_tie_fallbacks"], 0)
        self.assertEqual(result["results"][0]["match_type"], "exact-title")
        self.assertEqual(connection.fts_match_queries, 0)

    def test_partial_folded_title_match_keeps_general_bm25_path(self) -> None:
        server.sync_search_index(
            [
                {
                    "title": "Needle Operations",
                    "path": "vault/20_notes/partial-title.md",
                    "body": "# Overview\n\nneedle evidence",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            ]
        )
        inner = sqlite3.connect(str(server.SEARCH_DB_PATH))

        class RecordingConnection:
            def __init__(self) -> None:
                self.fts_match_queries = 0

            def execute(self, sql: str, parameters: tuple[object, ...] = ()):
                if "chunks_fts match" in sql:
                    self.fts_match_queries += 1
                return inner.execute(sql, parameters)

            def close(self) -> None:
                inner.close()

        connection = RecordingConnection()
        with mock.patch.object(server.sqlite3, "connect", return_value=connection):
            result = server.search_chunks("needle", 5, max_per_path=1)

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["ranking"], "fts5-rank-tie-safe")
        self.assertEqual(result["results"][0]["match_type"], "exact-title")
        self.assertGreaterEqual(connection.fts_match_queries, 1)

    def test_unique_exact_leaf_heading_uses_lookup_without_fts(self) -> None:
        server.sync_search_index(
            [
                {
                    "title": "Unrelated note",
                    "path": "vault/20_notes/leaf-heading.md",
                    "body": "# Mixed 2FA OAuthToken\n\nprecise section evidence",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            ]
        )
        inner = sqlite3.connect(str(server.SEARCH_DB_PATH))

        class RecordingConnection:
            def __init__(self) -> None:
                self.fts_match_queries = 0

            def execute(self, sql: str, parameters: tuple[object, ...] = ()):
                if "chunks_fts match" in sql:
                    self.fts_match_queries += 1
                return inner.execute(sql, parameters)

            def close(self) -> None:
                inner.close()

        connection = RecordingConnection()
        with mock.patch.object(server.sqlite3, "connect", return_value=connection):
            result = server.search_chunks("MIXED 2FA OAUTHTOKEN", 5, max_per_path=1)

        self.assertEqual(result["ranking"], "folded-exact-heading-fast-path")
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["results"][0]["match_type"], "exact-heading")
        self.assertEqual(result["results"][0]["heading_path"][-1], "Mixed 2FA OAuthToken")
        self.assertEqual(connection.fts_match_queries, 0)

    def test_short_or_ambiguous_leaf_heading_keeps_general_bm25_path(self) -> None:
        server.sync_search_index(
            [
                {
                    "title": "First note",
                    "path": "vault/20_notes/first.md",
                    "body": "# Ops\n\nfirst evidence\n\n## Shared Heading\n\nfirst shared",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
                {
                    "title": "Second note",
                    "path": "vault/20_notes/second.md",
                    "body": "# Shared Heading\n\nsecond shared",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
            ]
        )

        short_result = server.search_chunks("Ops", 5, max_per_path=1)
        ambiguous_result = server.search_chunks("Shared Heading", 5, max_per_path=1)

        self.assertEqual(short_result["ranking"], "fts5-rank-tie-safe")
        self.assertEqual(ambiguous_result["ranking"], "fts5-rank-tie-safe")
        self.assertEqual(
            {item["path"] for item in ambiguous_result["results"]},
            {"vault/20_notes/first.md", "vault/20_notes/second.md"},
        )

    def test_exact_leaf_heading_outranks_but_does_not_hide_partial_title_candidates(self) -> None:
        server.sync_search_index(
            [
                {
                    "title": "Guide to OAuthToken",
                    "path": "vault/20_notes/title-candidate.md",
                    "body": "# Overview\n\ntitle candidate evidence",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
                {
                    "title": "Heading candidate",
                    "path": "vault/20_notes/heading-candidate.md",
                    "body": "# OAuthToken\n\nheading candidate evidence",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
            ]
        )

        result = server.search_chunks("OAuthToken", 5, max_per_path=1)

        self.assertEqual(result["ranking"], "fts5-rank-tie-safe")
        self.assertEqual(result["results"][0]["path"], "vault/20_notes/heading-candidate.md")
        self.assertEqual(result["results"][0]["match_type"], "exact-heading")
        self.assertIn(
            "vault/20_notes/title-candidate.md",
            {item["path"] for item in result["results"]},
        )

    def test_exact_leaf_heading_wins_same_document_path_cap_over_partial_title(self) -> None:
        server.sync_search_index(
            [
                {
                    "title": "Guide to OAuthToken",
                    "path": "vault/20_notes/same-document.md",
                    "body": (
                        "# Overview\n\nintroductory material mentioning OAuthToken\n\n"
                        "## OAuthToken\n\nprecise section evidence"
                    ),
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            ]
        )

        result = server.search_chunks("OAuthToken", 5, max_per_path=1)

        self.assertEqual(result["ranking"], "fts5-rank-tie-safe")
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["results"][0]["match_type"], "exact-heading")
        self.assertEqual(result["results"][0]["heading_path"][-1], "OAuthToken")
        self.assertIn("precise section evidence", result["results"][0]["snippet"])

    def test_exact_leaf_priority_cannot_be_overridden_by_bm25_magnitude(self) -> None:
        records = [
            {
                "title": f"Decoy {index}",
                "path": f"vault/20_notes/d{index:03}.md",
                "body": "# Other\n\nunrelated",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
            for index in range(100)
        ]
        records.extend(
            [
                {
                    "title": "Guide OAuthToken",
                    "path": "vault/20_notes/title.md",
                    "body": "# Other\n\nsmall",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
                {
                    "title": ("filler " * 1000).strip(),
                    "path": "vault/20_notes/heading.md",
                    "body": "# OAuthToken\n\n" + ("evidence " * 1000),
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
            ]
        )
        server.sync_search_index(records)

        result = server.search_chunks("OAuthToken", 5, max_per_path=1)

        self.assertEqual(result["results"][0]["path"], "vault/20_notes/heading.md")
        self.assertEqual(result["results"][0]["match_type"], "exact-heading")
        self.assertNotIn("_match_priority", result["results"][0])

    def test_heading_lookup_keeps_one_representative_per_section(self) -> None:
        server.sync_search_index(
            [
                {
                    "title": "Long section",
                    "path": "vault/20_notes/long-section.md",
                    "body": "# One Indexed Section\n\n" + ("long evidence sentence. " * 160),
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            ]
        )
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        try:
            section_id, chunk_count = connection.execute(
                "select section_id,count(*) from chunks group by section_id"
            ).fetchone()
            lookup = connection.execute(
                "select section_id,first_chunk_index from heading_lookup"
            ).fetchall()
            plan = connection.execute(
                "explain query plan select first_chunk_id from heading_lookup "
                "where heading_leaf_folded=? order by path,first_chunk_index limit 5",
                ("one indexed section",),
            ).fetchall()
        finally:
            connection.close()

        self.assertGreater(chunk_count, 1)
        self.assertEqual(lookup, [(section_id, 0)])
        self.assertTrue(
            any("heading_lookup_leaf_index" in str(row[3]) for row in plan),
            plan,
        )
        self.assertFalse(any("SCAN heading_lookup" in str(row[3]) for row in plan), plan)

    def test_empty_leaf_heading_is_not_indexed_or_marked_unhealthy(self) -> None:
        server.sync_search_index(
            [
                {
                    "title": "Malformed heading",
                    "path": "vault/20_notes/malformed-heading.md",
                    "body": "# ###\n\nbody",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            ]
        )
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        try:
            lookup_count = connection.execute(
                "select count(*) from heading_lookup"
            ).fetchone()[0]
        finally:
            connection.close()

        self.assertEqual(lookup_count, 0)
        self.assertTrue(server.search_index_healthy(1))

    def test_exact_title_probe_recovers_a_boosted_hit_beyond_the_bm25_window(self) -> None:
        records = [
            {
                "title": "beta alpha",
                "path": f"vault/20_notes/a-decoy-{index:02d}.md",
                "body": "# Evidence\n\nshared body",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
            for index in range(41)
        ]
        records.append(
            {
                "title": "alpha beta",
                "path": "vault/20_notes/z-exact-title.md",
                "body": "# Evidence\n\nshared body",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
        )
        server.sync_search_index(records)

        result = server.search_chunks("alpha beta", 1, max_per_path=1)

        self.assertEqual(result["results"][0]["path"], "vault/20_notes/z-exact-title.md")
        self.assertEqual(result["results"][0]["match_type"], "exact-title")
        self.assertGreaterEqual(result["exact_probe_candidates"], 1)

    def test_exact_leaf_heading_recovers_a_hit_beyond_the_bm25_window(self) -> None:
        records = [
            {
                "title": f"Decoy {index:02d}",
                "path": f"vault/20_notes/a-heading-decoy-{index:02d}.md",
                "body": "# beta alpha\n\nshared body",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
            for index in range(41)
        ]
        records.append(
            {
                "title": "Exact heading note",
                "path": "vault/20_notes/z-exact-heading.md",
                "body": "# alpha beta\n\nshared body",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
        )
        server.sync_search_index(records)

        result = server.search_chunks("alpha beta", 1, max_per_path=1)

        self.assertEqual(result["results"][0]["path"], "vault/20_notes/z-exact-heading.md")
        self.assertEqual(result["results"][0]["match_type"], "exact-heading")
        self.assertGreaterEqual(result["exact_probe_candidates"], 1)

    def test_exact_probe_stabilizes_ties_before_applying_the_path_cap(self) -> None:
        records = [
            {
                "title": "alpha x beta",
                "path": f"vault/20_notes/decoy-{index:02d}.md",
                "body": "# Evidence\n\nshared body",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
            for index in range(40)
        ]
        for path in ["z-exact.md", "a-exact.md"]:
            records.append(
                {
                    "title": ("filler " * 400) + "alpha beta",
                    "path": f"vault/20_notes/{path}",
                    "body": "# Evidence\n\nshared body",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            )
        server.sync_search_index(records)

        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        raw_top_paths = {
            str(path)
            for (path,) in connection.execute(
                "select c.path from chunks_fts join chunks c on c.id=chunks_fts.chunk_id "
                "where chunks_fts match ? and rank match 'bm25(8.0,1.0,0.0,0.0)' "
                "order by rank limit 40",
                (server.fts_or_query("alpha beta"),),
            ).fetchall()
        }
        connection.close()
        self.assertNotIn("vault/20_notes/a-exact.md", raw_top_paths)
        self.assertNotIn("vault/20_notes/z-exact.md", raw_top_paths)

        result = server.search_chunks("alpha beta", 1, max_per_path=1)

        self.assertEqual(result["results"][0]["path"], "vault/20_notes/a-exact.md")

    def test_exact_title_supplements_are_stable_neutral_and_do_not_query_fts(self) -> None:
        target_path = "vault/20_notes/a-last.md"
        records = [
            {
                "title": "Exact needle",
                "path": f"vault/20_notes/z-{index:02d}.md",
                "body": "# Evidence\n\nshared body",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
            for index in range(40)
        ]
        records.append(
            {
                "title": "Exact needle",
                "path": target_path,
                "body": "# Evidence\n\nshared body",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
        )
        server.sync_search_index(records)

        query = "needle"
        inner = sqlite3.connect(str(server.SEARCH_DB_PATH))

        class RecordingConnection:
            def __init__(self) -> None:
                self.sql: list[str] = []

            def execute(self, sql: str, parameters: tuple[object, ...] = ()):
                self.sql.append(sql)
                return inner.execute(sql, parameters)

        connection = RecordingConnection()
        try:
            exact_rows = server.stable_folded_exact_title_rows(
                connection,
                query,
                limit=1,
                max_per_path=1,
            )
        finally:
            inner.close()

        self.assertEqual(len(exact_rows), 1)
        self.assertEqual(exact_rows[0][1], target_path)
        self.assertEqual(float(exact_rows[0][13]), 0.0)
        self.assertTrue(any("from notes where" in sql for sql in connection.sql))
        self.assertTrue(any("from chunks c where c.path=?" in sql for sql in connection.sql))
        self.assertFalse(any("chunks_fts" in sql for sql in connection.sql))

    def test_partial_heading_falls_back_stably_when_a_tie_crosses_the_candidate_cutoff(self) -> None:
        target_path = "vault/20_notes/a-last.md"
        records = [
            {
                "title": f"Other {index:02d}",
                "path": f"vault/20_notes/z-{index:02d}.md",
                "body": "# Exact needle\n\nshared body",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
            for index in range(40)
        ]
        records.append(
            {
                "title": "Other target",
                "path": target_path,
                "body": "# Exact needle\n\nshared body",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
        )
        server.sync_search_index(records)

        query = "needle"
        result = server.search_chunks(query, 1, max_per_path=1)

        self.assertEqual(result["ranking"], "fts5-rank-tie-safe")
        self.assertGreaterEqual(result["rank_tie_fallbacks"], 1)
        self.assertEqual(result["results"][0]["path"], target_path)
        self.assertEqual(result["results"][0]["match_type"], "exact-heading")

    def test_search_chunks_falls_back_to_stable_sql_when_rank_cutoff_is_tied(self) -> None:
        records = [
            {
                "title": "Identical",
                "path": f"vault/20_notes/identical-{index:02d}.md",
                "body": "# Identical\n\nneedle evidence",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            }
            for index in range(41)
        ]
        server.sync_search_index(records)

        result = server.search_chunks("needle", 1, max_per_path=1)

        self.assertEqual(result["ranking"], "fts5-rank-tie-safe")
        self.assertGreaterEqual(result["rank_tie_fallbacks"], 1)
        self.assertEqual(result["count"], 1)

    def test_search_chunks_limits_duplicate_paths(self) -> None:
        records = [
            {
                "title": "Many sections",
                "path": "vault/20_notes/many.md",
                "body": "# One\n\nneedle first\n\n## Two\n\nneedle second\n\n## Three\n\nneedle third",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            },
            {
                "title": "Independent",
                "path": "vault/20_notes/independent.md",
                "body": "# Independent\n\nneedle elsewhere",
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            },
        ]
        server.sync_search_index(records)

        result = server.search_chunks("needle", 5, max_per_path=1)
        paths = [item["path"] for item in result["results"]]

        self.assertEqual(len(paths), len(set(paths)))
        self.assertEqual(set(paths), {"vault/20_notes/many.md", "vault/20_notes/independent.md"})

    def test_expand_chunk_returns_neighbor_section_and_document_ranges(self) -> None:
        note_path = server.NOTES_DIR / "expand.md"
        body = (
            "# Expand Test\n\n"
            "Overview content.\n\n"
            "## Target Section\n\n"
            "The target keyword is mercury.\n\n"
            "More evidence belongs to the same section.\n\n"
            "### Child Step\n\n"
            "Nested verification evidence belongs to the target section.\n\n"
            "## Other Section\n\n"
            "Unrelated closing material."
        )
        server.write_text_atomic(
            note_path,
            server.render_note_document("Expand Test", body, {"source_type": "manual"}),
        )
        record = server.read_note_record(note_path, include_body=True)
        server.sync_search_index([record])
        hit = server.search_chunks("mercury", 1)["results"][0]

        neighbor = server.expand_search_chunk(hit["chunk_id"], "neighbor")
        section = server.expand_search_chunk(hit["chunk_id"], "section")
        document = server.expand_search_chunk(hit["chunk_id"], "document")

        self.assertIn("mercury", neighbor["content"])
        self.assertIn("More evidence", section["content"])
        self.assertIn("Nested verification evidence", section["content"])
        self.assertNotIn("Unrelated closing material", section["content"])
        self.assertIn("Unrelated closing material", document["content"])
        self.assertEqual(neighbor["range_basis"], "indexed-snapshot")
        self.assertGreater(document["estimated_tokens"], 0)

    def test_continuous_chinese_question_uses_bigram_recall(self) -> None:
        server.sync_search_index(
            [
                {
                    "title": "发布说明",
                    "path": "vault/20_notes/release.md",
                    "body": "# 部署\n\n示例发布服务的监听端口是 4310。",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            ]
        )

        result = server.search_chunks("示例发布服务默认监听哪个端口？", 5)

        self.assertEqual(result["count"], 1)
        self.assertEqual(result["results"][0]["path"], "vault/20_notes/release.md")

    def test_force_repair_rebuilds_poisoned_fts_with_same_row_count(self) -> None:
        record = {
            "title": "Repair",
            "path": "vault/20_notes/repair-force.md",
            "body": "# Repair\n\nforced repair needle",
            "source_type": "manual",
            "tags": [],
            "concepts": [],
        }
        server.sync_search_index([record])
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        connection.execute("update chunks_fts set chunk_id='poisoned-id'")
        connection.commit()
        connection.close()

        self.assertFalse(server.search_index_healthy(1))
        repaired = server.sync_search_index([record], force_repair=True)

        self.assertGreater(repaired["written_chunks"], 0)
        self.assertTrue(server.search_index_healthy(1))
        self.assertEqual(server.search_chunks("forced repair", 5)["count"], 1)

    def test_chunk_id_is_stable_when_only_metadata_changes(self) -> None:
        record = {
            "title": "Stable ID",
            "path": "vault/20_notes/stable-id.md",
            "body": "# Stable\n\nchunk identity body",
            "source_type": "manual",
            "tags": ["before"],
            "concepts": [],
        }
        server.sync_search_index([record])
        before = server.search_chunks("chunk identity", 1)["results"][0]["chunk_id"]

        updated = {**record, "tags": ["after"]}
        server.sync_search_index([updated])
        after = server.search_chunks("chunk identity", 1)["results"][0]["chunk_id"]

        self.assertEqual(before, after)

    def test_expand_uses_indexed_snapshot_after_source_file_changes(self) -> None:
        note_path = server.NOTES_DIR / "snapshot.md"
        original = "# Snapshot\n\nThe indexed evidence contains mercury needle."
        server.write_text_atomic(
            note_path,
            server.render_note_document("Snapshot", original, {"source_type": "manual"}),
        )
        server.sync_search_index([server.read_note_record(note_path, include_body=True)])
        hit = server.search_chunks("mercury needle", 1)["results"][0]

        server.write_text_atomic(
            note_path,
            server.render_note_document(
                "Snapshot",
                "# Snapshot\n\nThe live file changed before reindex.",
                {"source_type": "manual"},
            ),
        )
        expanded = server.expand_search_chunk(hit["chunk_id"], "chunk")

        self.assertIn("mercury needle", expanded["content"])
        self.assertNotIn("live file changed", expanded["content"])
        self.assertEqual(expanded["range_basis"], "indexed-snapshot")

    def test_search_path_cap_fetches_beyond_first_candidate_window(self) -> None:
        many_sections = "\n\n".join(
            f"## Part {index}\n\nneedle evidence {index}" for index in range(60)
        )
        server.sync_search_index(
            [
                {
                    "title": "Many",
                    "path": "vault/20_notes/a-many.md",
                    "body": many_sections,
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
                {
                    "title": "Independent",
                    "path": "vault/20_notes/z-independent.md",
                    "body": "# Independent\n\nneedle evidence elsewhere",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                },
            ]
        )

        result = server.search_chunks("needle", 5, max_per_path=1)

        self.assertEqual(
            {item["path"] for item in result["results"]},
            {"vault/20_notes/a-many.md", "vault/20_notes/z-independent.md"},
        )

    def test_exact_candidates_do_not_stop_general_path_overfetch_early(self) -> None:
        records = [
            {
                "title": "Many general hits",
                "path": "vault/20_notes/a-many.md",
                "body": "\n\n".join(
                    f"## Part {index}\n\n" + ("alpha x beta " * 3)
                    for index in range(41)
                ),
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            },
            {
                "title": "Independent general hit",
                "path": "vault/20_notes/z-independent.md",
                "body": "# Independent\n\n" + ("alpha x beta " * 2),
                "source_type": "manual",
                "tags": [],
                "concepts": [],
            },
            *[
                {
                    "title": f"Weak exact {index}",
                    "path": f"vault/20_notes/exact-{index}.md",
                    "body": "# " + ("filler " * 600) + "alpha beta\n\nweak",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
                for index in range(3)
            ],
            *[
                {
                    "title": f"Unrelated {index}",
                    "path": f"vault/20_notes/unrelated-{index}.md",
                    "body": "# Other\n\nunrelated corpus content",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
                for index in range(300)
            ],
        ]
        with mock.patch.object(server, "INDEX_FTS_YIELD_SECONDS", 0):
            server.sync_search_index(records)

        result = server.search_chunks("alpha beta", 3, max_per_path=1)
        paths = [item["path"] for item in result["results"]]

        self.assertEqual(paths[:2], [
            "vault/20_notes/a-many.md",
            "vault/20_notes/z-independent.md",
        ])
        self.assertTrue(paths[2].startswith("vault/20_notes/exact-"))

    def test_search_stops_when_fast_rank_sentinel_proves_results_are_exhausted(self) -> None:
        body = "\n\n".join(
            f"## Part {index}\n\nneedle evidence {index}" for index in range(40)
        )
        server.sync_search_index(
            [
                {
                    "title": "Exactly one candidate window",
                    "path": "vault/20_notes/exactly-forty.md",
                    "body": body,
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            ]
        )

        inner = sqlite3.connect(str(server.SEARCH_DB_PATH))

        class CountingConnection:
            def __init__(self) -> None:
                self.fast_rank_queries = 0

            def execute(self, sql: str, parameters: tuple[object, ...] = ()):
                if "rank as bm25_rank" in sql and "retrieval_" not in sql:
                    self.fast_rank_queries += 1
                return inner.execute(sql, parameters)

            def create_function(self, *args, **kwargs) -> None:
                inner.create_function(*args, **kwargs)

            def close(self) -> None:
                inner.close()

        connection = CountingConnection()
        with mock.patch.object(server.sqlite3, "connect", return_value=connection):
            result = server.search_chunks("needle", 5, max_per_path=1)

        self.assertEqual(result["count"], 1)
        self.assertEqual(connection.fast_rank_queries, 1)

    def test_chunk_schema_v7_rebuilds_legacy_self_parent_links(self) -> None:
        record = {
            "title": "Hierarchy",
            "path": "vault/20_notes/hierarchy.md",
            "body": "# Root\n\nroot\n\n## Child\n\nchild\n\n### Grandchild\n\ngrandchild",
            "source_type": "manual",
            "tags": [],
            "concepts": [],
        }
        server.sync_search_index([record])
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        connection.execute("update notes set chunk_schema_version=4")
        connection.execute("update chunks set parent_id=section_id where heading_level > 1")
        connection.commit()
        connection.close()

        self.assertFalse(server.search_index_healthy(1))
        rebuilt = server.sync_search_index([record])

        self.assertGreater(rebuilt["written_chunks"], 0)
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        version = connection.execute(
            "select chunk_schema_version from notes where path=?",
            (record["path"],),
        ).fetchone()[0]
        hierarchy = connection.execute(
            "select section_id,parent_id,heading_level from chunks where path=? order by chunk_index",
            (record["path"],),
        ).fetchall()
        connection.close()
        by_level = {int(level): (str(section_id), str(parent_id or "")) for section_id, parent_id, level in hierarchy}

        self.assertEqual(version, server.SEARCH_CHUNK_SCHEMA_VERSION)
        self.assertEqual(by_level[1][1], "")
        self.assertEqual(by_level[2][1], by_level[1][0])
        self.assertEqual(by_level[3][1], by_level[2][0])
        self.assertTrue(all(section_id != parent_id for section_id, parent_id in by_level.values()))

    def test_chunk_schema_v7_rebuilds_v5_rows_and_backfills_folded_fields(self) -> None:
        record = {
            "title": "Legacy Folded Title",
            "path": "vault/20_notes/legacy-folded.md",
            "body": "# Migration Heading\n\nlegacy searchable body",
            "source_type": "manual",
            "tags": [],
            "concepts": [],
        }
        with mock.patch.object(server, "SEARCH_CHUNK_SCHEMA_VERSION", 5):
            seeded = server.sync_search_index([record])
        self.assertGreater(seeded["written_chunks"], 0)
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        connection.execute("alter table notes drop column title_folded")
        connection.execute("alter table chunks drop column title_folded")
        connection.execute("alter table chunks drop column heading_text_folded")
        connection.commit()

        note_columns = {
            str(row[1]) for row in connection.execute("pragma table_info(notes)").fetchall()
        }
        chunk_columns = {
            str(row[1]) for row in connection.execute("pragma table_info(chunks)").fetchall()
        }
        self.assertNotIn("title_folded", note_columns)
        self.assertNotIn("title_folded", chunk_columns)
        self.assertNotIn("heading_text_folded", chunk_columns)

        server.ensure_search_schema(connection)
        note_folded_before = connection.execute(
            "select title_folded from notes where path=?",
            (record["path"],),
        ).fetchone()[0]
        chunk_folded_before = connection.execute(
            "select title_folded,heading_text_folded from chunks where path=?",
            (record["path"],),
        ).fetchall()
        connection.close()

        self.assertIsNone(note_folded_before)
        self.assertTrue(chunk_folded_before)
        self.assertTrue(all(title is None for title, _ in chunk_folded_before))
        self.assertTrue(all(heading is None for _, heading in chunk_folded_before))
        self.assertFalse(server.search_index_healthy(1))

        rebuilt = server.sync_search_index([record])

        self.assertEqual(rebuilt["updated_notes"], 1)
        self.assertGreater(rebuilt["written_chunks"], 0)
        self.assertEqual(rebuilt["legacy_chunks_reused"], 0)
        self.assertTrue(server.search_index_healthy(1))
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        try:
            note_folded, version = connection.execute(
                "select title_folded,chunk_schema_version from notes where path=?",
                (record["path"],),
            ).fetchone()
            chunk_folded_after = connection.execute(
                "select title_folded,heading_text_folded from chunks where path=?",
                (record["path"],),
            ).fetchall()
        finally:
            connection.close()

        self.assertEqual(version, server.SEARCH_CHUNK_SCHEMA_VERSION)
        self.assertEqual(note_folded, record["title"].casefold())
        self.assertTrue(chunk_folded_after)
        self.assertTrue(
            all(title == record["title"].casefold() for title, _ in chunk_folded_after)
        )
        self.assertIn("migration heading", {heading for _, heading in chunk_folded_after})
        result = server.search_chunks("legacy folded title", 1)
        self.assertEqual(result["results"][0]["match_type"], "exact-title")

    def test_heading_lookup_tracks_heading_updates_and_deletes(self) -> None:
        path = "vault/20_notes/changing-heading.md"
        record = {
            "title": "Changing heading",
            "path": path,
            "body": "# Original Heading\n\nfirst body",
            "source_type": "manual",
            "tags": [],
            "concepts": [],
        }
        server.sync_search_index([record])
        changed = {**record, "body": "# Replacement Heading\n\nsecond body"}
        server.sync_search_index([changed], delete_missing=False)
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        try:
            headings = connection.execute(
                "select heading_leaf_folded from heading_lookup where path=?",
                (path,),
            ).fetchall()
        finally:
            connection.close()
        self.assertEqual(headings, [("replacement heading",)])

        server.sync_search_index([], removed_paths=[path], delete_missing=False)
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        try:
            remaining = connection.execute(
                "select count(*) from heading_lookup where path=?", (path,)
            ).fetchone()[0]
        finally:
            connection.close()
        self.assertEqual(remaining, 0)

    def test_heading_lookup_corruption_fails_health_check_and_full_repair_restores_it(self) -> None:
        record = {
            "title": "Lookup repair",
            "path": "vault/20_notes/lookup-repair.md",
            "body": "# Repairable Heading\n\nbody",
            "source_type": "manual",
            "tags": [],
            "concepts": [],
        }
        server.sync_search_index([record])
        self.assertTrue(server.search_index_healthy(1))
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        connection.execute(
            "update heading_lookup set heading_leaf_folded='wrong nonempty heading'"
        )
        connection.commit()
        connection.close()

        self.assertFalse(server.search_index_healthy(1))
        repaired = server.sync_search_index([record], force_repair=True)

        self.assertGreater(repaired["written_chunks"], 0)
        self.assertEqual(repaired["headings"], 1)
        self.assertTrue(server.search_index_healthy(1))

    def test_expand_applies_server_side_token_budget(self) -> None:
        body = "\n\n".join(
            [
                *(f"## Filler {index}\n\n" + ("无关填充内容。" * 80) for index in range(36)),
                "## Target\n\nneedle target 位于文档末尾。",
            ]
        )
        server.sync_search_index(
            [
                {
                    "title": "Long",
                    "path": "vault/20_notes/long.md",
                    "body": body,
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            ]
        )
        hit = server.search_chunks("needle target", 1)["results"][0]

        expanded = server.expand_search_chunk(
            hit["chunk_id"],
            "document",
            max_tokens=128,
            query="needle target",
        )

        self.assertTrue(expanded["truncated"])
        self.assertLessEqual(expanded["estimated_tokens"], 128)
        self.assertGreater(expanded["available_estimated_tokens"], 128)
        self.assertIn("needle target", expanded["content"])
        self.assertIn(hit["chunk_id"], expanded["included_chunk_ids"])
        self.assertLess(
            len(expanded["included_chunk_ids"]), expanded["available_chunk_count"]
        )

    def test_legacy_search_schema_is_marked_unhealthy_until_v2_reindex(self) -> None:
        server.SEARCH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        connection.execute(
            "create table notes(path text primary key, title text, source_type text, quality_status text, chars integer, sha256 text)"
        )
        connection.execute(
            "create table chunks(id text primary key, path text, chunk_index integer, title text, text text, chars integer, sha256 text)"
        )
        connection.execute(
            "create virtual table chunks_fts using fts5(title,text,path unindexed,chunk_id unindexed,tokenize='unicode61')"
        )
        connection.execute(
            "insert into notes(path,title,source_type,quality_status,chars,sha256) values(?,?,?,?,?,?)",
            ("vault/20_notes/legacy.md", "Legacy", "manual", "", 6, "old"),
        )
        connection.execute(
            "insert into chunks(id,path,chunk_index,title,text,chars,sha256) values(?,?,?,?,?,?,?)",
            ("old:0", "vault/20_notes/legacy.md", 0, "Legacy", "legacy", 6, "old"),
        )
        connection.execute(
            "insert into chunks_fts(title,text,path,chunk_id) values(?,?,?,?)",
            ("Legacy", "legacy", "vault/20_notes/legacy.md", "old:0"),
        )
        connection.commit()
        connection.close()

        self.assertFalse(server.search_index_healthy(1))
        migrated = server.sync_search_index(
            [
                {
                    "title": "Legacy",
                    "path": "vault/20_notes/legacy.md",
                    "body": "# Legacy\n\nlegacy",
                    "source_type": "manual",
                    "tags": [],
                    "concepts": [],
                }
            ]
        )

        self.assertEqual(migrated["updated_notes"], 1)
        self.assertTrue(server.search_index_healthy(1))

    def test_schema_migration_serializes_concurrent_writers(self) -> None:
        server.SEARCH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(str(server.SEARCH_DB_PATH))
        connection.execute(
            "create table notes(path text primary key, title text, source_type text, quality_status text, chars integer, sha256 text)"
        )
        connection.execute(
            "create table chunks(id text primary key, path text, chunk_index integer, title text, text text, chars integer, sha256 text)"
        )
        connection.execute(
            "create virtual table chunks_fts using fts5(title,text,path unindexed,chunk_id unindexed,tokenize='unicode61')"
        )
        connection.commit()
        connection.close()

        def migrate() -> set[str]:
            worker = sqlite3.connect(str(server.SEARCH_DB_PATH), timeout=10)
            worker.execute("pragma busy_timeout=10000")
            try:
                return server.ensure_search_schema(worker)
            finally:
                worker.close()

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: migrate(), range(16)))

        self.assertEqual(len(results), 16)
        self.assertTrue(all("chunk_schema_version" in columns for columns in results))


if __name__ == "__main__":
    unittest.main()
