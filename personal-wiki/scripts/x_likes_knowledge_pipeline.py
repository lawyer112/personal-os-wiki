#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import importlib.util
import json
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlparse


DEFAULT_OBSIDIAN_INBOX = Path("/Users/xingqiwu/.hermes/profiles/obsidianmanager1/icarus-fabric/Inbox/")
DEFAULT_COLLECTOR_ROOT = Path(r"C:\Users\admin\Documents\Codex\2026-04-28\x")
DEFAULT_WIKI_URL = "http://192.168.6.28:3422"
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

TOPIC_KEYWORDS: dict[str, list[str]] = {
    "wechat-official-account": ["公众号", "微信", "wechat", "wechat-publish-template", "排版"],
    "content-matrix": ["内容矩阵", "矩阵", "选题", "内容池", "私域"],
    "article-to-video": ["文章转视频", "article to video", "remotion", "tts", "图文转视频"],
    "short-video": ["短视频", "视频号", "抖音", "快手", "capcut", "剪映"],
    "multi-platform-publishing": ["multipost", "多平台", "分发", "cross-post", "发布"],
    "xiaohongshu": ["小红书", "xhs", "rednote"],
    "podcast": ["播客", "podcast"],
    "creator-monetization": ["变现", "副业", "现金流", "付费", "收入", "monetization", "saas"],
    "agent-workflow": ["agent", "workflow", "工作流", "自动化", "orchestrator"],
    "hermes-agent": ["hermes", "hermes agent"],
    "mcp-skill": ["mcp", "skill", "superpowers", "插件"],
    "github-tool": ["github", "repo", "开源", "工具", "template"],
    "saas-case": ["saas", "产品化", "案例", "mrr", "订阅"],
    "personal-wiki": ["personal wiki", "知识库", "obsidian", "wiki", "外挂知识库"],
    "automation": ["自动化", "automation", "定时", "pipeline", "脚本"],
}

THEME_SPECS = [
    (
        "X Likes 主题整理 - 公众号运营与内容矩阵",
        ["wechat-official-account", "content-matrix", "multi-platform-publishing"],
        ["公众号运营", "内容矩阵", "多平台分发"],
    ),
    (
        "X Likes 主题整理 - 文章转视频与短视频",
        ["article-to-video", "short-video", "xiaohongshu"],
        ["文章转视频", "短视频", "小红书", "视频号"],
    ),
    (
        "X Likes 主题整理 - 多平台分发工具",
        ["multi-platform-publishing", "wechat-official-account", "github-tool"],
        ["MultiPost", "wechat-publish-template", "分发工具"],
    ),
    (
        "X Likes 主题整理 - Hermes Agent 与 Skill 工作流",
        ["hermes-agent", "agent-workflow", "mcp-skill", "personal-wiki", "automation"],
        ["Hermes Agent", "Skill", "MCP", "Personal Wiki"],
    ),
    (
        "X Likes 主题整理 - 内容变现与副业案例",
        ["creator-monetization", "content-matrix", "saas-case"],
        ["创作者变现", "副业", "SaaS 案例"],
    ),
    (
        "X Likes 主题整理 - GitHub 工具与 SaaS 案例",
        ["github-tool", "saas-case", "automation"],
        ["GitHub 工具", "SaaS", "自动化"],
    ),
]

RISK_HIGH = ["灰产", "盗版", "破解", "擦边", "搬运", "侵权", "封号"]
RISK_MEDIUM = ["暴利", "涨粉", "多账号", "矩阵", "自动发布", "采集", "收益", "变现"]


@dataclass(frozen=True)
class LikeItem:
    tweet_id: str
    author_handle: str
    author_name: str
    text: str
    url: str
    created_at: str
    collected_at: str
    external_urls: tuple[str, ...]
    media: tuple[dict[str, Any], ...]
    raw: dict[str, Any]
    topics: tuple[str, ...]
    risk_level: str
    text_hash: str


@dataclass(frozen=True)
class NotePayload:
    title: str
    frontmatter: dict[str, Any]
    content: str
    obsidian_relpath: Path


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def ensure_timestamp(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return utc_now()
    if raw.endswith("Z"):
        return raw[:-1] + "+00:00"
    try:
        parsed = dt.datetime.fromisoformat(raw)
    except ValueError:
        return utc_now()
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.isoformat()


def text_hash(value: str) -> str:
    clean = re.sub(r"\s+", " ", value).strip().casefold()
    return hashlib.sha256(clean.encode("utf-8")).hexdigest()[:16]


def slugify(value: str, fallback: str = "note") -> str:
    clean = re.sub(r"[^A-Za-z0-9_\-\u4e00-\u9fff]+", "-", value.strip())
    clean = re.sub(r"-{2,}", "-", clean).strip("-")[:80]
    return clean or fallback


def discover_inputs(explicit: list[Path]) -> list[Path]:
    if explicit:
        return [path for path in explicit if path.exists()]
    candidates = [
        DEFAULT_COLLECTOR_ROOT / "exports" / "x_liked_posts_latest.jsonl",
        DEFAULT_COLLECTOR_ROOT / "exports" / "x_liked_posts_latest.csv",
        DEFAULT_COLLECTOR_ROOT / "data" / "x_likes.sqlite",
    ]
    return [path for path in candidates if path.exists()]


def load_records(paths: list[Path]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for path in paths:
        if path.is_dir():
            nested = [item for item in path.rglob("*") if item.suffix.lower() in {".jsonl", ".json", ".csv", ".sqlite", ".db"}]
            records.extend(load_records(nested))
        elif path.suffix.lower() == ".jsonl":
            records.extend(load_jsonl(path))
        elif path.suffix.lower() == ".json":
            records.extend(load_json(path))
        elif path.suffix.lower() == ".csv":
            records.extend(load_csv(path))
        elif path.suffix.lower() in {".sqlite", ".db"}:
            records.extend(load_sqlite(path))
    return records


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def load_json(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in ("data", "likes", "posts", "tweets"):
            value = data.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        return [data]
    return []


def load_csv(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def load_sqlite(path: Path) -> list[dict[str, Any]]:
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    rows = []
    for row in con.execute(
        """
        SELECT id, author_username, author_name, created_at, text, url, lang,
               possibly_sensitive, public_metrics_json, raw_json, includes_json,
               first_seen_at, last_seen_at
        FROM posts
        ORDER BY COALESCE(created_at, first_seen_at) DESC
        """
    ):
        raw = json.loads(row["raw_json"] or "{}")
        includes = json.loads(row["includes_json"] or "{}")
        rows.append(
            {
                "id": row["id"],
                "author_username": row["author_username"],
                "author_name": row["author_name"],
                "created_at": row["created_at"],
                "text": row["text"],
                "url": row["url"],
                "lang": row["lang"],
                "possibly_sensitive": row["possibly_sensitive"],
                "public_metrics": json.loads(row["public_metrics_json"] or "{}"),
                "raw": raw,
                "includes": includes,
                "first_seen_at": row["first_seen_at"],
                "last_seen_at": row["last_seen_at"],
            }
        )
    return rows


def normalize_record(record: dict[str, Any]) -> LikeItem | None:
    raw = record.get("raw") if isinstance(record.get("raw"), dict) else record
    tweet_id = str(record.get("tweet_id") or record.get("id") or raw.get("id") or "").strip()
    text = str(record.get("text") or raw.get("text") or "").strip()
    if not tweet_id or not text:
        return None
    author_handle = str(record.get("author_username") or record.get("author_handle") or "").strip().lstrip("@")
    author_name = str(record.get("author_name") or "").strip()
    if not author_handle:
        author = find_author(raw, record.get("includes") if isinstance(record.get("includes"), dict) else {})
        author_handle = str(author.get("username") or "").strip()
        author_name = author_name or str(author.get("name") or "").strip()
    url = str(record.get("url") or "").strip()
    if not url:
        url = f"https://x.com/{author_handle}/status/{tweet_id}" if author_handle else f"https://x.com/i/web/status/{tweet_id}"
    external_urls = tuple(sorted(extract_external_urls(record)))
    media = tuple(extract_media(record))
    topics = tuple(classify_topics(text, external_urls))
    risk = risk_level(text, bool(record.get("possibly_sensitive") or raw.get("possibly_sensitive")))
    collected = ensure_timestamp(str(record.get("last_seen_at") or record.get("collected_at") or record.get("first_seen_at") or ""))
    created = ensure_timestamp(str(record.get("created_at") or raw.get("created_at") or collected))
    return LikeItem(
        tweet_id=tweet_id,
        author_handle=author_handle,
        author_name=author_name,
        text=text,
        url=url,
        created_at=created,
        collected_at=collected,
        external_urls=external_urls,
        media=media,
        raw=record,
        topics=topics,
        risk_level=risk,
        text_hash=text_hash(text),
    )


def find_author(raw: dict[str, Any], includes: dict[str, Any]) -> dict[str, Any]:
    author_id = str(raw.get("author_id") or "")
    for user in includes.get("users", []) if isinstance(includes.get("users"), list) else []:
        if str(user.get("id")) == author_id:
            return user
    return {}


def extract_external_urls(record: dict[str, Any]) -> set[str]:
    urls: set[str] = set()
    raw = record.get("raw") if isinstance(record.get("raw"), dict) else record
    for value in record.get("external_urls") or []:
        if str(value).strip():
            urls.add(str(value).strip())
    entities = raw.get("entities") if isinstance(raw, dict) else {}
    for item in entities.get("urls", []) if isinstance(entities, dict) else []:
        for key in ("unwound_url", "expanded_url", "url"):
            value = str(item.get(key) or "").strip()
            if value and "x.com/" not in value and "twitter.com/" not in value:
                urls.add(value)
                break
    return urls


def extract_media(record: dict[str, Any]) -> list[dict[str, Any]]:
    raw = record.get("raw") if isinstance(record.get("raw"), dict) else record
    includes = record.get("includes") if isinstance(record.get("includes"), dict) else {}
    media = includes.get("media", []) if isinstance(includes.get("media"), list) else []
    if media:
        return [item for item in media if isinstance(item, dict)]
    attachments = raw.get("attachments") if isinstance(raw, dict) else {}
    if isinstance(attachments, dict) and attachments:
        return [attachments]
    return []


def classify_topics(text: str, urls: tuple[str, ...]) -> list[str]:
    haystack = " ".join([text, *urls]).casefold()
    topics = ["x-likes"]
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(keyword.casefold() in haystack for keyword in keywords):
            topics.append(topic)
    return sorted(set(topics))


def risk_level(text: str, sensitive: bool) -> str:
    folded = text.casefold()
    if sensitive or any(word.casefold() in folded for word in RISK_HIGH):
        return "高"
    if any(word.casefold() in folded for word in RISK_MEDIUM):
        return "中"
    return "低"


def source_domain(urls: tuple[str, ...], fallback: str) -> str:
    candidates = list(urls) + [fallback]
    for url in candidates:
        parsed = urlparse(url)
        if parsed.netloc:
            return parsed.netloc.lower()
    return ""


def summarize(item: LikeItem) -> str:
    text = re.sub(r"\s+", " ", item.text).strip()
    if len(text) > 180:
        text = text[:177] + "..."
    topic_text = "、".join(topic for topic in item.topics if topic != "x-likes") or "未归类"
    return f"这条 X Like 属于 {topic_text}。原文核心信息是：{text}"


def usable_actions(item: LikeItem) -> list[str]:
    actions = []
    topics = set(item.topics)
    if topics & {"wechat-official-account", "content-matrix", "creator-monetization"}:
        actions.append("可改写成公众号文章或内容矩阵 SOP")
    if topics & {"article-to-video", "short-video", "xiaohongshu"}:
        actions.append("可拆成短视频脚本或文章转视频工具评测")
    if topics & {"github-tool", "multi-platform-publishing", "automation"}:
        actions.append("可进入 Cyberstore 工具评测或自动化方案")
    if topics & {"agent-workflow", "hermes-agent", "mcp-skill", "personal-wiki"}:
        actions.append("可整理成 Hermes Agent / Skill 工作流笔记")
    return actions or ["先保留为可检索来源，后续按主题页再判断转化方式"]


def render_like_note(item: LikeItem) -> str:
    actions = "\n".join(f"- {action}" for action in usable_actions(item))
    tags = "\n".join(f"- {tag}" for tag in item.topics)
    external = "\n".join(f"- {url}" for url in item.external_urls) or "- 无"
    media = json.dumps(list(item.media), ensure_ascii=False, indent=2) if item.media else "[]"
    raw = json.dumps(item.raw, ensure_ascii=False, indent=2, sort_keys=True)
    return f"""# X Like - @{item.author_handle or 'unknown'} - {item.tweet_id}

## 结论
{summarize(item)}

## 原始来源
- 平台：X
- 作者：@{item.author_handle or 'unknown'} {item.author_name}
- tweet_id：{item.tweet_id}
- 链接：{item.url}
- 抓取时间：{item.collected_at}

## 摘要
{summarize(item)}

## 可用法
{actions}

## 标签
{tags}

## 风险判断
- 风险等级：{item.risk_level}
- 判断：是否涉及灰产、擦边、版权、搬运、未验证收益，需要在转化前复核。

## 后续动作
- 是否需要追外链：{"是" if item.external_urls else "否"}
- 是否需要截图/OCR：{"是" if item.media else "否"}
- 是否需要写成文章：{"是" if set(item.topics) & {"wechat-official-account", "content-matrix", "creator-monetization"} else "待判断"}
- 是否需要做工具实测：{"是" if set(item.topics) & {"github-tool", "multi-platform-publishing", "article-to-video"} else "待判断"}

## 外链
{external}

## 媒体信息
```json
{media}
```

## 原文
{item.text}

## 原始 JSON source
```json
{raw}
```
"""


def render_theme_note(title: str, tags: list[str], keywords: list[str], items: list[LikeItem]) -> str:
    matched = [item for item in items if set(item.topics) & set(tags)]
    core = theme_core_judgement(title, matched)
    reps = []
    for index, item in enumerate(matched[:12], start=1):
        reps.append(
            f"""### {index}. @{item.author_handle or 'unknown'} / {item.tweet_id}
- 链接：{item.url}
- 摘要：{summarize(item)}
- 可用法：{"；".join(usable_actions(item))}
- 风险：{item.risk_level}
- 后续动作：{"追外链" if item.external_urls else "进入主题池"}"""
        )
    representative = "\n\n".join(reps) if reps else "暂无代表帖。"
    topics = "\n".join(f"- {keyword}" for keyword in keywords)
    related = "\n".join(f"- [[{keyword}]]" for keyword in keywords)
    tools = "\n".join(f"- {tool}" for tool in inferred_tools(matched)) or "- 暂无"
    return f"""# {title}

## 核心判断
{core}

## 主题地图
{topics}

## 代表帖
{representative}

## 可转化选题
- 《X Likes 里值得沉淀的{keywords[0]}方法论》
- 《从收藏到生产线：如何把{keywords[0]}素材转成公众号/视频选题》
- 《这些工具是否值得接入个人内容矩阵？》

## 相关工具
{tools}

## 相关概念
{related}
"""


def theme_core_judgement(title: str, items: list[LikeItem]) -> str:
    if not items:
        return "当前原始 Likes 中还没有匹配到足够材料；保留主题入口，等待下一轮同步补齐。"
    risk_counts = {level: sum(1 for item in items if item.risk_level == level) for level in ("低", "中", "高")}
    return (
        f"本主题从 X Likes 中归集到 {len(items)} 条材料。"
        f"风险分布：低 {risk_counts['低']} / 中 {risk_counts['中']} / 高 {risk_counts['高']}。"
        "优先把低风险工具、流程和案例转成可验证选题；涉及收益、搬运或多账号策略的内容先复核。"
    )


def inferred_tools(items: list[LikeItem]) -> list[str]:
    known = ["wechat-publish-template", "MultiPost", "Remotion", "CapCut", "剪映", "MCP", "GitHub"]
    haystack = "\n".join(item.text for item in items).casefold()
    return [tool for tool in known if tool.casefold() in haystack]


def build_payloads(items: list[LikeItem]) -> list[NotePayload]:
    payloads: list[NotePayload] = []
    for item in items:
        title_text = item.text.splitlines()[0][:48]
        title = f"X Like - @{item.author_handle or 'unknown'} - {title_text}"
        payloads.append(
            NotePayload(
                title=title,
                frontmatter={
                    "title": title,
                    "type": "source",
                    "created_by": "user",
                    "source_type": "x-like",
                    "tags": list(item.topics),
                    "created_at": item.created_at,
                    "source_url": item.url,
                    "canonical_url": item.url,
                    "tweet_id": item.tweet_id,
                    "tweet_thread_id": str(item.raw.get("conversation_id") or item.raw.get("raw", {}).get("conversation_id") or ""),
                    "author_handle": item.author_handle,
                    "author_name": item.author_name,
                    "collected_at": item.collected_at,
                    "summary": summarize(item),
                    "risk_level": item.risk_level,
                    "external_urls": list(item.external_urls),
                    "media": list(item.media),
                    "source_domain": source_domain(item.external_urls, item.url),
                    "text_hash": item.text_hash,
                    "source_hash": hashlib.sha256(json.dumps(item.raw, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16],
                },
                content=render_like_note(item),
                obsidian_relpath=Path("X Likes") / "来源页" / f"{item.tweet_id}.md",
            )
        )
    for title, tags, keywords in THEME_SPECS:
        matched = [item for item in items if set(item.topics) & set(tags)]
        payloads.append(
            NotePayload(
                title=title,
                frontmatter={
                    "title": title,
                    "type": "atom",
                    "created_by": "user",
                    "source_type": "x-likes-theme",
                    "tags": sorted(set(["x-likes", *tags])),
                    "created_at": utc_now(),
                    "summary": theme_core_judgement(title, matched),
                    "source_domain": "x.com",
                    "text_hash": text_hash(title + "\n" + "\n".join(item.tweet_id for item in matched)),
                },
                content=render_theme_note(title, tags, keywords, items),
                obsidian_relpath=Path("X Likes") / "主题整理" / f"{slugify(title)}.md",
            )
        )
    return payloads


def write_obsidian(payloads: list[NotePayload], inbox: Path) -> int:
    count = 0
    for payload in payloads:
        target = inbox / payload.obsidian_relpath
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render_obsidian_document(payload), encoding="utf-8")
        count += 1
    return count


def render_obsidian_document(payload: NotePayload) -> str:
    frontmatter = json.dumps(payload.frontmatter, ensure_ascii=False, indent=2)
    return f"---\nsource: x-likes-knowledge-pipeline\nfrontmatter_json: |\n{indent(frontmatter, '  ')}\n---\n\n{payload.content.rstrip()}\n"


def indent(text: str, prefix: str) -> str:
    return "\n".join(prefix + line for line in text.splitlines())


def post_ingest(wiki_url: str, token: str, payload: NotePayload) -> tuple[str, str]:
    body = json.dumps({"frontmatter": payload.frontmatter, "content": payload.content}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{wiki_url.rstrip('/')}/api/ingest",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    return str(data.get("status") or response.status), str(data.get("path") or "")


def load_server(repo_root: Path, data_dir: Path):
    os.environ["WIKI_DATA_DIR"] = str(data_dir.resolve())
    api_dir = repo_root / "personal-wiki" / "api"
    if str(api_dir) not in sys.path:
        sys.path.insert(0, str(api_dir))
    server_path = api_dir / "server.py"
    spec = importlib.util.spec_from_file_location("personal_wiki_server", server_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load server module from {server_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def local_ingest(server: Any, payload: NotePayload) -> tuple[str, str]:
    result = server.ingest_payload({"frontmatter": payload.frontmatter, "content": payload.content})
    return str(result.get("status") or ""), str(result.get("path") or "")


def send_telegram(report: str) -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        return
    body = urlencode({"chat_id": chat_id, "text": report}).encode("utf-8")
    request = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=body, method="POST")
    urllib.request.urlopen(request, timeout=15).read()


def report_text(total: int, obsidian_count: int, wiki_status: dict[str, int], keyword_counts: dict[str, int]) -> str:
    checks = "\n".join(f"- {keyword}：命中 {count} 条" for keyword, count in keyword_counts.items())
    status = ", ".join(f"{key}={value}" for key, value in sorted(wiki_status.items())) or "skipped"
    return f"""X Likes 知识化完成

新增/处理 Likes：{total} 条
更新主题页：{len(THEME_SPECS)} 篇
同步 Obsidian：{obsidian_count} 篇
同步 6.28 Wiki：{status}
搜索验收：
{checks}
"""


def local_keyword_counts(payloads: list[NotePayload], keywords: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for keyword in keywords:
        folded = keyword.casefold()
        counts[keyword] = sum(
            1
            for payload in payloads
            if folded in (payload.title + "\n" + payload.content + "\n" + " ".join(payload.frontmatter.get("tags", []))).casefold()
        )
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description="Turn X Likes into Obsidian notes and Personal Wiki ingest payloads.")
    parser.add_argument("--input", action="append", type=Path, default=[], help="JSONL/JSON/CSV/SQLite file or directory. Can be repeated.")
    parser.add_argument("--obsidian-inbox", type=Path, default=Path(os.environ.get("OBSIDIAN_X_LIKES_INBOX", DEFAULT_OBSIDIAN_INBOX)))
    parser.add_argument("--wiki-url", default=os.environ.get("PERSONAL_WIKI_URL", DEFAULT_WIKI_URL))
    parser.add_argument("--wiki-token", default=os.environ.get("WIKI_API_TOKEN", ""))
    parser.add_argument("--wiki-mode", choices=["auto", "http", "local", "none"], default="auto")
    parser.add_argument("--wiki-data-dir", type=Path, default=Path(os.environ.get("WIKI_DATA_DIR", "")) if os.environ.get("WIKI_DATA_DIR") else None)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--report-json", type=Path)
    args = parser.parse_args()

    inputs = discover_inputs(args.input)
    if not inputs:
        print("no X Likes input found", file=sys.stderr)
        return 2

    records = load_records(inputs)
    items = [item for record in records if (item := normalize_record(record))]
    items.sort(key=lambda item: item.created_at, reverse=True)
    if args.limit:
        items = items[: args.limit]
    payloads = build_payloads(items)

    obsidian_count = 0
    wiki_status: dict[str, int] = {}
    if not args.dry_run:
        obsidian_count = write_obsidian(payloads, args.obsidian_inbox)
        mode = args.wiki_mode
        if mode == "auto":
            mode = "http" if args.wiki_token else "none"
        server = None
        if mode == "local":
            if not args.wiki_data_dir:
                print("--wiki-data-dir is required for --wiki-mode local", file=sys.stderr)
                return 2
            server = load_server(args.repo_root.resolve(), args.wiki_data_dir.resolve())
        for payload in payloads:
            if mode == "http":
                if not args.wiki_token:
                    print("--wiki-token or WIKI_API_TOKEN is required for --wiki-mode http", file=sys.stderr)
                    return 2
                try:
                    status, _path = post_ingest(args.wiki_url, args.wiki_token, payload)
                except urllib.error.HTTPError as error:
                    detail = error.read().decode("utf-8", errors="replace")
                    raise RuntimeError(f"wiki ingest failed: {error.code} {detail}") from error
            elif mode == "local":
                status, _path = local_ingest(server, payload)
            else:
                status = "skipped"
            wiki_status[status] = wiki_status.get(status, 0) + 1

    keyword_counts = local_keyword_counts(payloads, DEFAULT_KEYWORDS)
    report = report_text(len(items), obsidian_count, wiki_status, keyword_counts)
    print(report)
    if args.report_json:
        args.report_json.parent.mkdir(parents=True, exist_ok=True)
        args.report_json.write_text(
            json.dumps(
                {
                    "inputs": [str(path) for path in inputs],
                    "likes": len(items),
                    "payloads": len(payloads),
                    "obsidian_count": obsidian_count,
                    "wiki_status": wiki_status,
                    "keyword_counts": keyword_counts,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    if not args.dry_run:
        send_telegram(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
