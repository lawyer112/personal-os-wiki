from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from frontmatter import Frontmatter, IngestError, parse, serialize, validate  # noqa: E402


def valid_frontmatter(**overrides: object) -> Frontmatter:
    data = {
        "title": "Demo note",
        "type": "project",
        "created_by": "hermes:worker",
        "task_id": "task-123",
        "agent_id": "worker-1",
        "project": "Demo Project",
        "source_type": "agent-output",
        "tags": ["Travel", "#tokyo", "travel"],
        "created_at": "2026-05-13T10:00:00+08:00",
    }
    data.update(overrides)
    return Frontmatter.model_validate(data)


def assert_ingest_error(code: str, callback) -> IngestError:
    with pytest.raises(IngestError) as error:
        callback()
    assert error.value.status_code == 400
    assert error.value.code == code
    return error.value


def test_parse_yaml_error_raises_ingest_error() -> None:
    error = assert_ingest_error(
        "frontmatter-parse-error",
        lambda: parse("---\ntitle: [unterminated\n---\nbody"),
    )

    assert "excerpt" in (error.details or {})


def test_missing_required_fields_reports_all_missing() -> None:
    fm = Frontmatter(title="Only title")

    error = assert_ingest_error("frontmatter-missing-fields", lambda: validate(fm))

    assert error.details == {
        "missing_fields": ["type", "created_by", "source_type", "tags", "created_at"]
    }


@pytest.mark.parametrize("bad_type", ["Atoms", "atoms", "PROJECT"])
def test_type_variants_are_rejected_without_coercion(bad_type: str) -> None:
    fm = valid_frontmatter(type=bad_type)

    error = assert_ingest_error("invalid-type", lambda: validate(fm))

    assert error.details["value"] == bad_type


def test_agent_write_requires_task_id() -> None:
    fm = valid_frontmatter(task_id=None)

    assert_ingest_error("task-id-required-for-agent", lambda: validate(fm))


def test_project_type_requires_project_field() -> None:
    fm = valid_frontmatter(project=" ")

    assert_ingest_error("project-field-required", lambda: validate(fm))


def test_agent_id_empty_string_is_rejected() -> None:
    fm = valid_frontmatter(agent_id="")

    assert_ingest_error("agent-id-empty-string", lambda: validate(fm))


def test_created_at_without_timezone_is_rejected() -> None:
    fm = valid_frontmatter(created_at="2026-05-13T10:00:00")

    assert_ingest_error("invalid-timestamp", lambda: validate(fm))


def test_tags_are_case_folded_deduped_and_strip_hash_prefix() -> None:
    fm = valid_frontmatter(tags=["Travel", "#travel", "TOKYO", "#Tokyo", " food "])

    assert fm.tags == ["travel", "tokyo", "food"]


def test_title_and_project_are_stripped() -> None:
    fm = valid_frontmatter(title="  Demo  ", project="  Tokyo Trip  ")

    assert fm.title == "Demo"
    assert fm.project == "Tokyo Trip"


def test_serialize_parse_roundtrip_for_valid_frontmatter() -> None:
    fm = valid_frontmatter()

    parsed, body = parse(serialize(fm, "## Body\n\nText"))

    assert parsed == fm
    assert body == "## Body\n\nText"
