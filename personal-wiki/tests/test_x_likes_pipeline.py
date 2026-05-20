from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "x_likes_knowledge_pipeline.py"


def test_x_likes_pipeline_writes_obsidian_and_local_wiki(tmp_path: Path) -> None:
    likes = tmp_path / "likes.jsonl"
    records = [
        {
            "id": "2001",
            "author_username": "toolmaker",
            "author_name": "Tool Maker",
            "created_at": "2026-05-20T10:00:00Z",
            "text": "wechat-publish-template helps turn Markdown into 公众号-ready layout for a 内容矩阵.",
            "url": "https://x.com/toolmaker/status/2001",
            "raw": {
                "id": "2001",
                "text": "wechat-publish-template helps turn Markdown into 公众号-ready layout for a 内容矩阵.",
                "author_id": "u1",
                "created_at": "2026-05-20T10:00:00Z",
                "entities": {"urls": [{"expanded_url": "https://github.com/example/wechat-publish-template"}]},
            },
            "first_seen_at": "2026-05-20T10:01:00Z",
            "last_seen_at": "2026-05-20T10:01:00Z",
        },
        {
            "id": "2002",
            "author_username": "agentdev",
            "author_name": "Agent Dev",
            "created_at": "2026-05-20T11:00:00Z",
            "text": "Hermes Agent workflow with MCP Skill can sync Personal Wiki and Obsidian.",
            "url": "https://x.com/agentdev/status/2002",
            "raw": {"id": "2002", "text": "Hermes Agent workflow with MCP Skill can sync Personal Wiki and Obsidian."},
            "first_seen_at": "2026-05-20T11:01:00Z",
            "last_seen_at": "2026-05-20T11:01:00Z",
        },
    ]
    likes.write_text("\n".join(json.dumps(record, ensure_ascii=False) for record in records), encoding="utf-8")
    obsidian = tmp_path / "obsidian"
    data_dir = tmp_path / "wiki-data"

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--input",
            str(likes),
            "--obsidian-inbox",
            str(obsidian),
            "--wiki-mode",
            "local",
            "--wiki-data-dir",
            str(data_dir),
        ],
        cwd=str(ROOT.parents[0]),
        text=True,
        encoding="utf-8",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert (obsidian / "X Likes" / "来源页" / "2001.md").exists()
    assert "搜索验收" in result.stdout
    assert "公众号：命中" in result.stdout
    assert list((data_dir / "vault" / "10_sources").rglob("*.md"))
    theme_pages = list((data_dir / "vault" / "20_atoms").rglob("*.md"))
    assert any("公众号运营与内容矩阵" in path.read_text(encoding="utf-8") for path in theme_pages)
