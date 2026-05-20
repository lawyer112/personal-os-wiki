from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "api"))

import server  # noqa: E402
from server import ingest_http_request  # noqa: E402
from tag_registry import load_registry  # noqa: E402


TOKEN = "wiki-token-000000"


tag_strategy = st.text(alphabet="abcdefghijklmnopqrstuvwxyz0123456789-", min_size=1, max_size=12).filter(
    lambda value: value[0].isalnum() and "--" not in value
)


@given(notes=st.lists(st.lists(tag_strategy, min_size=0, max_size=5), min_size=1, max_size=10))
@settings(max_examples=100, deadline=None)
def test_all_written_tags_are_in_registry(notes: list[list[str]]) -> None:
    with tempfile.TemporaryDirectory() as directory:
        vault = Path(directory) / "vault"
        original_trigger = server.trigger_moc_rebuild
        server.trigger_moc_rebuild = lambda vault_root: None
        try:
            for index, tags in enumerate(notes):
                fm = {
                    "title": f"Note {index}",
                    "type": "project",
                    "created_by": "hermes:worker",
                    "task_id": f"task-{index}",
                    "agent_id": "worker-1",
                    "project": "Project",
                    "source_type": "agent-output",
                    "tags": tags,
                    "created_at": "2026-05-13T10:00:00+08:00",
                }
                raw = json.dumps({"frontmatter": fm, "content": "Body"}).encode("utf-8")
                status, data = ingest_http_request(
                    raw,
                    {"Authorization": f"Bearer {TOKEN}"},
                    vault_root=vault,
                    api_token=TOKEN,
                    content_length=len(raw),
                )
                assert status.value == 201, data
        finally:
            server.trigger_moc_rebuild = original_trigger

        registry = load_registry(vault)
        known = registry.approved | registry.pending
        written = {tag for tags in notes for tag in tags}
        assert written <= known
