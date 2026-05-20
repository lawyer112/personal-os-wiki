from __future__ import annotations

import json
import sys
import threading
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from server import ingest_http_request  # noqa: E402
from tag_registry import load_registry  # noqa: E402


TOKEN = "wiki-token-000000"


def payload(title: str, tags: list[str]) -> dict[str, object]:
    return {
        "frontmatter": {
            "title": title,
            "type": "project",
            "created_by": "hermes:worker",
            "task_id": f"task-{title}",
            "agent_id": "worker-1",
            "project": "2026-05 东京行",
            "source_type": "agent-output",
            "tags": tags,
            "created_at": "2026-05-13T10:00:00+08:00",
        },
        "content": "Body",
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


def wait_for_tags(path: Path) -> str:
    deadline = time.monotonic() + 1
    while time.monotonic() < deadline:
        if path.exists():
            text = path.read_text(encoding="utf-8")
            if "## 待审" in text:
                return text
        time.sleep(0.02)
    return path.read_text(encoding="utf-8")


def test_invalid_tag_format_is_rejected(tmp_path: Path) -> None:
    status, data = call_ingest(tmp_path, payload("Bad tag", ["bad_tag!"]))

    assert status.value == 400
    assert data["code"] == "invalid-tag-format"


def test_new_tag_is_appended_to_pending(tmp_path: Path) -> None:
    status, _data = call_ingest(tmp_path, payload("New tag", ["tokyo"]))

    assert status.value == 201
    tags = wait_for_tags(tmp_path / "00_meta" / "tags.md")
    assert "- `tokyo`" in tags


def test_approved_tag_does_not_append_pending(tmp_path: Path) -> None:
    tags_file = tmp_path / "00_meta" / "tags.md"
    tags_file.parent.mkdir(parents=True)
    tags_file.write_text("# Tag Registry\n\n## 已批准\n\n- `tokyo` — 旅行\n\n## 待审\n", encoding="utf-8")

    status, _data = call_ingest(tmp_path, payload("Approved", ["tokyo"]))

    assert status.value == 201
    tags = wait_for_tags(tags_file)
    assert tags.count("- `tokyo`") == 1
    assert load_registry(tmp_path).approved == {"tokyo"}


def test_concurrent_ingest_appends_new_tag_once(tmp_path: Path) -> None:
    def worker(index: int) -> None:
        call_ingest(tmp_path, payload(f"Concurrent {index}", ["shared-tag"]))

    threads = [threading.Thread(target=worker, args=(index,)) for index in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    tags = wait_for_tags(tmp_path / "00_meta" / "tags.md")
    assert tags.count("- `shared-tag`") == 1
