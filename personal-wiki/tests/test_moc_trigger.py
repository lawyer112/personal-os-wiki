from __future__ import annotations

import json
import sys
import time
from http import HTTPStatus
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from server import handle_admin_moc_rebuild, ingest_http_request  # noqa: E402


TOKEN = "wiki-token-000000"


def payload() -> dict[str, object]:
    return {
        "frontmatter": {
            "title": "东京交通整理",
            "type": "project",
            "created_by": "hermes:worker",
            "task_id": "task-1",
            "agent_id": "worker-1",
            "project": "2026-05 东京行",
            "source_type": "agent-output",
            "tags": ["tokyo"],
            "created_at": "2026-05-13T10:00:00+08:00",
        },
        "content": "Body",
    }


def call_ingest(vault_root: Path):
    raw = json.dumps(payload()).encode("utf-8")
    return ingest_http_request(
        raw,
        {"Authorization": f"Bearer {TOKEN}"},
        vault_root=vault_root,
        api_token=TOKEN,
        content_length=len(raw),
    )


def test_ingest_triggers_moc_rebuild(tmp_path: Path) -> None:
    status, data = call_ingest(tmp_path)

    assert status.value == 201
    index = tmp_path / "00_meta" / "index.md"
    deadline = time.monotonic() + 1
    while time.monotonic() < deadline and not index.exists():
        time.sleep(0.02)

    assert index.exists()
    assert "东京交通整理" in index.read_text(encoding="utf-8")
    assert data["path"] == "30_projects/2026-05-东京行/东京交通整理.md"


def test_manual_moc_rebuild_endpoint_shape(tmp_path: Path) -> None:
    status, data = handle_admin_moc_rebuild(tmp_path)

    assert status == HTTPStatus.OK
    assert data["status"] == "rebuilt"
    assert (tmp_path / "00_meta" / "index.md").exists()
