#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from typing import Any


DEFAULT_KEYWORDS = [
    "公众号",
    "wechat-publish-template",
    "MultiPost",
    "文章转视频",
    "内容矩阵",
    "小红书",
    "视频号",
    "Hermes Agent",
    "Skill",
    "MCP",
    "变现",
]


def fetch_json(url: str, token: str = "") -> dict[str, Any]:
    request = urllib.request.Request(url)
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(request, timeout=15) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data if isinstance(data, dict) else {}


def check_keyword(base_url: str, keyword: str, token: str, page_size: int) -> dict[str, Any]:
    query = urllib.parse.urlencode({"q": keyword, "page_size": page_size})
    data = fetch_json(f"{base_url.rstrip('/')}/api/notes?{query}", token)
    notes = data.get("notes") if isinstance(data.get("notes"), list) else []
    return {
        "keyword": keyword,
        "total": int(data.get("total") or len(notes)),
        "notes": [
            {
                "title": note.get("title", ""),
                "path": note.get("path", ""),
                "tags": note.get("tags", []),
                "source_url": note.get("source_url", ""),
                "source_type": note.get("source_type", ""),
                "hit_snippet": note.get("hit_snippet", note.get("excerpt", "")),
            }
            for note in notes[:5]
            if isinstance(note, dict)
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Check Personal Wiki search quality for required keywords.")
    parser.add_argument("--wiki-url", default=os.environ.get("PERSONAL_WIKI_URL", "http://192.168.6.28:3422"))
    parser.add_argument("--read-token", default=os.environ.get("WIKI_READ_TOKEN", os.environ.get("WIKI_API_TOKEN", "")))
    parser.add_argument("--keyword", action="append", default=[])
    parser.add_argument("--min-count", type=int, default=1)
    parser.add_argument("--page-size", type=int, default=10)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    keywords = args.keyword or DEFAULT_KEYWORDS
    results = [check_keyword(args.wiki_url, keyword, args.read_token, args.page_size) for keyword in keywords]
    ok = all(result["total"] >= args.min_count for result in results)

    if args.json:
        print(json.dumps({"ok": ok, "results": results}, ensure_ascii=False, indent=2))
    else:
        print("Wiki 搜索验收")
        for result in results:
            status = "OK" if result["total"] >= args.min_count else "MISS"
            print(f"- {status} {result['keyword']}：{result['total']} 条")
            for note in result["notes"][:3]:
                print(f"  - {note['title']} [{note['source_type']}] {note['path']}")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
