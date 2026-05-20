from __future__ import annotations

import hashlib
import re
import unicodedata


CJK = r"\u4e00-\u9fff"
ALLOWED = re.compile(rf"[^A-Za-z0-9_\-{CJK}]")


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).strip()
    s = re.sub(r"\s+", "-", s)
    s = ALLOWED.sub("", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    s = s[:80]
    if not s:
        digest = hashlib.sha1(s.encode("utf-8")).hexdigest()[:8]
        return f"slug-{digest}"
    return s
