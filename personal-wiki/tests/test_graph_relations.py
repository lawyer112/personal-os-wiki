from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from server import (  # noqa: E402
    build_graph_from_records,
    build_source_hash_index,
    json_for_script,
    render_markdown_body,
)


def note(
    title: str,
    path: str,
    *,
    concepts: list[str] | None = None,
    tags: list[str] | None = None,
) -> dict[str, object]:
    concepts = concepts or []
    body_links = "\n".join(f"[[{concept}]]" for concept in concepts)
    return {
        "title": title,
        "path": path,
        "body": f"# {title}\n\n{body_links}",
        "tags": tags or [],
        "concepts": concepts,
        "source_type": "manual",
    }


class GraphRelationTests(unittest.TestCase):
    def test_adds_scored_related_links_for_strong_note_relations(self) -> None:
        graph = build_graph_from_records(
            [
                note(
                    "Browser capture",
                    "vault/20_notes/capture.md",
                    concepts=["Personal OS", "Web Capture"],
                    tags=["capture", "auto-ingested"],
                ),
                note(
                    "Extension intake",
                    "vault/20_notes/extension.md",
                    concepts=["Personal OS", "Web Capture"],
                    tags=["capture", "auto-ingested"],
                ),
                note(
                    "Unrelated",
                    "vault/20_notes/unrelated.md",
                    concepts=["Release"],
                    tags=["release"],
                ),
            ]
        )

        related = [link for link in graph["links"] if link["type"] == "related"]

        self.assertEqual(len(related), 1)
        self.assertEqual(related[0]["score"], 0.9)
        self.assertEqual(related[0]["strength"], "90%")
        self.assertEqual(related[0]["reason"]["shared_concepts"], ["personal os", "web capture"])
        self.assertEqual(related[0]["reason"]["shared_tags"], ["capture"])

    def test_keeps_weak_note_relations_out_of_the_graph(self) -> None:
        graph = build_graph_from_records(
            [
                note("First", "vault/20_notes/first.md", concepts=["Personal OS"], tags=["auto-ingested"]),
                note("Second", "vault/20_notes/second.md", concepts=["Personal OS"], tags=["auto-ingested"]),
            ]
        )

        self.assertFalse([link for link in graph["links"] if link["type"] == "related"])
        self.assertTrue([link for link in graph["links"] if link["type"] == "wikilink"])

    def test_excludes_generic_tags_from_relation_scoring(self) -> None:
        graph = build_graph_from_records(
            [
                note("First", "vault/20_notes/first.md", tags=["auto-ingested", "web-capture"]),
                note("Second", "vault/20_notes/second.md", tags=["auto-ingested", "web-capture"]),
            ]
        )

        self.assertFalse([link for link in graph["links"] if link["type"] == "related"])

    def test_caps_related_links_per_note(self) -> None:
        graph = build_graph_from_records(
            [
                note(
                    f"Note {index}",
                    f"vault/20_notes/note-{index}.md",
                    concepts=["Personal OS", "Web Capture"],
                    tags=["capture"],
                )
                for index in range(12)
            ]
        )

        counts: dict[str, int] = {}
        for link in graph["links"]:
            if link["type"] != "related":
                continue
            counts[link["source"]] = counts.get(link["source"], 0) + 1
            counts[link["target"]] = counts.get(link["target"], 0) + 1

        self.assertLessEqual(max(counts.values()), 8)


class IndexAndRenderSafetyTests(unittest.TestCase):
    def test_builds_source_hash_reverse_index(self) -> None:
        index = build_source_hash_index(
            [
                {
                    "source_hash": "abc123",
                    "path": "vault/20_notes/demo.md",
                },
                {
                    "source_hash": "",
                    "path": "vault/20_notes/missing.md",
                },
            ]
        )

        self.assertEqual(index["sources"], {"abc123": "vault/20_notes/demo.md"})

    def test_escapes_inline_json_for_script_context(self) -> None:
        encoded = json_for_script(
            {
                "nodes": [
                    {
                        "id": "</script><script>alert(1)</script><!--",
                    }
                ],
            }
        )

        self.assertNotIn("<", encoded)
        self.assertIn("\\u003c/script", encoded)

    def test_escapes_html_inside_rendered_markdown(self) -> None:
        html = render_markdown_body(
            "# <script>alert(1)</script>\n\n"
            "- [bad](javascript:alert(1))\n"
            "- <img src=x onerror=alert(1)>"
        )

        self.assertNotIn("<script>", html)
        self.assertNotIn("<img", html)
        self.assertNotIn("javascript:alert", html)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", html)


if __name__ == "__main__":
    unittest.main()
