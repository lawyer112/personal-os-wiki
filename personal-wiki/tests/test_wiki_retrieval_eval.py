from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from wiki_retrieval_eval import (  # noqa: E402
    GoldValidationError,
    RetrievalResponse,
    SearchResult,
    build_search_url,
    estimate_tokens,
    evaluate_queries,
    load_gold,
    normalize_response,
    parse_gold_query,
)


class WikiRetrievalEvalTests(unittest.TestCase):
    def test_load_gold_supports_json_object_and_jsonl(self) -> None:
        query = {
            "id": "service-port",
            "query": "示例服务端口？",
            "relevant": [
                {
                    "path": "vault/20_atoms/example.md",
                    "chunk_ids": [2],
                    "ranges": [{"start": 10, "end": 30}],
                    "context": {"contains_all": ["端口", "4310"]},
                }
            ],
        }
        with tempfile.TemporaryDirectory() as temporary:
            json_path = Path(temporary) / "gold.json"
            json_path.write_text(json.dumps({"schema_version": "1.0", "queries": [query]}), encoding="utf-8")
            jsonl_path = Path(temporary) / "gold.jsonl"
            jsonl_path.write_text("# comment\n" + json.dumps(query, ensure_ascii=False) + "\n", encoding="utf-8")

            from_json = load_gold(json_path)
            from_jsonl = load_gold(jsonl_path)

        self.assertEqual(from_json, from_jsonl)
        self.assertEqual(from_json[0].relevant[0].chunk_ids, ("2",))
        self.assertEqual(from_json[0].relevant[0].ranges[0].start, 10)

    def test_gold_validation_rejects_ambiguous_or_duplicate_queries(self) -> None:
        with self.assertRaisesRegex(GoldValidationError, "at least one relevant"):
            parse_gold_query({"id": "missing-target", "query": "where"})
        with self.assertRaisesRegex(GoldValidationError, "cannot set expect_no_results"):
            parse_gold_query(
                {
                    "id": "ambiguous",
                    "query": "where",
                    "expect_no_results": True,
                    "relevant": [{"path": "example.md"}],
                }
            )

        with tempfile.TemporaryDirectory() as temporary:
            duplicate_path = Path(temporary) / "duplicates.json"
            duplicate_path.write_text(
                json.dumps(
                    [
                        {"id": "same", "query": "first", "relevant": [{"path": "first.md"}]},
                        {"id": "same", "query": "second", "relevant": [{"path": "second.md"}]},
                    ]
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(GoldValidationError, "duplicate query ids"):
                load_gold(duplicate_path)

    def test_normalize_response_handles_notes_and_chunk_shapes(self) -> None:
        notes = normalize_response(
            {
                "notes": [
                    {"path": "vault/20_atoms/example.md", "title": "Example", "hit_snippet": "端口 4310"}
                ]
            }
        )
        chunks = normalize_response(
            {
                "data": {
                    "results": [
                        {
                            "metadata": {"source_path": "vault/30_projects/demo.md", "title": "Demo"},
                            "content": "发布前检查",
                            "chunkId": 7,
                            "charStart": 100,
                            "charEnd": 130,
                        }
                    ]
                }
            }
        )
        v2_chunks = normalize_response(
            {
                "results": [
                    {
                        "path": "vault/30_projects/v2.md",
                        "title": "V2",
                        "text": "完整 chunk 不应计入 Agent 上下文成本",
                        "snippet": "只计算命中片段",
                        "chunk_id": "v2:1",
                        "start_char": 220,
                        "end_char": 310,
                    }
                ]
            }
        )

        self.assertEqual(notes[0].text, "端口 4310")
        self.assertEqual(
            chunks[0],
            SearchResult(
                path="vault/30_projects/demo.md",
                title="Demo",
                text="发布前检查",
                chunk_id="7",
                char_start=100,
                char_end=130,
            ),
        )
        self.assertEqual(v2_chunks[0].text, "只计算命中片段")
        self.assertEqual(v2_chunks[0].char_start, 220)
        self.assertEqual(v2_chunks[0].char_end, 310)

    def test_evaluation_computes_quality_cost_latency_and_negative_accuracy(self) -> None:
        queries = [
            parse_gold_query(
                {
                    "id": "port",
                    "query": "示例端口？",
                    "relevant": [
                        {
                            "path": "vault/20_atoms/example.md",
                            "chunk_ids": ["good"],
                            "ranges": [{"start": 100, "end": 150}],
                            "context": {"contains_all": ["端口", "4310"]},
                        }
                    ],
                }
            ),
            parse_gold_query(
                {
                    "id": "workflow",
                    "query": "示例流程？",
                    "relevant": [
                        {"path": "vault/30_projects/overview.md"},
                        {"path": "vault/50_skills/checklist.md"},
                    ],
                }
            ),
            parse_gold_query({"id": "none", "query": "不存在的内容？", "expect_no_results": True}),
        ]
        responses = {
            "port": RetrievalResponse(
                results=(
                    SearchResult(path="unrelated.md", text="无关内容"),
                    SearchResult(
                        path="vault/20_atoms/example.md",
                        text="示例端口是 4310",
                        chunk_id="good",
                        char_start=120,
                        char_end=140,
                    ),
                    SearchResult(path="vault/20_atoms/example.md", text="没有数字", chunk_id="wrong"),
                ),
                latency_ms=12.0,
            ),
            "workflow": RetrievalResponse(
                results=(SearchResult(path="vault/30_projects/overview.md", text="审核和排期"),),
                latency_ms=20.0,
            ),
            "none": RetrievalResponse(results=(), latency_ms=8.0),
        }

        report = evaluate_queries(queries, lambda query, _limit: responses[query.query_id], k_values=(1, 3))

        self.assertEqual(report["summary"]["mrr"], 0.75)
        self.assertEqual(report["summary"]["by_k"]["1"]["recall"], 0.25)
        self.assertEqual(report["summary"]["by_k"]["3"]["recall"], 0.75)
        self.assertAlmostEqual(report["summary"]["by_k"]["3"]["context_precision"], 2 / 3, places=6)
        self.assertEqual(report["summary"]["by_k"]["3"]["context_hit_rate"], 1.0)
        self.assertEqual(report["summary"]["by_k"]["3"]["no_result_accuracy"], 1.0)
        self.assertEqual(report["summary"]["latency_ms"]["p50"], 12.0)
        self.assertEqual(report["queries"][0]["evaluation"]["first_relevant_rank"], 2)
        self.assertAlmostEqual(
            report["queries"][0]["evaluation"]["by_k"]["3"]["context_precision"],
            1 / 3,
            places=6,
        )

    def test_build_search_url_supports_current_chunks_and_notes_api(self) -> None:
        query = parse_gold_query(
            {
                "id": "filtered",
                "query": "示例 服务",
                "relevant": [{"path": "example.md"}],
                "params": {"tag": "demo"},
            }
        )
        chunks_url = build_search_url("http://wiki.test/", "/api/search/chunks", query, 10)
        notes_url = build_search_url(
            "http://wiki.test",
            "/api/notes",
            query,
            5,
            adapter="notes",
            fixed_params={"source_type": "source"},
        )

        self.assertTrue(chunks_url.startswith("http://wiki.test/api/search/chunks?"))
        self.assertIn("q=%E7%A4%BA%E4%BE%8B+%E6%9C%8D%E5%8A%A1", chunks_url)
        self.assertIn("limit=10", chunks_url)
        self.assertIn("tag=demo", chunks_url)
        self.assertIn("page_size=5", notes_url)
        self.assertIn("source_type=source", notes_url)

    def test_token_estimate_is_deterministic_for_chinese_and_ascii(self) -> None:
        self.assertEqual(estimate_tokens("知识库"), 3)
        self.assertEqual(estimate_tokens("abcdefgh"), 2)
        self.assertEqual(estimate_tokens("知识 abcdefgh"), 4)


if __name__ == "__main__":
    unittest.main()
