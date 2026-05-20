from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

import server  # noqa: E402
from server import filtered_notes, ingest_http_request, read_note, refresh_public_indexes  # noqa: E402


TOKEN = "wiki-token-000000"


def x_like_payload(tweet_id: str = "1001", title: str = "wechat-publish-template") -> dict[str, object]:
    return {
        "frontmatter": {
            "title": title,
            "type": "source",
            "created_by": "user",
            "source_type": "x-like",
            "tags": ["x-likes", "wechat-official-account", "content-matrix", "github-tool"],
            "created_at": "2026-05-20T19:19:00+08:00",
            "source_url": f"https://x.com/demo/status/{tweet_id}",
            "canonical_url": f"https://x.com/demo/status/{tweet_id}",
            "tweet_id": tweet_id,
            "author_handle": "demo",
            "author_name": "Demo User",
            "collected_at": "2026-05-20T19:20:00+08:00",
            "summary": "A WeChat official account publishing template for content matrix work.",
            "risk_level": "低",
            "source_domain": "github.com",
            "text_hash": f"hash-{tweet_id}",
        },
        "content": f"# X Like\n\nwechat-publish-template {tweet_id} can support 公众号 and MultiPost content matrix workflows.",
    }


def call_ingest(vault_root: Path, body: dict[str, object]):
    raw = json.dumps(body).encode("utf-8")
    return ingest_http_request(
        raw,
        {"Authorization": f"Bearer {TOKEN}"},
        vault_root=vault_root,
        api_token=TOKEN,
        content_length=len(raw),
    )


def point_server_at(monkeypatch, vault_root: Path) -> None:
    public = vault_root / "public"
    monkeypatch.setattr(server, "DATA_DIR", vault_root)
    monkeypatch.setattr(server, "VAULT_DIR", vault_root)
    monkeypatch.setattr(server, "PUBLIC_DIR", public)
    monkeypatch.setattr(server, "GRAPH_PATH", public / "graph-data.json")
    monkeypatch.setattr(server, "NOTE_INDEX_PATH", public / "note-index.json")
    monkeypatch.setattr(server, "SOURCE_INDEX_PATH", public / "source-index.json")
    monkeypatch.setattr(server, "init_git", lambda: None)


def test_x_like_ingest_deduplicates_by_tweet_id(tmp_path: Path) -> None:
    status, first = call_ingest(tmp_path, x_like_payload())
    assert status.value == 201
    assert first["status"] == "created"

    status, second = call_ingest(tmp_path, x_like_payload(title="same tweet, new title"))

    assert status.value == 200
    assert second["status"] == "duplicate"
    assert second["path"] == first["path"]


def test_x_like_search_results_include_source_metadata_and_snippet(tmp_path: Path, monkeypatch) -> None:
    point_server_at(monkeypatch, tmp_path)
    assert call_ingest(tmp_path, x_like_payload())[0].value == 201
    refresh_public_indexes()

    results = filtered_notes("公众号")

    assert results
    assert results[0]["source_url"] == "https://x.com/demo/status/1001"
    assert results[0]["tweet_id"] == "1001"
    assert "公众号" in results[0]["hit_snippet"]
    assert filtered_notes(tag="WECHAT-OFFICIAL-ACCOUNT")


def test_x_like_related_notes_use_tags_author_and_domain(tmp_path: Path, monkeypatch) -> None:
    point_server_at(monkeypatch, tmp_path)
    assert call_ingest(tmp_path, x_like_payload("1001", "First X Like"))[0].value == 201
    assert call_ingest(tmp_path, x_like_payload("1002", "Second X Like"))[0].value == 201
    refresh_public_indexes()

    path = filtered_notes("First X Like")[0]["path"]
    note = read_note(path)

    assert note["related_notes"]
    assert note["related_notes"][0]["path"] != path
