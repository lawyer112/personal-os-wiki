from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from server import login_copy, preferred_locale  # noqa: E402


def test_prefers_simplified_chinese_accept_language() -> None:
    locale = preferred_locale("zh-CN,zh;q=0.9,en;q=0.8")

    assert locale == "zh-CN"
    assert "账号密码" in login_copy(locale)["intro"]


def test_falls_back_to_english_for_unknown_language() -> None:
    locale = preferred_locale("zz-ZZ,zz;q=0.9")

    assert locale == "en"
    assert "account/password" in login_copy(locale)["intro"]
