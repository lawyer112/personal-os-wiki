#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import urllib.request
from pathlib import Path
from typing import Any


THEMES: list[dict[str, Any]] = [
    {
        "title": "X Likes 主题整理 - 公众号运营与内容矩阵",
        "tags": ["x-likes", "wechat-official-account", "content-matrix", "multi-platform-publishing"],
        "keywords": ["公众号运营", "内容矩阵", "MultiPost", "wechat-publish-template"],
        "core": "现有 X Likes Digest 已经把公众号运营、内容矩阵、文章转视频和多平台分发放在同一条内容生产线上。首要价值不是收藏工具名，而是把选题、改写、排版、分发、复盘做成闭环。",
        "topics": ["账号定位", "流量来源", "内容形态", "变现方式", "批量化方法", "多平台分发", "风险"],
        "posts": ["内容矩阵初稿：公众号运营 + 文章转视频 + X 内容雷达", "X Likes Digest - 2026-05-20 11:28 - +5", "X Likes Digest - 2026-05-20 - 首批采集"],
        "ideas": ["《公众号批量运营的关键不是搬运，而是选题-改写-分发闭环》", "《文章如何一键转成公众号、视频号、小红书内容》", "《MultiPost 是否适合接入个人内容矩阵？》"],
        "tools": ["wechat-publish-template", "MultiPost", "Personal Wiki", "Obsidian"],
    },
    {
        "title": "X Likes 主题整理 - 文章转视频与短视频",
        "tags": ["x-likes", "article-to-video", "short-video", "xiaohongshu"],
        "keywords": ["文章转视频", "短视频", "小红书", "视频号"],
        "core": "Likes 里已经出现文章转视频、视频号和小红书方向。可用路径是先把长文拆成结构化脚本，再按平台生成不同长度和素材形态，而不是把同一篇文章直接搬到所有平台。",
        "topics": ["长文拆解", "脚本生成", "TTS/字幕", "视频号", "小红书", "素材版权", "平台适配"],
        "posts": ["内容矩阵初稿：公众号运营 + 文章转视频 + X 内容雷达", "X Likes Digest - 2026-05-20 - 首批采集"],
        "ideas": ["《一篇长文如何拆成 3 条短视频脚本》", "《文章转视频工具评测：从可用到可发布还差什么》", "《视频号和小红书不能共用同一套文案》"],
        "tools": ["Remotion", "CapCut/剪映", "TTS 工具", "Personal Wiki 素材池"],
    },
    {
        "title": "X Likes 主题整理 - 多平台分发工具",
        "tags": ["x-likes", "multi-platform-publishing", "wechat-official-account", "github-tool", "automation"],
        "keywords": ["MultiPost", "wechat-publish-template", "多平台分发", "自动化"],
        "core": "多平台分发的重点是稳定格式转换和账号安全。工具可以先服务于排版、草稿生成和人工确认，不应该一开始就追求全自动发布。",
        "topics": ["格式转换", "草稿生成", "账号安全", "发布队列", "失败重试", "人工确认"],
        "posts": ["内容矩阵初稿：公众号运营 + 文章转视频 + X 内容雷达", "X Likes Digest - 2026-05-20 - tweetxvault-100", "X Likes Digest - 2026-05-20 11:28 - +5"],
        "ideas": ["《MultiPost 是否适合接入个人内容矩阵？》", "《公众号排版工具如何接入自动化流水线》", "《多平台发布最危险的不是技术，而是账号风控》"],
        "tools": ["MultiPost", "wechat-publish-template", "GitHub Actions", "定时任务"],
    },
    {
        "title": "X Likes 主题整理 - Hermes Agent 与 Skill 工作流",
        "tags": ["x-likes", "hermes-agent", "agent-workflow", "mcp-skill", "personal-wiki", "automation"],
        "keywords": ["Hermes Agent", "Skill", "MCP", "Personal Wiki"],
        "core": "这批 Likes 对 Agent 工作流的价值在于把工具、Skill、MCP 和 Wiki 连接成可复用流程。Agent 后续应优先检索主题页和结构化来源页，而不是临时翻原始 JSON。",
        "topics": ["Agent 调度", "Skill 化", "MCP 工具", "Obsidian 同步", "Wiki 检索", "任务复盘"],
        "posts": ["X Likes Digest - 2026-05-20 - 首批采集", "X Likes Digest - 2026-05-20 11:28 - +5", "Personal Wiki Mirror"],
        "ideas": ["《Hermes Agent 如何把收藏变成任务和知识》", "《Skill 工作流不是提示词仓库，而是可执行 SOP》", "《Personal Wiki 作为 Agent 外挂脑的边界》"],
        "tools": ["Hermes Agent", "MCP", "Skill", "Personal Wiki", "Obsidian"],
    },
    {
        "title": "X Likes 主题整理 - 内容变现与副业案例",
        "tags": ["x-likes", "creator-monetization", "content-matrix", "saas-case"],
        "keywords": ["变现", "副业", "内容矩阵", "SaaS"],
        "core": "变现类 Likes 需要分层处理：低风险工具评测和流程复盘可以直接转文章；涉及收益承诺、搬运、多账号放大的内容必须先进风险复核。",
        "topics": ["创作者变现", "工具评测", "案例拆解", "付费产品", "风险复核", "收益真实性"],
        "posts": ["内容矩阵初稿：公众号运营 + 文章转视频 + X 内容雷达", "X Likes Digest - 2026-05-20 - tweetxvault-100", "X Likes Digest - 2026-05-20 - 首批采集"],
        "ideas": ["《内容变现不是找捷径，而是把素材变成产品》", "《副业案例进入知识库前要先做风险分级》", "《从 X Likes 里筛选可验证的商业选题》"],
        "tools": ["Cyberstore", "Personal Wiki", "选题池", "风险标签"],
    },
    {
        "title": "X Likes 主题整理 - GitHub 工具与 SaaS 案例",
        "tags": ["x-likes", "github-tool", "saas-case", "automation"],
        "keywords": ["GitHub 工具", "SaaS", "自动化", "开源工具"],
        "core": "GitHub 工具和 SaaS 案例适合沉淀成可测试清单：先记录来源、用途和风险，再决定是否进入 Cyberstore、公众号文章或工具实测。",
        "topics": ["GitHub 工具", "开源模板", "SaaS 案例", "工具实测", "Cyberstore 商品化", "自动化部署"],
        "posts": ["X Likes Digest - 2026-05-20 11:28 - +5", "X Likes Digest - 2026-05-20 - 首批采集"],
        "ideas": ["《值得实测的 GitHub 工具如何筛选》", "《从开源模板到 SaaS 产品，中间缺哪几步》", "《Cyberstore 可以从 X Likes 自动生成工具评测池》"],
        "tools": ["GitHub", "Cyberstore", "自动化脚本", "Personal Wiki"],
    },
]


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def render_theme(theme: dict[str, Any]) -> str:
    posts = "\n".join(
        f"""### {index}. {post}
- 摘要：来自现有 X Likes Digest / Wiki 来源页的聚合入口。
- 可用法：进入该主题的文章、工具评测或视频选题池。
- 风险：需要在原始 tweet_id 级来源页补齐后复核。
- 后续动作：用 `x_likes_knowledge_pipeline.py` 补齐单条 Like 来源页。"""
        for index, post in enumerate(theme["posts"], 1)
    )
    topics = "\n".join(f"- {item}" for item in theme["topics"])
    ideas = "\n".join(f"- {item}" for item in theme["ideas"])
    tools = "\n".join(f"- {item}" for item in theme["tools"])
    concepts = "\n".join(f"- [[{item}]]" for item in theme["keywords"])
    return f"""# {theme["title"]}

## 核心判断
{theme["core"]}

## 主题地图
{topics}

## 代表帖
{posts}

## 可转化选题
{ideas}

## 相关工具
{tools}

## 相关概念
{concepts}

## 数据边界
本页先基于 6.28 Wiki 里已有的 X Likes Digest 和内容矩阵初稿生成。后续同步原始 X Likes JSONL/SQLite 后，应由 pipeline 自动补齐 tweet_id、作者、原文、外链和媒体信息。
"""


def ingest(wiki_url: str, token: str, theme: dict[str, Any]) -> dict[str, Any]:
    content = render_theme(theme)
    frontmatter = {
        "title": theme["title"],
        "type": "atom",
        "created_by": "user",
        "source_type": "x-likes-theme",
        "tags": theme["tags"],
        "created_at": utc_now(),
        "summary": theme["core"],
        "source_domain": "x.com",
        "text_hash": hashlib.sha256((theme["title"] + content).encode("utf-8")).hexdigest()[:16],
    }
    request = urllib.request.Request(
        f"{wiki_url.rstrip('/')}/api/ingest",
        data=json.dumps({"frontmatter": frontmatter, "content": content}, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data


def write_obsidian(inbox: Path, theme: dict[str, Any]) -> Path:
    target = inbox / "X Likes" / "主题整理" / f"{slugify(theme['title'])}.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render_theme(theme), encoding="utf-8")
    return target


def slugify(value: str) -> str:
    keep = []
    for char in value:
        if char.isalnum() or char in {"-", "_"} or "\u4e00" <= char <= "\u9fff":
            keep.append(char)
        elif keep and keep[-1] != "-":
            keep.append("-")
    return "".join(keep).strip("-")[:100] or "x-likes-theme"


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed the first six X Likes theme pages from existing Wiki digests.")
    parser.add_argument("--wiki-url", default=os.environ.get("PERSONAL_WIKI_URL", "http://192.168.6.28:3422"))
    parser.add_argument("--wiki-token", default=os.environ.get("WIKI_API_TOKEN", ""))
    parser.add_argument("--obsidian-inbox", type=Path)
    args = parser.parse_args()
    if not args.wiki_token:
        raise SystemExit("--wiki-token or WIKI_API_TOKEN is required")
    for theme in THEMES:
        if args.obsidian_inbox:
            target = write_obsidian(args.obsidian_inbox, theme)
            print(f"{theme['title']} -> obsidian {target}")
        result = ingest(args.wiki_url, args.wiki_token, theme)
        print(f"{theme['title']} -> {result.get('status')} {result.get('path')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
