from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from locks import project_lock  # noqa: E402
from server import ingest_http_request  # noqa: E402


TOKEN = "wiki-token-000000"


def payload(frontmatter: dict[str, object] | None = None, content: str = "Body") -> dict[str, object]:
    fm = {
        "title": "东京交通整理",
        "type": "project",
        "created_by": "hermes:worker",
        "task_id": "task-1",
        "agent_id": "worker-1",
        "project": "2026-05 东京行",
        "source_type": "agent-output",
        "tags": ["Travel", "#Tokyo"],
        "created_at": "2026-05-13T10:00:00+08:00",
    }
    if frontmatter:
        fm.update(frontmatter)
    return {"frontmatter": fm, "content": content}


def call_ingest(
    tmp_path: Path,
    body: object,
    *,
    token: str | None = TOKEN,
    content_length: int | None = None,
    lock_timeout: float = 5,
):
    headers = {}
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    raw = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
    return ingest_http_request(
        raw,
        headers,
        vault_root=tmp_path,
        api_token=TOKEN,
        base_url="http://wiki.local",
        content_length=len(raw) if content_length is None else content_length,
        lock_timeout=lock_timeout,
    )


def assert_error(tmp_path: Path, body: object, code: str, status_code: int = 400, **kwargs) -> None:
    status, data = call_ingest(tmp_path, body, **kwargs)

    assert status.value == status_code
    assert data["code"] == code


def test_401_missing_or_invalid_token(tmp_path: Path) -> None:
    assert_error(tmp_path, payload(), "missing-or-invalid-token", 401, token=None)


def test_413_body_too_large(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WIKI_MAX_BODY_BYTES", "10")

    assert_error(tmp_path, payload(), "body-too-large", 413, content_length=100)


@pytest.mark.parametrize(
    ("body", "code"),
    [
        (b"{", "invalid-json"),
        ({"frontmatter": "bad", "content": "Body"}, "frontmatter-parse-error"),
        ({"frontmatter": {"title": "Only title"}, "content": "Body"}, "frontmatter-missing-fields"),
        (payload({"type": "PROJECT"}), "invalid-type"),
        (payload({"created_by": "robot"}), "invalid-created-by"),
        (payload({"task_id": None}), "task-id-required-for-agent"),
        (payload({"project": " "}), "project-field-required"),
        (payload({"agent_id": ""}), "agent-id-empty-string"),
        (payload({"source_type": "web"}), "invalid-source-type"),
        (payload({"created_at": "2026-05-13T10:00:00"}), "invalid-timestamp"),
    ],
)
def test_400_error_codes(tmp_path: Path, body: object, code: str) -> None:
    assert_error(tmp_path, body, code)


def test_201_project_happy_path(tmp_path: Path) -> None:
    status, data = call_ingest(tmp_path, payload())

    assert status.value == 201
    assert data["status"] == "created"
    assert data["path"] == "30_projects/2026-05-东京行/东京交通整理.md"
    assert data["directory"] == "30_projects/2026-05-东京行"
    assert data["task_id"] == "task-1"
    assert (tmp_path / data["path"]).exists()


def test_201_journal_happy_path(tmp_path: Path) -> None:
    status, data = call_ingest(
        tmp_path,
        payload({"type": "journal", "project": None, "created_by": "user", "task_id": None}),
    )

    assert status.value == 201
    assert data["path"] == "40_journals/2026-05-13.md"


def test_201_source_happy_path(tmp_path: Path) -> None:
    status, data = call_ingest(
        tmp_path,
        payload({"type": "source", "project": None, "created_by": "user", "task_id": None, "source_type": "article"}),
    )

    assert status.value == 201
    assert data["path"] == "10_sources/2026-05-13/东京交通整理.md"


def test_revision_suffix_for_same_target(tmp_path: Path) -> None:
    assert call_ingest(tmp_path, payload())[1]["status"] == "created"

    status, data = call_ingest(tmp_path, payload())

    assert status.value == 201
    assert data["status"] == "revision"
    assert data["path"].endswith("/东京交通整理-r2.md")


def test_409_source_immutable(tmp_path: Path) -> None:
    source_payload = payload({"type": "source", "project": None, "created_by": "user", "task_id": None})
    assert call_ingest(tmp_path, source_payload)[0].value == 201

    assert_error(tmp_path, source_payload, "source-immutable", 409)


def test_503_lock_timeout(tmp_path: Path) -> None:
    with project_lock(tmp_path, "2026-05-东京行", timeout=1):
        assert_error(tmp_path, payload(), "lock-timeout", 503, lock_timeout=0.01)
