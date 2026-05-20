from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from slugifier import slugify  # noqa: E402


def test_design_examples() -> None:
    assert slugify("2026-05 东京行") == "2026-05-东京行"
    assert slugify("Tokyo Transit Plan") == "Tokyo-Transit-Plan"
    assert slugify("Hello / World !!!") == "Hello-World"
    assert slugify("   ") == "slug-da39a3ee"
    assert slugify("项目: A/B 测试") == "项目-AB-测试"
    assert len(slugify("这是一个很长很长很长" * 20)) == 80


def test_project_slug_is_stable_for_outer_whitespace() -> None:
    assert slugify("东京行") == slugify(" 东京行 ") == slugify("东京行  ")
