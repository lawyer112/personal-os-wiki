from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from frontmatter import IngestError  # noqa: E402
from server import archive_note, ingest_http_request, update_note  # noqa: E402


TOKEN = "wiki-token-000000"


def source_payload() -> dict[str, object]:
    return {
        "frontmatter": {
            "title": "东京交通来源",
            "type": "source",
            "created_by": "user",
            "source_type": "article",
            "tags": ["Tokyo"],
            "created_at": "2026-05-13T10:00:00+08:00",
        },
        "content": "Source body",
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


def test_source_ingest_is_create_once_then_conflict(tmp_path: Path) -> None:
    status, data = call_ingest(tmp_path, source_payload())
    assert status.value == 201
    assert data["path"] == "10_sources/2026-05-13/东京交通来源.md"

    status, data = call_ingest(tmp_path, source_payload())

    assert status.value == 409
    assert data["code"] == "source-immutable"


def test_legacy_write_endpoints_return_gone_for_sources(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    data_dir = tmp_path / "data"
    source_path = data_dir / "vault" / "10_sources" / "2026-05-13" / "source.md"
    source_path.parent.mkdir(parents=True)
    source_path.write_text(
        "---\ntitle: Source\ntags: []\n---\n\nBody\n",
        encoding="utf-8",
    )
    monkeypatch.setattr("server.DATA_DIR", data_dir)
    monkeypatch.setattr("server.VAULT_DIR", data_dir / "vault")
    monkeypatch.setattr("server.PUBLIC_DIR", data_dir / "public")
    monkeypatch.setattr("server.init_git", lambda: None)

    with pytest.raises(IngestError) as update_error:
        update_note({"path": "vault/10_sources/2026-05-13/source.md", "content": "changed"})
    with pytest.raises(IngestError) as archive_error:
        archive_note({"path": "vault/10_sources/2026-05-13/source.md"}, "deleted")

    assert update_error.value.status_code == 410
    assert archive_error.value.status_code == 410
    assert source_path.read_text(encoding="utf-8").endswith("Body\n")
