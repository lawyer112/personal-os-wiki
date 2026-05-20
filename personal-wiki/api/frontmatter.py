from __future__ import annotations

import datetime as dt
import re
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator


ALLOWED_TYPES = {"atom", "project", "journal", "skill", "source"}
ALLOWED_CREATED_BY = {"user", "hermes:intake", "hermes:dispatcher", "hermes:worker"}
ALLOWED_SOURCE_TYPES = {"user-note", "article", "transcript", "agent-output"}
REQUIRED_FIELDS = ("title", "type", "created_by", "source_type", "tags", "created_at")
TAG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9\-]{0,40}$")


class IngestError(Exception):
    def __init__(self, status_code: int, code: str, details: dict[str, Any] | None = None):
        super().__init__(code)
        self.status_code = status_code
        self.code = code
        self.details = details


class Frontmatter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    type: str | None = None
    created_by: str | None = None
    source_type: str | None = None
    tags: list[str] | None = None
    created_at: str | None = None
    task_id: str | None = None
    agent_id: str | None = None
    project: str | None = None
    last_reviewed: str | None = None
    migration: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_values(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        for key in ("title", "project"):
            value = normalized.get(key)
            if isinstance(value, str):
                normalized[key] = value.strip()

        tags = normalized.get("tags")
        if tags is not None:
            if isinstance(tags, list):
                seen = set()
                folded = []
                for tag in tags:
                    clean = str(tag).strip().lstrip("#").lower()
                    if clean and clean not in seen:
                        seen.add(clean)
                        folded.append(clean)
                normalized["tags"] = folded
            else:
                normalized["tags"] = tags

        return normalized


def parse(text: str) -> tuple[Frontmatter, str]:
    if not text.startswith("---"):
        return Frontmatter(), text

    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return Frontmatter(), text

    closing_index = None
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            closing_index = index
            break

    if closing_index is None:
        raise IngestError(400, "frontmatter-parse-error", {"excerpt": text[:200]})

    yaml_text = "".join(lines[1:closing_index])
    body = "".join(lines[closing_index + 1 :])
    if body.startswith("\n"):
        body = body[1:]

    try:
        raw = yaml.safe_load(yaml_text) or {}
    except yaml.YAMLError as error:
        raise IngestError(
            400,
            "frontmatter-parse-error",
            {"excerpt": str(error)[:200]},
        ) from error

    if not isinstance(raw, dict):
        raise IngestError(400, "frontmatter-parse-error", {"excerpt": yaml_text[:200]})

    try:
        return Frontmatter.model_validate(raw), body
    except Exception as error:
        raise IngestError(
            400,
            "frontmatter-parse-error",
            {"excerpt": str(error)[:200]},
        ) from error


def serialize(fm: Frontmatter, body: str) -> str:
    data = fm.model_dump(exclude_none=True)
    yaml_text = yaml.safe_dump(
        data,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
    ).strip()
    return f"---\n{yaml_text}\n---\n\n{body}"


def validate(fm: Frontmatter) -> None:
    missing = []
    for field in REQUIRED_FIELDS:
        value = getattr(fm, field)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(field)
    if fm.tags is None:
        if "tags" not in missing:
            missing.append("tags")

    if missing:
        raise IngestError(400, "frontmatter-missing-fields", {"missing_fields": missing})

    if fm.type not in ALLOWED_TYPES:
        raise IngestError(400, "invalid-type", {"allowed": sorted(ALLOWED_TYPES), "value": fm.type})

    if fm.created_by not in ALLOWED_CREATED_BY:
        raise IngestError(
            400,
            "invalid-created-by",
            {"allowed": sorted(ALLOWED_CREATED_BY), "value": fm.created_by},
        )

    if fm.source_type not in ALLOWED_SOURCE_TYPES:
        raise IngestError(
            400,
            "invalid-source-type",
            {"allowed": sorted(ALLOWED_SOURCE_TYPES), "value": fm.source_type},
        )

    if fm.created_by and fm.created_by.startswith("hermes:") and not _has_text(fm.task_id):
        raise IngestError(
            400,
            "task-id-required-for-agent",
            {"created_by": fm.created_by},
        )

    if fm.type == "project" and not _has_text(fm.project):
        raise IngestError(400, "project-field-required", {"type": fm.type})

    if fm.agent_id == "":
        raise IngestError(400, "agent-id-empty-string", {"agent_id": fm.agent_id})

    if fm.created_at is not None and not _has_timezone(fm.created_at):
        raise IngestError(400, "invalid-timestamp", {"created_at": fm.created_at})

    bad_tags = [tag for tag in fm.tags or [] if not TAG_PATTERN.match(tag)]
    if bad_tags:
        raise IngestError(400, "invalid-tag-format", {"tags": bad_tags})


def _has_text(value: str | None) -> bool:
    return bool(value and value.strip())


def _has_timezone(value: str) -> bool:
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None and parsed.utcoffset() is not None
