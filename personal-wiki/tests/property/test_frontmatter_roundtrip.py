from __future__ import annotations

import sys
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "api"))

from frontmatter import Frontmatter, parse, serialize, validate  # noqa: E402


ascii_cjk = st.characters(
    whitelist_categories=("Ll", "Lu", "Nd"),
    whitelist_characters=" -_东京行项目测试",
)
title_strategy = st.text(ascii_cjk, min_size=1, max_size=100).filter(lambda value: value.strip())
type_strategy = st.sampled_from(["atom", "project", "journal", "skill", "source"])
created_by_strategy = st.sampled_from(["user", "hermes:intake", "hermes:dispatcher", "hermes:worker"])
tag_chars = st.sampled_from(tuple("abcdefghijklmnopqrstuvwxyz0123456789-"))
valid_tag = st.text(tag_chars, min_size=1, max_size=20).filter(lambda value: value[0].isalnum())
tag_strategy = st.lists(valid_tag, max_size=10, unique=True)


@st.composite
def note_strategy(draw):
    note_type = draw(type_strategy)
    created_by = draw(created_by_strategy)
    data = {
        "title": draw(title_strategy),
        "type": note_type,
        "created_by": created_by,
        "source_type": draw(st.sampled_from(["user-note", "article", "transcript", "agent-output"])),
        "tags": draw(tag_strategy),
        "created_at": draw(st.datetimes(timezones=st.timezones())).isoformat(),
    }
    if created_by.startswith("hermes:"):
        data["task_id"] = draw(st.text(ascii_cjk, min_size=1, max_size=40).filter(lambda value: value.strip()))
        data["agent_id"] = draw(st.none() | st.text(ascii_cjk, min_size=1, max_size=40).filter(lambda value: value.strip()))
    if note_type == "project":
        data["project"] = draw(title_strategy)
    return Frontmatter.model_validate(data)


@settings(max_examples=200)
@given(note=note_strategy())
def test_roundtrip(note: Frontmatter) -> None:
    validate(note)
    parsed, body = parse(serialize(note, "Body"))

    assert parsed == note
    assert body == "Body"
