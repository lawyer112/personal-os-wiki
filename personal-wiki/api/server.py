#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import html
import json
import os
import re
import shutil
import subprocess
import sys
import traceback
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlencode, urlparse

try:
    import yaml
except ImportError:  # pragma: no cover - optional dependency on the bare Python deploy
    yaml = None


DATA_DIR = Path(os.environ.get("WIKI_DATA_DIR", "/data")).resolve()
HOST = os.environ.get("WIKI_HOST", "0.0.0.0")
PORT = int(os.environ.get("WIKI_PORT", "3422"))
API_TOKEN = os.environ.get("WIKI_API_TOKEN", "")
READ_TOKEN = os.environ.get("WIKI_READ_TOKEN", "")
SITE_TITLE = os.environ.get("WIKI_SITE_TITLE", "我的知识手册")
APP_DIR = Path(__file__).resolve().parents[1]

VAULT_DIR = DATA_DIR / "vault"
SOURCES_DIR = VAULT_DIR / "10_sources"
NOTES_DIR = VAULT_DIR / "20_notes"
ARCHIVE_DIR = VAULT_DIR / "90_archive"
PUBLIC_DIR = DATA_DIR / "public"
MANUAL_PATH = APP_DIR / "docs" / "USAGE.md"
GRAPH_PATH = PUBLIC_DIR / "graph-data.json"
NOTE_INDEX_PATH = PUBLIC_DIR / "note-index.json"
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
INTERNAL_NOTE_FIELDS = {"search_text"}

SLUG_RE = re.compile(r"[^a-zA-Z0-9\u4e00-\u9fff]+")
WIKILINK_RE = re.compile(r"\[\[([^\]\|#]+)(?:[|#][^\]]*)?\]\]")
WIKILINK_RENDER_RE = re.compile(r"\[\[([^\]\|#]+)(?:#[^\]\|]+)?(?:\|([^\]]+))?\]\]")
MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
TAG_RE = re.compile(r"(?<!\w)#([\w\u4e00-\u9fff-]+)")
SAFE_MARKDOWN_SCHEMES = {"http", "https", "mailto"}


def env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


REQUIRE_API_READ_AUTH = env_flag("WIKI_REQUIRE_API_READ_AUTH", bool(API_TOKEN or READ_TOKEN))
REQUIRE_PAGE_READ_AUTH = env_flag("WIKI_REQUIRE_PAGE_READ_AUTH", bool(API_TOKEN or READ_TOKEN))
ALLOW_UNAUTHENTICATED_WRITE = env_flag("WIKI_ALLOW_UNAUTHENTICATED_WRITE", False)
READ_AUTH_COOKIE = "personal_wiki_read"


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def ensure_dirs() -> None:
    for path in (DATA_DIR, VAULT_DIR, SOURCES_DIR, NOTES_DIR, ARCHIVE_DIR, PUBLIC_DIR):
        path.mkdir(parents=True, exist_ok=True)
    init_git()


def run(cmd: list[str], cwd: Path = DATA_DIR, check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd),
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=check,
    )


def init_git() -> None:
    if not shutil.which("git"):
        return
    if not (DATA_DIR / ".git").exists():
        run(["git", "init"])
        run(["git", "config", "user.name", "Hermes Wiki Bot"])
        run(["git", "config", "user.email", "hermes-wiki@local"])


def git_commit(message: str) -> str:
    if not shutil.which("git") or not (DATA_DIR / ".git").exists():
        return "git unavailable"
    run(["git", "add", "vault", "public"])
    diff = run(["git", "diff", "--cached", "--quiet"])
    if diff.returncode == 0:
        return "no changes"
    result = run(["git", "commit", "-m", message])
    if result.returncode != 0:
        return result.stderr.strip() or "git commit failed"
    return result.stdout.strip()


def slugify(value: str, fallback: str) -> str:
    clean = SLUG_RE.sub("-", value.strip()).strip("-").lower()
    clean = re.sub(r"-{2,}", "-", clean)
    return clean[:80] or fallback


def frontmatter_value(value: Any) -> str:
    if isinstance(value, list):
        return "[" + ", ".join(json.dumps(str(item), ensure_ascii=False) for item in value) + "]"
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False)
    if value is None:
        return '""'
    return json.dumps(str(value), ensure_ascii=False)


def normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    content = str(payload.get("content") or payload.get("text") or "").strip()
    title = str(payload.get("title") or "").strip()
    source_url = str(payload.get("source_url") or payload.get("url") or "").strip()
    source_type = str(payload.get("source_type") or payload.get("type") or "inbox").strip()
    tags = payload.get("tags") or []
    if isinstance(tags, str):
        tags = [part.strip() for part in tags.split(",") if part.strip()]
    if not isinstance(tags, list):
        tags = []
    metadata = payload.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {"raw": metadata}

    if not content and source_url:
        content = source_url
    if not title:
        title = first_heading(content) or source_url or "Untitled source"

    return {
        "title": title[:180],
        "content": content,
        "source_url": source_url,
        "source_type": source_type[:80] or "inbox",
        "tags": sorted({str(tag).strip().lstrip("#") for tag in tags if str(tag).strip()}),
        "metadata": metadata,
    }


def first_heading(content: str) -> str:
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("#"):
            return line.lstrip("#").strip()
        if line:
            return line[:80]
    return ""


def ingest(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_dirs()
    item = normalize_payload(payload)
    created = now_utc()
    date_dir = created.strftime("%Y-%m-%d")
    source_hash = hashlib.sha256(
        json.dumps(item, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:16]

    source_dir = SOURCES_DIR / date_dir
    note_dir = NOTES_DIR / date_dir
    source_dir.mkdir(parents=True, exist_ok=True)
    note_dir.mkdir(parents=True, exist_ok=True)

    existing_note = find_note_by_source_hash(source_hash)
    if existing_note:
        return {
            "status": "duplicate",
            "source_hash": source_hash,
            "source_path": rel(find_source_by_hash(source_hash) or (source_dir / f"{source_hash}.json")),
            "note_path": rel(existing_note),
            "url": f"/note?path={quote(rel(existing_note), safe='/')}",
        }

    source_path = find_source_by_hash(source_hash) or (source_dir / f"{source_hash}.json")
    slug = slugify(item["title"], source_hash)
    note_path = unique_path(note_dir / f"{slug}.md")
    note_id = note_path.stem

    status = "created"
    if source_path.exists():
        status = "restored"
        try:
            source_record = json.loads(source_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            source_record = {"id": source_hash, "payload": item}
        history = source_record.get("history")
        if not isinstance(history, list):
            history = []
        history.append({"event": "restored", "at": created.isoformat(), "note_path": rel(note_path)})
        source_record["history"] = history
    else:
        source_record = {
            "id": source_hash,
            "created_at": created.isoformat(),
            "payload": item,
        }
    source_record["note_path"] = rel(note_path)
    source_record["last_ingested_at"] = created.isoformat()
    write_json(source_path, source_record)
    note = render_markdown(item, source_hash, created)
    note_path.write_text(note, encoding="utf-8")

    public = refresh_public_indexes()
    commit_status = git_commit(f"ingest: {item['title'][:60]}")

    return {
        "status": status,
        "id": note_id,
        "title": item["title"],
        "source_hash": source_hash,
        "source_path": rel(source_path),
        "note_path": rel(note_path),
        "url": f"/note?path={quote(rel(note_path), safe='/')}",
        "graph_nodes": len(public["graph"]["nodes"]),
        "graph_links": len(public["graph"]["links"]),
        "git": commit_status,
    }


def find_note_by_source_hash(source_hash: str) -> Path | None:
    marker = f"source_hash: {source_hash}"
    for path in NOTES_DIR.rglob("*.md"):
        try:
            if marker in path.read_text(encoding="utf-8"):
                return path
        except UnicodeDecodeError:
                continue
    return None


def find_source_by_hash(source_hash: str) -> Path | None:
    for path in sorted(SOURCES_DIR.rglob(f"{source_hash}.json")):
        return path
    return None


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    base = path.with_suffix("")
    suffix = path.suffix
    for index in range(2, 1000):
        candidate = Path(f"{base}-{index}{suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError(f"Cannot find unique path for {path}")


def render_markdown(item: dict[str, Any], source_hash: str, created: dt.datetime) -> str:
    tags = sorted(set(item["tags"] + [item["source_type"], "auto-ingested"]))
    fm = {
        "title": item["title"],
        "created": created.isoformat(),
        "source_type": item["source_type"],
        "source_url": item["source_url"],
        "source_hash": source_hash,
        "tags": tags,
        "status": "auto",
    }
    content = item["content"].strip()
    if not content:
        content = "_No body content was provided._"

    return render_note_document(item["title"], content, fm)


def render_note_document(title: str, content: str, fm: dict[str, Any]) -> str:
    frontmatter = ["---"]
    for key, value in fm.items():
        frontmatter.append(f"{key}: {frontmatter_value(value)}")
    frontmatter.append("---")

    clean_content = content.strip() or "_No body content was provided._"
    if re.match(r"(?m)^#\s+", clean_content):
        body = clean_content
    else:
        body = f"# {title}\n\n{clean_content}"
    return "\n".join(frontmatter) + "\n\n" + body.strip() + "\n"


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text
    raw_text = text[4:end]
    body = text[end + 5 :]
    if yaml is not None:
        try:
            loaded = yaml.safe_load(raw_text) or {}
            if isinstance(loaded, dict):
                return loaded, body
        except Exception:
            pass
    return parse_frontmatter_fallback(raw_text.splitlines()), body


def parse_frontmatter_fallback(raw: list[str]) -> dict[str, Any]:
    data: dict[str, Any] = {}
    current_key = ""
    for line in raw:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if current_key and (line.startswith(" ") or line.startswith("\t") or stripped.startswith("-")):
            if stripped.startswith("-"):
                current = data.setdefault(current_key, [])
                if not isinstance(current, list):
                    current = []
                    data[current_key] = current
                current.append(parse_frontmatter_scalar(stripped[1:].strip()))
            continue
        if ":" not in line:
            current_key = ""
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            current_key = ""
            continue
        if value == "":
            data[key] = []
            current_key = key
            continue
        data[key] = parse_frontmatter_scalar(value)
        current_key = key if isinstance(data[key], list) else ""
    return data


def parse_frontmatter_scalar(value: str) -> Any:
    if value.startswith("[") and value.endswith("]"):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else [parsed]
        except json.JSONDecodeError:
            return [value]
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value.strip('"').strip("'")


def note_title(path: Path, text: str, fm: dict[str, Any]) -> str:
    if fm.get("title"):
        return str(fm["title"])
    heading = first_heading(text)
    return heading or path.stem


def note_sort_value(value: Any) -> float:
    raw = str(value or "").strip()
    if not raw:
        return 0
    try:
        return dt.datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0


def extract_concepts(body: str) -> list[str]:
    return sorted({concept.strip() for concept in WIKILINK_RE.findall(body) if concept.strip()})


def read_note_records(include_body: bool = False) -> list[dict[str, Any]]:
    ensure_dirs_no_git()
    records: list[dict[str, Any]] = []
    for path in sorted(NOTES_DIR.rglob("*.md"), reverse=True):
        text = path.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(text)
        title = note_title(path, body, fm)
        tags = normalize_tags(fm.get("tags", []))
        record = {
            "title": title,
            "path": rel(path),
            "created": format_date(fm.get("created", "")),
            "created_sort": note_sort_value(fm.get("created", "")),
            "source_type": str(fm.get("source_type", "") or ""),
            "source_url": str(fm.get("source_url", "") or ""),
            "source_hash": str(fm.get("source_hash", "") or ""),
            "status": str(fm.get("status", "") or ""),
            "tags": tags,
            "concepts": extract_concepts(body),
            "excerpt": plain_excerpt(body),
            "search_text": plain_search_text(body),
        }
        if include_body:
            record["body"] = body
        records.append(record)
    records.sort(key=lambda item: item.get("created_sort", 0), reverse=True)
    return records


def build_facets(records: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for record in records:
        values = record.get(key) or []
        if isinstance(values, str):
            values = [values]
        for value in values:
            label = str(value).strip()
            if label:
                counts[label] = counts.get(label, 0) + 1
    return [
        {"name": name, "count": count}
        for name, count in sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))
    ]


def build_note_index(records: list[dict[str, Any]]) -> dict[str, Any]:
    public_notes = [{key: value for key, value in record.items() if key != "body"} for record in records]
    return {
        "generated_at": now_utc().isoformat(),
        "vault_signature": vault_signature(),
        "count": len(public_notes),
        "notes": public_notes,
        "tags": build_facets(public_notes, "tags"),
        "concepts": build_facets(public_notes, "concepts"),
        "source_types": build_facets(public_notes, "source_type"),
    }


def build_note_lookup(index: dict[str, Any]) -> dict[str, str]:
    lookup: dict[str, str] = {}

    def remember(key: str, path: str) -> None:
        if not key:
            return
        existing = lookup.get(key)
        if existing and existing != path:
            lookup[key] = ""
            return
        if existing == "":
            return
        lookup[key] = path

    for note in index.get("notes", []):
        title = str(note.get("title", "")).strip()
        path = str(note.get("path", "")).strip()
        if not path:
            continue
        for key in (title, Path(path).stem, title.casefold(), Path(path).stem.casefold()):
            remember(key, path)
    return lookup


def vault_signature() -> str:
    digest = hashlib.sha256()
    if not NOTES_DIR.exists():
        return digest.hexdigest()
    for path in sorted(NOTES_DIR.rglob("*.md")):
        try:
            stat = path.stat()
        except OSError:
            continue
        digest.update(rel(path).encode("utf-8", errors="replace"))
        digest.update(str(stat.st_mtime_ns).encode("ascii"))
        digest.update(str(stat.st_size).encode("ascii"))
    return digest.hexdigest()


def refresh_public_indexes() -> dict[str, Any]:
    records = read_note_records(include_body=True)
    index = build_note_index(records)
    graph = build_graph_from_records(records)
    write_json(NOTE_INDEX_PATH, index)
    write_json(GRAPH_PATH, graph)
    return {"index": index, "graph": graph}


def load_note_index() -> dict[str, Any]:
    ensure_dirs_no_git()
    if not NOTE_INDEX_PATH.exists() or not GRAPH_PATH.exists():
        return refresh_public_indexes()["index"]
    try:
        index = json.loads(NOTE_INDEX_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return refresh_public_indexes()["index"]
    if index.get("vault_signature") != vault_signature():
        return refresh_public_indexes()["index"]
    return index


def load_graph() -> dict[str, Any]:
    ensure_dirs_no_git()
    if not GRAPH_PATH.exists() or not NOTE_INDEX_PATH.exists():
        return refresh_public_indexes()["graph"]
    try:
        graph = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return refresh_public_indexes()["graph"]
    if graph.get("vault_signature") != vault_signature():
        return refresh_public_indexes()["graph"]
    return graph


def filtered_notes(
    query: str = "",
    tag: str = "",
    concept: str = "",
    source_type: str = "",
) -> list[dict[str, Any]]:
    index = load_note_index()
    notes = list(index.get("notes", []))
    q = query.strip().lower()
    tag = tag.strip().lstrip("#")
    concept = concept.strip()
    source_type = source_type.strip()

    def matches(note: dict[str, Any]) -> bool:
        if tag and tag not in [str(item) for item in note.get("tags", [])]:
            return False
        if concept and concept not in [str(item) for item in note.get("concepts", [])]:
            return False
        if source_type and source_type != str(note.get("source_type", "")):
            return False
        if q:
            haystack = " ".join(
                [
                    str(note.get("title", "")),
                    str(note.get("excerpt", "")),
                    str(note.get("search_text", "")),
                    " ".join(str(item) for item in note.get("tags", [])),
                    " ".join(str(item) for item in note.get("concepts", [])),
                    str(note.get("source_type", "")),
                ]
            ).lower()
            return q in haystack
        return True

    return [public_note(note) for note in notes if matches(note)]


def parse_positive_int(value: str, default: int, maximum: int | None = None) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    parsed = max(1, parsed)
    if maximum:
        parsed = min(maximum, parsed)
    return parsed


def paginate(notes: list[dict[str, Any]], page: int, page_size: int) -> dict[str, Any]:
    total = len(notes)
    page_count = max(1, (total + page_size - 1) // page_size)
    page = min(max(1, page), page_count)
    start = (page - 1) * page_size
    return {
        "notes": notes[start : start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "page_count": page_count,
    }


def build_graph() -> dict[str, Any]:
    return build_graph_from_records(read_note_records(include_body=True))


def build_graph_from_records(records: list[dict[str, Any]]) -> dict[str, Any]:
    nodes: dict[str, dict[str, Any]] = {}
    link_keys: set[tuple[str, str, str]] = set()
    links: list[dict[str, Any]] = []
    title_to_id: dict[str, str] = {}

    def remember_title(key: str, node_id: str) -> None:
        if not key:
            return
        existing = title_to_id.get(key)
        if existing and existing != node_id:
            title_to_id[key] = ""
            return
        if existing == "":
            return
        title_to_id[key] = node_id

    for record in records:
        title = str(record.get("title", ""))
        node_id = str(record.get("path", ""))
        body = str(record.get("body", ""))
        tags = list(record.get("tags", []))
        nodes[node_id] = {
            "id": node_id,
            "label": title,
            "title": title,
            "path": node_id,
            "url": f"/note?path={quote(node_id, safe='/')}",
            "tags": tags,
            "source_type": record.get("source_type", ""),
            "kind": "note",
            "weight": max(1, len(WIKILINK_RE.findall(body)) + len(tags)),
        }
        remember_title(title, node_id)
        remember_title(Path(node_id).stem, node_id)

    for record in records:
        body = str(record.get("body", ""))
        source_id = str(record.get("path", ""))
        for target_title in WIKILINK_RE.findall(body):
            concept = target_title.strip()
            target_id = title_to_id.get(concept)
            if not target_id:
                target_id = f"concept:{concept}"
                if target_id not in nodes:
                    nodes[target_id] = {
                        "id": target_id,
                        "label": concept,
                        "title": concept,
                        "path": "",
                        "url": f"/notes?concept={quote(concept)}",
                        "tags": ["concept"],
                        "source_type": "concept",
                        "kind": "concept",
                        "weight": 3,
                    }
            add_link(links, link_keys, source_id, target_id, "wikilink", 2)
        fm_tags = record.get("tags") if isinstance(record.get("tags"), list) else []
        body_tags = TAG_RE.findall(body)
        for tag in sorted({str(tag).strip().lstrip("#") for tag in list(fm_tags) + body_tags if str(tag).strip()}):
            tag_id = f"tag:{tag}"
            if tag_id not in nodes:
                nodes[tag_id] = {
                    "id": tag_id,
                    "label": f"#{tag}",
                    "title": f"#{tag}",
                    "path": "",
                    "url": f"/notes?tag={quote(tag)}",
                    "tags": ["tag"],
                    "source_type": "tag",
                    "kind": "tag",
                    "weight": 2,
                }
            add_link(links, link_keys, source_id, tag_id, "tag", 1)

    return {
        "generated_at": now_utc().isoformat(),
        "vault_signature": vault_signature(),
        "nodes": list(nodes.values()),
        "links": links,
    }


def add_link(
    links: list[dict[str, Any]],
    link_keys: set[tuple[str, str, str]],
    source: str,
    target: str,
    link_type: str,
    weight: int,
) -> None:
    key = (source, target, link_type)
    if source == target or key in link_keys:
        return
    link_keys.add(key)
    links.append({"source": source, "target": target, "type": link_type, "weight": weight})


def ensure_dirs_no_git() -> None:
    for path in (DATA_DIR, VAULT_DIR, SOURCES_DIR, NOTES_DIR, ARCHIVE_DIR, PUBLIC_DIR):
        path.mkdir(parents=True, exist_ok=True)


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(DATA_DIR)).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def safe_data_path(relative: str) -> Path:
    candidate = (DATA_DIR / relative).resolve()
    if DATA_DIR not in candidate.parents and candidate != DATA_DIR:
        raise ValueError("Path is outside data directory")
    return candidate


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def public_note(note: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in note.items() if key not in INTERNAL_NOTE_FIELDS}


def list_notes() -> list[dict[str, Any]]:
    return [public_note(note) for note in load_note_index().get("notes", [])]


def format_date(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    try:
        parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return raw[:16]


def notes_section(body: str) -> str:
    match = re.search(r"(?is)^## Notes\s*(.*?)(?:^## Tags\s*|\\Z)", body, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return body.strip()


def plain_excerpt(body: str, limit: int = 190) -> str:
    text = notes_section(body)
    text = WIKILINK_RE.sub(r"\1", text)
    text = TAG_RE.sub("", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"(?m)^#+\s*", "", text)
    text = re.sub(r"(?m)^[-*]\s*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return (text[: max(0, limit - 3)] + "...") if len(text) > limit else text


def plain_search_text(body: str) -> str:
    text = WIKILINK_RE.sub(r"\1", body)
    text = TAG_RE.sub("", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"(?m)^#+\s*", "", text)
    text = re.sub(r"(?m)^[-*]\s*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text.lower()


def rebuild() -> dict[str, Any]:
    ensure_dirs()
    public = refresh_public_indexes()
    commit_status = git_commit("rebuild: graph data")
    graph = public["graph"]
    index = public["index"]
    return {
        "status": "rebuilt",
        "notes": index["count"],
        "graph_nodes": len(graph["nodes"]),
        "graph_links": len(graph["links"]),
        "git": commit_status,
    }


def read_note(relative_path: str) -> dict[str, Any]:
    path = safe_data_path(relative_path)
    if not path.exists() or path.suffix != ".md":
        raise FileNotFoundError(relative_path)
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)
    return {
        "path": rel(path),
        "frontmatter": fm,
        "title": note_title(path, body, fm),
        "content": notes_section(body),
        "raw_body": body,
    }


def normalize_tags(value: Any) -> list[str]:
    if isinstance(value, str):
        value = [part.strip().lstrip("#") for part in value.split(",") if part.strip()]
    if not isinstance(value, list):
        return []
    return sorted({str(tag).strip().lstrip("#") for tag in value if str(tag).strip()})


def payload_text(payload: dict[str, Any], keys: tuple[str, ...], default: str) -> str:
    for key in keys:
        if key in payload:
            return str(payload.get(key) or "").strip()
    return default


def update_note(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_dirs()
    relative_path = str(payload.get("path") or "").strip()
    note = read_note(relative_path)
    path = safe_data_path(relative_path)
    fm = dict(note["frontmatter"])
    title = str(payload.get("title") or note["title"]).strip() or "Untitled source"
    has_body_update = "content" in payload or "body" in payload
    content = payload_text(payload, ("content", "body"), str(note["raw_body"]) if not has_body_update else str(note["content"]))
    tags = payload.get("tags", fm.get("tags", []))
    fm["title"] = title
    fm["tags"] = normalize_tags(tags)
    fm["updated"] = now_utc().isoformat()
    path.write_text(render_note_document(title, content, fm), encoding="utf-8")
    public = refresh_public_indexes()
    commit_status = git_commit(f"update: {title[:60]}")
    return {
        "status": "updated",
        "path": rel(path),
        "url": f"/note?path={quote(rel(path), safe='/')}",
        "notes": public["index"]["count"],
        "git": commit_status,
    }


def tag_note(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_dirs()
    relative_path = str(payload.get("path") or "").strip()
    note = read_note(relative_path)
    path = safe_data_path(relative_path)
    fm = dict(note["frontmatter"])
    current = set(normalize_tags(fm.get("tags", [])))
    if "tags" in payload or "set" in payload:
        current = set(normalize_tags(payload.get("tags", payload.get("set", []))))
    for tag in normalize_tags(payload.get("add", [])):
        current.add(tag)
    for tag in normalize_tags(payload.get("remove", [])):
        current.discard(tag)
    fm["tags"] = sorted(current)
    fm["updated"] = now_utc().isoformat()
    title = str(fm.get("title") or note["title"]).strip() or "Untitled source"
    path.write_text(render_note_document(title, str(note["raw_body"]).strip(), fm), encoding="utf-8")
    public = refresh_public_indexes()
    commit_status = git_commit(f"tag: {title[:60]}")
    return {
        "status": "tagged",
        "path": rel(path),
        "tags": fm["tags"],
        "notes": public["index"]["count"],
        "git": commit_status,
    }


def split_frontmatter_text(text: str) -> tuple[str, str]:
    if not text.startswith("---\n"):
        return "", text
    end = text.find("\n---\n", 4)
    if end == -1:
        return "", text
    return text[: end + 5], text[end + 5 :]


def replace_wikilink_target(body: str, old: str, new: str) -> tuple[str, int]:
    count = 0

    def replacement(match: re.Match[str]) -> str:
        nonlocal count
        target = match.group(1).strip()
        suffix = match.group(2) or ""
        if target != old:
            return match.group(0)
        count += 1
        return f"[[{new}{suffix}]]"

    return re.sub(r"\[\[([^\]\|#]+)((?:[|#][^\]]*)?)\]\]", replacement, body), count


def relink_notes(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_dirs()
    old = str(payload.get("from") or payload.get("old") or payload.get("source") or "").strip()
    new = str(payload.get("to") or payload.get("new") or payload.get("target") or "").strip()
    if not old or not new:
        raise ValueError("from/to are required")
    if "[[" in new or "]]" in new:
        raise ValueError("new target must be a wiki-link title, not a full [[link]]")

    changed: list[dict[str, Any]] = []
    replacements = 0
    for path in sorted(NOTES_DIR.rglob("*.md")):
        text = path.read_text(encoding="utf-8")
        prefix, body = split_frontmatter_text(text)
        next_body, count = replace_wikilink_target(body, old, new)
        if count <= 0:
            continue
        path.write_text(prefix + next_body, encoding="utf-8")
        replacements += count
        changed.append({"path": rel(path), "replacements": count})

    public = refresh_public_indexes()
    commit_status = git_commit(f"relink: {old[:30]} -> {new[:30]}")
    return {
        "status": "relinked",
        "from": old,
        "to": new,
        "changed": changed,
        "replacements": replacements,
        "notes": public["index"]["count"],
        "git": commit_status,
    }


def archive_note(payload: dict[str, Any], action: str = "archived") -> dict[str, Any]:
    ensure_dirs()
    relative_path = str(payload.get("path") or "").strip()
    path = safe_data_path(relative_path)
    if not path.exists() or path.suffix != ".md":
        raise FileNotFoundError(relative_path)
    archive_dir = ARCHIVE_DIR / now_utc().strftime("%Y-%m-%d")
    archive_dir.mkdir(parents=True, exist_ok=True)
    target = unique_path(archive_dir / path.name)
    path.replace(target)
    public = refresh_public_indexes()
    commit_status = git_commit(f"{action}: {target.stem[:60]}")
    return {
        "status": action,
        "from": relative_path,
        "archive_path": rel(target),
        "notes": public["index"]["count"],
        "git": commit_status,
    }


def html_page(title: str, body: str) -> bytes:
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <style>
    :root {{ --text:#111827; --muted:#667085; --line:#d7dde8; --panel:#fff; --soft:#f6f8fb; --accent:#1666d8; --green:#16835d; --ink:#101828; }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; font-family:"Microsoft YaHei","Segoe UI",Arial,sans-serif; color:var(--text); background:#f1f4f8; line-height:1.55; letter-spacing:0; }}
    main {{ max-width:1360px; margin:0 auto; padding:30px 24px 56px; }}
    a {{ color:var(--accent); text-decoration:none; }}
    h1 {{ margin:0; font-size:34px; line-height:1.2; letter-spacing:0; }}
    h2 {{ margin:0; font-size:18px; line-height:1.25; letter-spacing:0; }}
    h3 {{ margin:0; font-size:17px; line-height:1.35; letter-spacing:0; }}
    p {{ margin:0; }}
    .topbar {{ display:flex; justify-content:space-between; gap:18px; align-items:flex-end; margin-bottom:22px; }}
    .top-actions {{ min-width:344px; display:grid; gap:10px; justify-items:end; }}
    .search {{ width:100%; padding:4px; border:1px solid var(--line); border-radius:8px; background:#fff; }}
    .search input {{ width:100%; height:38px; border:1px solid var(--line); border-radius:8px; padding:0 12px; background:#fff; color:var(--text); font:14px "Microsoft YaHei","Segoe UI",Arial,sans-serif; }}
    .search input:focus {{ outline:2px solid #b8d4ff; border-color:#8fb9ef; }}
    .eyebrow {{ color:var(--green); font-size:13px; font-weight:700; margin-bottom:8px; }}
    .muted {{ color:var(--muted); }}
    .button-link {{ display:inline-flex; align-items:center; justify-content:center; min-height:34px; padding:6px 11px; border:1px solid var(--line); border-radius:8px; background:#fff; color:#124a9c; font-size:14px; font-weight:700; }}
    .button-link:hover {{ border-color:#a9c4e8; background:#f7faff; }}
    .stats {{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }}
    .stat {{ position:relative; min-width:108px; border:1px solid var(--line); background:var(--panel); border-radius:8px; padding:12px 12px 10px; overflow:hidden; }}
    .stat::before {{ content:""; position:absolute; left:0; top:0; width:100%; height:3px; background:#1666d8; }}
    .stat:nth-child(2)::before {{ background:#16835d; }}
    .stat:nth-child(3)::before {{ background:#9a6a12; }}
    .stat strong {{ display:block; color:var(--ink); font-size:21px; line-height:1.1; }}
    .stat span {{ color:var(--muted); font-size:12px; }}
    .layout {{ display:grid; grid-template-columns:360px minmax(0,1fr); gap:16px; align-items:start; }}
    .panel {{ background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; box-shadow:0 10px 30px rgba(16,24,40,.06); }}
    .notes-panel .note-excerpt {{ display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }}
    .note {{ display:block; border:1px solid transparent; border-bottom-color:#e8edf4; border-radius:8px; padding:14px 10px 15px; }}
    .note:last-child {{ border-bottom-color:transparent; }}
    .note:hover {{ background:#f7faff; border-color:#dbe8fb; }}
    .note-title {{ color:#124a9c; font-weight:750; margin-bottom:7px; overflow-wrap:anywhere; }}
    .note-meta {{ color:var(--muted); font-size:13px; margin-bottom:9px; }}
    .note-excerpt {{ color:#344054; font-size:14px; margin-bottom:10px; }}
    .tag {{ display:inline-block; margin:2px 3px 2px 0; padding:1px 6px; border-radius:6px; background:#eef4ff; color:#1457a8; font-size:12px; }}
    .note-hint {{ margin-top:14px; padding:14px; border:1px dashed #cbd5e1; border-radius:8px; color:var(--muted); background:#fbfcff; font-size:13px; }}
    .section-actions {{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:space-between; margin-bottom:14px; }}
    .filterbar {{ display:grid; grid-template-columns:minmax(220px,1fr) repeat(3,minmax(140px,190px)) auto; gap:10px; margin:14px 0 16px; }}
    .filterbar input, .filterbar select {{ width:100%; height:38px; border:1px solid var(--line); border-radius:8px; padding:0 10px; background:#fff; color:var(--text); font:14px "Microsoft YaHei","Segoe UI",Arial,sans-serif; }}
    .collection-layout {{ display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:16px; align-items:start; }}
    .note-list {{ display:grid; gap:10px; }}
    .facet-list {{ display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }}
    .facet {{ display:inline-flex; align-items:center; gap:5px; padding:4px 8px; border:1px solid #dbe4f0; border-radius:8px; background:#fbfcff; color:#344054; font-size:12px; }}
    .facet strong {{ color:#101828; }}
    .pager {{ display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:16px; color:var(--muted); }}
    .map-head {{ display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:14px; }}
    .map-panel {{ padding:18px 18px 16px; }}
    .map-shell {{ position:relative; height:650px; min-height:560px; overflow:hidden; border:1px solid #d6deea; border-radius:8px; background:#f8fafc; touch-action:none; }}
    #map {{ width:100%; height:100%; display:block; }}
    .map-toolbar {{ position:absolute; top:12px; right:12px; display:flex; flex-wrap:wrap; justify-content:flex-end; gap:6px; max-width:min(680px, calc(100% - 24px)); z-index:2; }}
    .map-toolbar button {{ height:34px; min-width:38px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; color:#344054; font-size:14px; font-weight:700; cursor:pointer; }}
    .map-toolbar button:hover {{ border-color:#9db7dc; background:#f7faff; }}
    .map-toolbar button[aria-pressed="true"] {{ border-color:#1457a8; background:#eaf2ff; color:#0f4d99; }}
    .map-divider {{ width:1px; height:24px; margin:5px 2px; background:#d6deea; }}
    .map-notice {{ position:absolute; left:12px; bottom:12px; max-width:62%; padding:8px 10px; border:1px solid #dbe4f0; border-radius:8px; background:rgba(255,255,255,.92); color:var(--muted); font-size:12px; z-index:2; }}
    .map-inspector {{ position:absolute; right:12px; bottom:12px; width:min(340px, calc(100% - 24px)); padding:10px 12px; border:1px solid #dbe4f0; border-radius:8px; background:rgba(255,255,255,.94); color:#344054; font-size:13px; line-height:1.45; z-index:2; box-shadow:0 10px 24px rgba(16,24,40,.08); }}
    .map-inspector strong {{ display:block; margin-bottom:3px; color:#101828; overflow-wrap:anywhere; }}
    .legend {{ display:flex; gap:8px; flex-wrap:wrap; color:var(--muted); font-size:12px; }}
    .legend span {{ display:inline-flex; align-items:center; gap:5px; }}
    .dot {{ width:9px; height:9px; border-radius:999px; display:inline-block; }}
    .node-label {{ font-family:"Microsoft YaHei","Segoe UI",Arial,sans-serif; fill:#263243; stroke:#fff; stroke-width:2.2; paint-order:stroke; pointer-events:none; letter-spacing:0; transition:opacity .16s ease; }}
    .node-label-note {{ font-size:13.5px; font-weight:750; fill:#102a56; }}
    .node-label-concept {{ font-size:12px; font-weight:700; fill:#15533e; }}
    .node-label-tag {{ font-size:11px; font-weight:650; fill:#5f4b16; }}
    .node-label-dim {{ opacity:.72; }}
    .node-label-hidden {{ opacity:0; }}
    .node-label-bg {{ fill:rgba(255,255,255,.88); stroke:#dbe4f0; stroke-width:.8; pointer-events:none; transition:opacity .16s ease; }}
    .node-label-bg.node-label-dim {{ opacity:.62; }}
    .node-label-bg.node-label-hidden {{ opacity:0; }}
    .node-group:hover .node-label-hidden, .node-group:focus .node-label-hidden, .node-group:hover .node-label-bg.node-label-hidden, .node-group:focus .node-label-bg.node-label-hidden, .node-group.is-related .node-label-hidden, .node-group.is-related .node-label-bg.node-label-hidden {{ opacity:1; }}
    .link-line {{ fill:none; stroke:#c2cbd8; stroke-width:1.2; stroke-linecap:round; vector-effect:non-scaling-stroke; transition:opacity .16s ease, stroke .16s ease, stroke-width .16s ease; }}
    .link-line.is-hot {{ stroke:#667085; stroke-width:1.9; opacity:.9; }}
    .link-line.is-dim {{ opacity:.08; }}
    .node-group {{ transition:opacity .16s ease; }}
    .node-group.is-dim {{ opacity:.16; }}
    .node-group.is-selected circle {{ stroke:#101828; stroke-width:3.5; }}
    .node-group:focus circle {{ stroke:#101828; }}
    .node-note {{ fill:#1666d8; stroke:#ffffff; stroke-width:3; cursor:pointer; vector-effect:non-scaling-stroke; }}
    .node-concept {{ fill:#16835d; stroke:#ffffff; stroke-width:2; cursor:pointer; vector-effect:non-scaling-stroke; }}
    .node-tag {{ fill:#8a6f2a; stroke:#ffffff; stroke-width:2; cursor:pointer; vector-effect:non-scaling-stroke; }}
    .empty {{ padding:26px; color:var(--muted); }}
    .note-body {{ max-width:900px; }}
    .note-body h1, .note-body h2, .note-body h3 {{ margin:20px 0 10px; }}
    .note-body p {{ margin:10px 0; color:#283548; }}
    .note-body ul {{ padding-left:22px; }}
    .note-body code {{ background:#eef2f7; padding:2px 5px; border-radius:4px; }}
    .note-body .wikilink {{ color:#1666d8; font-weight:700; }}
    .source-strip {{ margin-top:26px; padding-top:16px; border-top:1px solid var(--line); color:var(--muted); font-size:13px; }}
    .source-strip div {{ margin:4px 0; overflow-wrap:anywhere; }}
    .source-details {{ margin-top:8px; }}
    .source-details summary {{ display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:#1457a8; padding:4px 8px; border-radius:6px; }}
    .source-details summary:hover {{ background:#eef4ff; }}
    .reading-shell {{ max-width:760px; margin:0 auto; }}
    .reading-shell .panel {{ padding:26px 28px; }}
    @media (max-width:960px) {{ main {{ padding:22px 14px 42px; }} .topbar {{ display:block; }} .top-actions {{ min-width:0; justify-items:stretch; margin-top:14px; }} .stats {{ justify-content:flex-start; }} .layout, .collection-layout {{ grid-template-columns:1fr; }} .filterbar {{ grid-template-columns:1fr; }} .map-shell {{ height:560px; }} }}
    @media (max-width:720px) {{ h1 {{ font-size:30px; }} .panel {{ padding:14px; }} .map-head {{ display:block; }} .legend {{ margin-top:10px; }} .map-shell {{ height:500px; min-height:460px; }} .map-toolbar {{ left:12px; right:12px; justify-content:flex-start; }} .map-notice {{ max-width:calc(100% - 24px); }} .map-inspector {{ display:none; }} }}
  </style>
</head>
<body><main>{body}</main></body></html>""".encode("utf-8")


def first_query(query: dict[str, list[str]], name: str, default: str = "") -> str:
    return query.get(name, [default])[0].strip()


def note_url(path: str) -> str:
    return f"/note?path={quote(path, safe='/')}"


def render_tags(tags: list[Any]) -> str:
    return "".join(f'<span class="tag">#{html.escape(str(tag))}</span>' for tag in tags)


def render_note_card(note: dict[str, Any]) -> str:
    tags = list(note.get("tags", []))
    meta = " / ".join(
        part for part in [str(note.get("created", "")), str(note.get("source_type", "")).strip()] if part
    )
    concepts = list(note.get("concepts", []))
    concept_html = ""
    if concepts:
        concept_html = '<div class="note-meta">概念：' + "、".join(html.escape(str(item)) for item in concepts[:4])
        if len(concepts) > 4:
            concept_html += f" +{len(concepts) - 4}"
        concept_html += "</div>"
    return f"""<a class="note" href="{html.escape(note_url(str(note.get("path", ""))))}">
  <div class="note-title">{html.escape(str(note.get("title", "")))}</div>
  <div class="note-meta">{html.escape(meta)}</div>
  <p class="note-excerpt">{html.escape(str(note.get("excerpt", "")))}</p>
  {concept_html}
  <div>{render_tags(tags)}</div>
</a>"""


def url_with_params(path: str, params: dict[str, Any]) -> str:
    clean = {key: value for key, value in params.items() if value not in ("", None)}
    return f"{path}?{urlencode(clean)}" if clean else path


def render_facet_links(title: str, items: list[dict[str, Any]], param: str, limit: int = 24) -> str:
    if not items:
        return ""
    links = "\n".join(
        f'<a class="facet" href="{html.escape(url_with_params("/notes", {param: item["name"]}))}">'
        f'{html.escape(str(item["name"]))} <strong>{int(item["count"])}</strong></a>'
        for item in items[:limit]
    )
    return f"<h3>{html.escape(title)}</h3><div class=\"facet-list\">{links}</div>"


def render_home() -> bytes:
    notes = list_notes()
    index = load_note_index()
    graph = load_graph()
    nodes = graph.get("nodes", [])
    note_count = sum(1 for node in nodes if node.get("kind") == "note")
    concept_count = sum(1 for node in nodes if node.get("kind") == "concept")
    tag_count = sum(1 for node in nodes if node.get("kind") == "tag")
    graph_json = json.dumps(graph, ensure_ascii=False).replace("</", "<\\/")

    note_blocks: list[str] = []
    for note in notes[:6]:
        note_blocks.append(render_note_card(note))
    note_items = "\n".join(note_blocks) or '<div class="empty">还没有笔记。Hermes 调用 <code>/api/ingest</code> 后会自动出现在这里。</div>'
    if 0 < len(notes) < 3:
        note_items += '<div class="note-hint">继续把链接、文件或语音文字发给 Hermes。这里会补齐最近入库，不再像测试样例列表。</div>'
    top_tags = render_facet_links("常用标签", index.get("tags", []), "tag", 10)
    top_concepts = render_facet_links("概念入口", index.get("concepts", []), "concept", 10)

    body = f"""
<div class="topbar">
  <div>
    <div class="eyebrow">Hermes 自动入库</div>
    <h1>{html.escape(SITE_TITLE)}</h1>
    <p class="muted">链接、文件、语音转文字和零散想法都会先进 Vault，再在这里变成可浏览的手册。</p>
  </div>
  <div class="top-actions">
    <form class="search" action="/notes" method="get"><input name="q" type="search" placeholder="搜索全部笔记、标签、概念" aria-label="搜索全部笔记、标签、概念"></form>
    <div class="stats">
      <div class="stat"><strong>{note_count}</strong><span>笔记</span></div>
      <div class="stat"><strong>{concept_count}</strong><span>概念</span></div>
      <div class="stat"><strong>{tag_count}</strong><span>标签</span></div>
    </div>
  </div>
</div>
<div class="layout">
  <section class="panel notes-panel">
    <div class="section-actions">
      <div>
        <h2>最近入库</h2>
        <p class="muted">首页只放最近 6 条；完整浏览进入笔记库。</p>
      </div>
      <a class="button-link" href="/notes">全部笔记</a>
    </div>
    {note_items}
    {top_tags}
    {top_concepts}
  </section>
  <section class="panel map-panel">
    <div class="map-head">
      <div>
        <h2>知识地图</h2>
        <p class="muted">蓝色是笔记，绿色是尚未沉淀成笔记的概念，黄色是标签。</p>
      </div>
      <div class="legend">
        <span><i class="dot" style="background:#1666d8"></i>笔记</span>
        <span><i class="dot" style="background:#16835d"></i>概念</span>
        <span><i class="dot" style="background:#8a6f2a"></i>标签</span>
      </div>
    </div>
    <div class="map-shell">
      <div class="map-toolbar" aria-label="图谱缩放控制">
        <button type="button" id="mode-core" class="map-mode" aria-pressed="true">核心</button>
        <button type="button" id="mode-all" class="map-mode" aria-pressed="false">全部</button>
        <button type="button" id="toggle-tags" class="map-mode" aria-pressed="false">标签</button>
        <span class="map-divider" aria-hidden="true"></span>
        <button type="button" id="zoom-in">+</button>
        <button type="button" id="zoom-out">-</button>
        <button type="button" id="zoom-reset">重置</button>
      </div>
      <svg id="map" viewBox="0 0 900 600" role="img" aria-label="Knowledge graph map"></svg>
      <div id="map-notice" class="map-notice" hidden></div>
      <div id="map-inspector" class="map-inspector">悬停节点查看一跳关系，点击笔记进入正文。</div>
      <div id="map-empty" class="empty" hidden>还没有图谱数据。</div>
    </div>
  </section>
</div>
<script>
const GRAPH = {graph_json};
(function renderMap(data) {{
  const svg = document.getElementById("map");
  const empty = document.getElementById("map-empty");
  const notice = document.getElementById("map-notice");
  const inspector = document.getElementById("map-inspector");
  const shell = svg.closest(".map-shell");
  const width = Math.max(340, Math.round(svg.clientWidth || (shell ? shell.clientWidth : 900) || 900));
  const height = Math.max(420, Math.round(svg.clientHeight || (shell ? shell.clientHeight : 600) || 600));
  const span = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const allNodes = data.nodes || [];
  const allLinks = data.links || [];
  const state = {{ mode: "core", showTags: false }};
  const transform = {{ x: 0, y: 0, scale: 1 }};
  let isPanning = false;
  let lastPointer = {{ x: 0, y: 0 }};

  svg.setAttribute("viewBox", "0 0 " + width + " " + height);
  if (!allNodes.length) {{
    empty.hidden = false;
    return;
  }}

  function svgEl(name, attrs) {{
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }}

  function computeDegree(links) {{
    const out = new Map();
    links.forEach((link) => {{
      out.set(String(link.source), (out.get(String(link.source)) || 0) + Number(link.weight || 1));
      out.set(String(link.target), (out.get(String(link.target)) || 0) + Number(link.weight || 1));
    }});
    return out;
  }}

  const globalDegree = computeDegree(allLinks);

  function score(node) {{
    const kindBoost = node.kind === "note" ? 4 : node.kind === "concept" ? 2 : 1;
    return (globalDegree.get(String(node.id)) || 0) + Number(node.weight || 0) + kindBoost;
  }}

  function kindName(kind) {{
    if (kind === "note") return "笔记";
    if (kind === "concept") return "概念";
    if (kind === "tag") return "标签";
    return "节点";
  }}

  function escapeHtml(value) {{
    return String(value).replace(/[&<>"']/g, (ch) => ({{ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }}[ch]));
  }}

  function selectGraph() {{
    const cap = state.mode === "all" ? 180 : 90;
    const noteCap = state.mode === "all" ? Math.min(cap, 120) : 36;
    const pool = allNodes.filter((node) => state.showTags || node.kind !== "tag");
    const notes = pool.filter((node) => node.kind === "note").sort((a, b) => score(b) - score(a)).slice(0, noteCap);
    const selected = new Map();
    notes.forEach((node) => selected.set(String(node.id), node));
    [...pool].sort((a, b) => score(b) - score(a)).forEach((node) => {{
      if (selected.size < cap) selected.set(String(node.id), node);
    }});

    let nodes = Array.from(selected.values());
    let visibleIds = new Set(nodes.map((node) => String(node.id)));
    let links = allLinks.filter((link) => {{
      const source = String(link.source);
      const target = String(link.target);
      if (!visibleIds.has(source) || !visibleIds.has(target)) return false;
      if (!state.showTags && (source.startsWith("tag:") || target.startsWith("tag:"))) return false;
      return true;
    }});
    let degree = computeDegree(links);
    nodes = nodes.filter((node) => node.kind === "note" || degree.has(String(node.id)));
    visibleIds = new Set(nodes.map((node) => String(node.id)));
    links = links.filter((link) => visibleIds.has(String(link.source)) && visibleIds.has(String(link.target)));
    degree = computeDegree(links);
    return {{ nodes, links, degree }};
  }}

  function makeNeighbors(links) {{
    const neighbors = new Map();
    links.forEach((link) => {{
      const source = String(link.source);
      const target = String(link.target);
      if (!neighbors.has(source)) neighbors.set(source, new Set());
      if (!neighbors.has(target)) neighbors.set(target, new Set());
      neighbors.get(source).add(target);
      neighbors.get(target).add(source);
    }});
    return neighbors;
  }}

  function draw() {{
    const graph = selectGraph();
    const nodes = graph.nodes;
    const links = graph.links;
    const degree = graph.degree;
    const neighbors = makeNeighbors(links);
    const visibleIds = new Set(nodes.map((node) => String(node.id)));
    const hiddenCount = allNodes.filter((node) => !visibleIds.has(String(node.id))).length;
    const tagCount = allNodes.filter((node) => node.kind === "tag").length;
    const labelLimit = state.showTags
      ? (width < 620 ? 6 : 12)
      : (width < 620 ? (state.mode === "all" ? 12 : 10) : (state.mode === "all" ? 22 : 18));
    const topLabelIds = new Set([...nodes].sort((a, b) => score(b) - score(a)).slice(0, labelLimit).map((node) => String(node.id)));
    const linkElements = [];
    const nodeElements = new Map();

    notice.hidden = false;
    if (state.showTags) {{
      notice.textContent = "已显示标签节点。标签会增加连线密度，适合找分类，不适合日常阅读。";
    }} else if (hiddenCount > 0 || tagCount > 0) {{
      notice.textContent = "默认显示核心笔记和概念，隐藏标签节点与低连接节点；打开“标签”可看分类关系。";
    }} else {{
      notice.textContent = "悬停节点查看一跳关系，点击笔记进入正文。";
    }}
    inspector.innerHTML = "悬停节点查看一跳关系，点击笔记进入正文。";

    function degreeOf(node) {{
      return degree.get(String(node.id)) || 0;
    }}

    function nodeRadius(node) {{
      const d = Math.min(8, degreeOf(node));
      if (node.kind === "note") return 13 + Math.min(9, Number(node.weight || 1) * 1.1 + d * 0.7);
      if (node.kind === "concept") return 8 + Math.min(5, d * 0.9);
      return 6 + Math.min(4, d * 0.7);
    }}

    function labelState(node) {{
      const id = String(node.id);
      const d = degreeOf(node);
      if (node.kind === "note") return topLabelIds.has(id) || nodes.length <= 16 ? "primary" : "hidden";
      if (node.kind === "concept" && width < 620) return topLabelIds.has(id) && d >= 2 ? "secondary" : "hidden";
      if (node.kind === "concept") return d >= 2 || (nodes.length <= 34 && topLabelIds.has(id)) ? "secondary" : "hidden";
      if (node.kind === "tag") return state.showTags && topLabelIds.has(id) && d >= 3 ? "dim" : "hidden";
      return "hidden";
    }}

    function labelClass(node) {{
      const stateName = labelState(node);
      if (stateName === "hidden") return " node-label-hidden";
      if (stateName === "dim") return " node-label-dim";
      return "";
    }}

    function shortLabel(label, node) {{
      const text = String(label || "");
      const limit = width < 620 ? (node.kind === "note" ? 10 : 8) : (node.kind === "note" ? 15 : node.kind === "concept" ? 10 : 12);
      const chars = Array.from(text);
      let visualWidth = 0;
      let out = "";
      for (const ch of chars) {{
        visualWidth += /[\u4e00-\u9fff]/.test(ch) ? 1 : 0.58;
        if (visualWidth > limit) return out + "…";
        out += ch;
      }}
      return out;
    }}

    function initialLayout() {{
      const points = [];
      const pointById = new Map();
      const noteNodes = nodes.filter((node) => node.kind === "note").sort((a, b) => score(b) - score(a));
      const otherNodes = nodes.filter((node) => node.kind !== "note").sort((a, b) => score(b) - score(a));
      const noteRing = Math.max(76, Math.min(150, span * 0.18));
      noteNodes.forEach((node, index) => {{
        const angle = (Math.PI * 2 * index) / Math.max(1, noteNodes.length) - Math.PI / 2;
        const radius = noteRing + (index % 3) * 18;
        const point = {{
          id: String(node.id),
          node,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius * 0.72,
          angle,
          vx: 0,
          vy: 0
        }};
        points.push(point);
        pointById.set(point.id, point);
      }});
      otherNodes.forEach((node, index) => {{
        const id = String(node.id);
        const connected = links
          .filter((link) => String(link.source) === id || String(link.target) === id)
          .map((link) => pointById.get(String(link.source) === id ? String(link.target) : String(link.source)))
          .filter(Boolean);
        let anchorX = cx;
        let anchorY = cy;
        let baseAngle = index * 2.399963229728653;
        if (connected.length) {{
          anchorX = connected.reduce((sum, point) => sum + point.x, 0) / connected.length;
          anchorY = connected.reduce((sum, point) => sum + point.y, 0) / connected.length;
          baseAngle = Math.atan2(anchorY - cy, anchorX - cx) + ((index % 7) - 3) * 0.22;
        }}
        const distance = node.kind === "tag" ? Math.max(145, span * 0.32) : Math.max(88, span * 0.18);
        const point = {{
          id,
          node,
          x: anchorX + Math.cos(baseAngle) * distance,
          y: anchorY + Math.sin(baseAngle) * distance * 0.72,
          angle: baseAngle,
          vx: 0,
          vy: 0
        }};
        points.push(point);
        pointById.set(point.id, point);
      }});
      return {{ points, pointById }};
    }}

    const layoutState = initialLayout();
    const layout = layoutState.points;
    const pointById = layoutState.pointById;

    for (let tick = 0; tick < 260; tick += 1) {{
      for (let i = 0; i < layout.length; i += 1) {{
        for (let j = i + 1; j < layout.length; j += 1) {{
          const a = layout[i];
          const b = layout[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distSq = dx * dx + dy * dy;
          if (distSq < 1) {{
            dx = 1;
            dy = 0;
            distSq = 1;
          }}
          const dist = Math.sqrt(distSq);
          let labelGap = labelState(a.node) === "hidden" && labelState(b.node) === "hidden" ? 24 : 44;
          if (a.node.kind === "note" || b.node.kind === "note") labelGap += 20;
          const minDistance = nodeRadius(a.node) + nodeRadius(b.node) + labelGap;
          const repulsion = (dist < minDistance ? 920 : 150) / distSq;
          const fx = (dx / dist) * repulsion;
          const fy = (dy / dist) * repulsion;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }}
      }}

      links.forEach((link) => {{
        const source = pointById.get(String(link.source));
        const target = pointById.get(String(link.target));
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const desired = link.type === "tag" ? Math.max(118, span * 0.24) : Math.max(78, span * 0.15);
        const strength = (link.type === "tag" ? 0.010 : 0.028) * Number(link.weight || 1);
        const force = (dist - desired) * strength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }});

      layout.forEach((point) => {{
        point.vx += (cx - point.x) * 0.003;
        point.vy += (cy - point.y) * 0.003;
        if (point.node.kind === "tag") {{
          const dx = point.x - cx;
          const dy = point.y - cy;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const ring = Math.max(180, span * 0.42);
          point.vx += ((cx + (dx / dist) * ring) - point.x) * 0.0025;
          point.vy += ((cy + (dy / dist) * ring * 0.72) - point.y) * 0.0025;
        }}
        point.vx *= 0.84;
        point.vy *= 0.84;
        point.x = Math.min(width - 52, Math.max(52, point.x + point.vx));
        point.y = Math.min(height - 52, Math.max(52, point.y + point.vy));
      }});
    }}

    function fitLayoutToView() {{
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      layout.forEach((point) => {{
        const r = nodeRadius(point.node) + (labelState(point.node) === "hidden" ? 16 : 82);
        minX = Math.min(minX, point.x - r);
        maxX = Math.max(maxX, point.x + r);
        minY = Math.min(minY, point.y - r * 0.45);
        maxY = Math.max(maxY, point.y + r * 0.45);
      }});
      const boundsWidth = Math.max(1, maxX - minX);
      const boundsHeight = Math.max(1, maxY - minY);
      const boundsCx = (minX + maxX) / 2;
      const boundsCy = (minY + maxY) / 2;
      const padX = width < 560 ? 44 : 74;
      const padY = height < 520 ? 104 : 126;
      const margin = width < 560 ? 34 : 58;
      const scale = Math.min(1.18, Math.min((width - padX) / boundsWidth, (height - padY) / boundsHeight));
      layout.forEach((point) => {{
        point.x = Math.min(width - margin, Math.max(margin, cx + (point.x - boundsCx) * scale));
        point.y = Math.min(height - margin, Math.max(margin, cy + (point.y - boundsCy) * scale));
      }});
    }}

    fitLayoutToView();

    const viewport = svgEl("g", {{ id: "graph-content" }});
    const linksLayer = svgEl("g", {{ class: "graph-links" }});
    const nodesLayer = svgEl("g", {{ class: "graph-nodes" }});
    viewport.appendChild(linksLayer);
    viewport.appendChild(nodesLayer);
    svg.textContent = "";
    svg.appendChild(viewport);

    function applyTransform() {{
      viewport.setAttribute("transform", "translate(" + transform.x + " " + transform.y + ") scale(" + transform.scale + ")");
    }}

    function labelPositions(point, node) {{
      const radius = nodeRadius(node);
      if (node.kind !== "note") {{
        return [
          {{ x: point.x, y: point.y + radius + 18, anchor: "middle" }},
          {{ x: point.x, y: point.y - radius - 10, anchor: "middle" }},
          {{ x: point.x + radius + 18, y: point.y + 5, anchor: "start" }},
          {{ x: point.x - radius - 18, y: point.y + 5, anchor: "end" }},
          {{ x: point.x + radius + 14, y: point.y + radius + 18, anchor: "start" }},
          {{ x: point.x - radius - 14, y: point.y + radius + 18, anchor: "end" }}
        ];
      }}
      const dx = point.x - cx;
      const dy = point.y - cy;
      let angle = Math.abs(dx) + Math.abs(dy) < 42 ? point.angle : Math.atan2(dy, dx);
      if (point.x < 130) angle = 0;
      if (point.x > width - 130) angle = Math.PI;
      const offset = radius + 24;
      const primaryX = point.x + Math.cos(angle) * offset;
      const primaryY = point.y + Math.sin(angle) * offset + 4;
      let primaryAnchor = "middle";
      if (Math.cos(angle) > 0.25) primaryAnchor = "start";
      if (Math.cos(angle) < -0.25) primaryAnchor = "end";
      return [
        {{ x: primaryX, y: primaryY, anchor: primaryAnchor }},
        {{ x: point.x + radius + 24, y: point.y + 5, anchor: "start" }},
        {{ x: point.x - radius - 24, y: point.y + 5, anchor: "end" }},
        {{ x: point.x, y: point.y - radius - 12, anchor: "middle" }},
        {{ x: point.x, y: point.y + radius + 22, anchor: "middle" }},
        {{ x: point.x + radius + 18, y: point.y - radius - 8, anchor: "start" }},
        {{ x: point.x - radius - 18, y: point.y - radius - 8, anchor: "end" }},
        {{ x: point.x + radius + 18, y: point.y + radius + 22, anchor: "start" }},
        {{ x: point.x - radius - 18, y: point.y + radius + 22, anchor: "end" }}
      ];
    }}

    const occupiedBoxes = layout.map((point) => {{
      const r = nodeRadius(point.node) + 7;
      return {{ x: point.x - r, y: point.y - r, width: r * 2, height: r * 2 }};
    }});

    function overlaps(a, b) {{
      return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }}

    function applyLabelBox(label, labelBg) {{
      const box = label.getBBox();
      labelBg.setAttribute("x", box.x - 5);
      labelBg.setAttribute("y", box.y - 3);
      labelBg.setAttribute("width", box.width + 10);
      labelBg.setAttribute("height", box.height + 6);
      return box;
    }}

    function reserveLabelBox(label, labelBg, node, point) {{
      if (labelState(node) === "hidden") return;
      for (const candidate of labelPositions(point, node)) {{
        label.setAttribute("x", candidate.x);
        label.setAttribute("y", candidate.y);
        label.setAttribute("text-anchor", candidate.anchor);
        let box = applyLabelBox(label, labelBg);
        let shiftX = 0;
        let shiftY = 0;
        if (box.x < 14) shiftX = 14 - box.x;
        if (box.x + box.width > width - 14) shiftX = width - 14 - (box.x + box.width);
        if (box.y < 14) shiftY = 14 - box.y;
        if (box.y + box.height > height - 14) shiftY = height - 14 - (box.y + box.height);
        if (shiftX || shiftY) {{
          label.setAttribute("x", Number(label.getAttribute("x")) + shiftX);
          label.setAttribute("y", Number(label.getAttribute("y")) + shiftY);
          box = applyLabelBox(label, labelBg);
        }}
        const padded = {{ x: box.x - 8, y: box.y - 6, width: box.width + 16, height: box.height + 12 }};
        if (!occupiedBoxes.some((existing) => overlaps(padded, existing))) {{
          occupiedBoxes.push(padded);
          return;
        }}
      }}
      label.classList.add("node-label-hidden");
      labelBg.classList.add("node-label-hidden");
    }}

    function linkPath(source, target, index, type) {{
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const nx = -dy / dist;
      const ny = dx / dist;
      const bend = (type === "tag" ? 16 : 8) * (index % 2 ? 1 : -1);
      const mx = (source.x + target.x) / 2 + nx * bend;
      const my = (source.y + target.y) / 2 + ny * bend;
      return "M " + source.x + " " + source.y + " Q " + mx + " " + my + " " + target.x + " " + target.y;
    }}

    links.forEach((link, index) => {{
      const source = pointById.get(String(link.source));
      const target = pointById.get(String(link.target));
      if (!source || !target) return;
      const el = svgEl("path", {{
        d: linkPath(source, target, index, link.type),
        class: "link-line",
        "data-source": String(link.source),
        "data-target": String(link.target),
        opacity: link.type === "tag" ? "0.34" : "0.52"
      }});
      linksLayer.appendChild(el);
      linkElements.push(el);
    }});

    const renderOrder = [...layout].sort((a, b) => {{
      const kindA = a.node.kind === "note" ? 2 : a.node.kind === "concept" ? 1 : 0;
      const kindB = b.node.kind === "note" ? 2 : b.node.kind === "concept" ? 1 : 0;
      return kindA - kindB;
    }});

    renderOrder.forEach((point) => {{
      const node = point.node;
      const group = svgEl("g", {{ tabindex: "0", class: "node-group", "data-id": point.id }});
      const klass = node.kind === "concept" ? "node-concept" : node.kind === "tag" ? "node-tag" : "node-note";
      const circle = svgEl("circle", {{ cx: point.x, cy: point.y, r: nodeRadius(node), class: klass }});
      const labelPoint = labelPositions(point, node)[0];
      const visibilityClass = labelClass(node);
      const labelBg = svgEl("rect", {{ x: labelPoint.x, y: labelPoint.y - 10, width: 1, height: 1, rx: 6, class: "node-label-bg" + visibilityClass }});
      const label = svgEl("text", {{
        x: labelPoint.x,
        y: labelPoint.y,
        "text-anchor": labelPoint.anchor,
        class: "node-label node-label-" + node.kind + visibilityClass
      }});
      label.textContent = shortLabel(node.label || node.title || node.id, node);
      const title = svgEl("title", {{}});
      title.textContent = node.title || node.label || node.id;
      group.appendChild(title);
      group.appendChild(circle);
      group.appendChild(labelBg);
      group.appendChild(label);
      group.addEventListener("mouseenter", () => setFocus(point.id, node));
      group.addEventListener("focus", () => setFocus(point.id, node));
      group.addEventListener("mouseleave", clearFocus);
      group.addEventListener("blur", clearFocus);
      if (node.url && String(node.url).startsWith("/")) {{
        group.style.cursor = "pointer";
        group.addEventListener("click", () => window.location.href = node.url);
        group.addEventListener("keydown", (event) => {{
          if (event.key === "Enter") window.location.href = node.url;
        }});
      }}
      nodesLayer.appendChild(group);
      nodeElements.set(point.id, group);
      applyLabelBox(label, labelBg);
      reserveLabelBox(label, labelBg, node, point);
    }});

    function setFocus(id, node) {{
      const related = new Set(neighbors.get(String(id)) || []);
      related.add(String(id));
      nodeElements.forEach((group, nodeId) => {{
        group.classList.toggle("is-dim", !related.has(nodeId));
        group.classList.toggle("is-related", related.has(nodeId));
        group.classList.toggle("is-selected", nodeId === String(id));
      }});
      linkElements.forEach((line) => {{
        const isHot = line.getAttribute("data-source") === String(id) || line.getAttribute("data-target") === String(id);
        line.classList.toggle("is-hot", isHot);
        line.classList.toggle("is-dim", !isHot);
      }});
      const d = degree.get(String(id)) || 0;
      const relatedCount = Math.max(0, related.size - 1);
      inspector.innerHTML = "<strong>" + escapeHtml(node.title || node.label || node.id) + "</strong>" +
        kindName(node.kind) + " / 连接 " + d + " / 一跳节点 " + relatedCount +
        (node.kind === "note" ? "<br>点击打开笔记正文。" : "<br>点击进入对应集合。");
    }}

    function clearFocus() {{
      nodeElements.forEach((group) => group.classList.remove("is-dim", "is-related", "is-selected"));
      linkElements.forEach((line) => line.classList.remove("is-hot", "is-dim"));
      inspector.innerHTML = "悬停节点查看一跳关系，点击笔记进入正文。";
    }}

    applyTransform();
  }}

  function setMode(nextMode) {{
    state.mode = nextMode;
    document.getElementById("mode-core").setAttribute("aria-pressed", String(nextMode === "core"));
    document.getElementById("mode-all").setAttribute("aria-pressed", String(nextMode === "all"));
    draw();
  }}

  function setTags(nextValue) {{
    state.showTags = nextValue;
    document.getElementById("toggle-tags").setAttribute("aria-pressed", String(nextValue));
    draw();
  }}

  function currentViewport() {{
    return document.getElementById("graph-content");
  }}

  function applyCurrentTransform() {{
    const viewport = currentViewport();
    if (viewport) viewport.setAttribute("transform", "translate(" + transform.x + " " + transform.y + ") scale(" + transform.scale + ")");
  }}

  function setScale(nextScale) {{
    const previous = transform.scale;
    const next = Math.min(3, Math.max(0.55, nextScale));
    const ratio = next / previous;
    transform.x = cx - (cx - transform.x) * ratio;
    transform.y = cy - (cy - transform.y) * ratio;
    transform.scale = next;
    applyCurrentTransform();
  }}

  function resetView() {{
    transform.x = 0;
    transform.y = 0;
    transform.scale = 1;
    applyCurrentTransform();
  }}

  document.getElementById("mode-core").addEventListener("click", () => setMode("core"));
  document.getElementById("mode-all").addEventListener("click", () => setMode("all"));
  document.getElementById("toggle-tags").addEventListener("click", () => setTags(!state.showTags));
  document.getElementById("zoom-in").addEventListener("click", () => setScale(transform.scale * 1.18));
  document.getElementById("zoom-out").addEventListener("click", () => setScale(transform.scale / 1.18));
  document.getElementById("zoom-reset").addEventListener("click", resetView);

  svg.addEventListener("wheel", (event) => {{
    event.preventDefault();
    setScale(transform.scale * (event.deltaY < 0 ? 1.12 : 0.88));
  }}, {{ passive: false }});

  svg.addEventListener("pointerdown", (event) => {{
    if (event.target.closest && event.target.closest(".node-group")) return;
    isPanning = true;
    lastPointer = {{ x: event.clientX, y: event.clientY }};
    svg.setPointerCapture(event.pointerId);
  }});
  svg.addEventListener("pointermove", (event) => {{
    if (!isPanning) return;
    transform.x += event.clientX - lastPointer.x;
    transform.y += event.clientY - lastPointer.y;
    lastPointer = {{ x: event.clientX, y: event.clientY }};
    applyCurrentTransform();
  }});
  svg.addEventListener("pointerup", () => {{ isPanning = false; }});
  svg.addEventListener("pointercancel", () => {{ isPanning = false; }});

  draw();
}})(GRAPH);

</script>
"""
    return html_page(SITE_TITLE, body)


def render_notes_page(query: dict[str, list[str]]) -> bytes:
    q = first_query(query, "q")
    tag = first_query(query, "tag")
    concept = first_query(query, "concept")
    source_type = first_query(query, "source_type")
    page = parse_positive_int(first_query(query, "page", "1"), 1)
    page_size = parse_positive_int(first_query(query, "page_size", str(DEFAULT_PAGE_SIZE)), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    notes = filtered_notes(q, tag, concept, source_type)
    result = paginate(notes, page, page_size)
    index = load_note_index()

    note_items = "\n".join(render_note_card(note) for note in result["notes"])
    if not note_items:
        note_items = '<div class="empty">没有匹配的笔记。换个关键词，或把新材料发给 Hermes 入库。</div>'

    source_options = ['<option value="">全部来源</option>']
    for item in index.get("source_types", []):
        value = str(item["name"])
        selected = " selected" if value == source_type else ""
        source_options.append(f'<option value="{html.escape(value)}"{selected}>{html.escape(value)} ({int(item["count"])})</option>')

    base_params = {"q": q, "tag": tag, "concept": concept, "source_type": source_type, "page_size": page_size}
    prev_link = url_with_params("/notes", {**base_params, "page": max(1, result["page"] - 1)})
    next_link = url_with_params("/notes", {**base_params, "page": min(result["page_count"], result["page"] + 1)})
    active_filter = " / ".join(part for part in [f"搜索：{q}" if q else "", f"标签：{tag}" if tag else "", f"概念：{concept}" if concept else "", f"来源：{source_type}" if source_type else ""] if part)
    if not active_filter:
        active_filter = "全部笔记"

    body = f"""
<div class="topbar">
  <div>
    <div class="eyebrow">知识库浏览</div>
    <h1>全部笔记</h1>
    <p class="muted">{html.escape(active_filter)}，共 {result["total"]} 条。</p>
  </div>
  <div class="top-actions">
    <a class="button-link" href="/">返回首页</a>
  </div>
</div>
<form class="filterbar" action="/notes" method="get">
  <input name="q" value="{html.escape(q)}" placeholder="搜索标题、摘要、标签、概念">
  <input name="tag" value="{html.escape(tag)}" placeholder="标签">
  <input name="concept" value="{html.escape(concept)}" placeholder="概念">
  <select name="source_type">{''.join(source_options)}</select>
  <button class="button-link" type="submit">筛选</button>
</form>
<div class="collection-layout">
  <section class="panel">
    <div class="section-actions">
      <div>
        <h2>笔记列表</h2>
        <p class="muted">第 {result["page"]} / {result["page_count"]} 页，每页 {result["page_size"]} 条。</p>
      </div>
      <a class="button-link" href="/notes">清除筛选</a>
    </div>
    <div class="note-list">{note_items}</div>
    <div class="pager">
      <a class="button-link" href="{html.escape(prev_link)}">上一页</a>
      <span>{result["total"]} 条结果</span>
      <a class="button-link" href="{html.escape(next_link)}">下一页</a>
    </div>
  </section>
  <aside class="panel">
    {render_facet_links("标签", index.get("tags", []), "tag")}
    {render_facet_links("概念", index.get("concepts", []), "concept")}
    {render_facet_links("来源", index.get("source_types", []), "source_type")}
  </aside>
</div>
"""
    return html_page("全部笔记", body)


def resolve_wikilink_href(target: str, note_lookup: dict[str, str] | None) -> str:
    clean = target.strip()
    if not clean:
        return "/notes"
    if note_lookup:
        note_path = (
            note_lookup.get(clean)
            or note_lookup.get(clean.casefold())
            or note_lookup.get(Path(clean).stem)
            or note_lookup.get(Path(clean).stem.casefold())
        )
        if note_path:
            return f"/note?path={quote(note_path, safe='/')}"
    return f"/notes?concept={quote(clean)}"


def safe_markdown_href(href: str) -> str:
    raw = html.unescape(href).strip()
    if not raw:
        return ""
    if raw.startswith(("#", "/", "./", "../")):
        return raw
    parsed = urlparse(raw)
    if parsed.scheme.lower() in SAFE_MARKDOWN_SCHEMES:
        return raw
    return ""


def inline_markdown(value: str, note_lookup: dict[str, str] | None = None) -> str:
    value = value.replace("->", "→")
    escaped = html.escape(value)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)

    def replace_markdown_link(match: re.Match[str]) -> str:
        label = html.escape(match.group(1))
        safe_href = safe_markdown_href(match.group(2))
        if not safe_href:
            return label
        href = html.escape(safe_href, quote=True)
        return f'<a class="wikilink" href="{href}">{label}</a>'

    def replace_wikilink(match: re.Match[str]) -> str:
        target = html.unescape(match.group(1)).strip()
        label = html.unescape(match.group(2) or target).strip()
        href = html.escape(resolve_wikilink_href(target, note_lookup), quote=True)
        return f'<a class="wikilink" href="{href}">[[{html.escape(label)}]]</a>'

    escaped = MARKDOWN_LINK_RE.sub(replace_markdown_link, escaped)
    escaped = WIKILINK_RENDER_RE.sub(replace_wikilink, escaped)
    return escaped


def render_markdown_body(body: str, note_lookup: dict[str, str] | None = None) -> str:
    parts: list[str] = []
    list_items: list[str] = []

    def flush_list() -> None:
        if not list_items:
            return
        parts.append("<ul>" + "".join(f"<li>{item}</li>" for item in list_items) + "</ul>")
        list_items.clear()

    for raw_line in body.strip().splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            flush_list()
            continue
        heading = re.match(r"^(#{1,3})\s+(.+)$", line)
        if heading:
            flush_list()
            level = min(3, len(heading.group(1)))
            parts.append(f"<h{level}>{inline_markdown(heading.group(2).strip(), note_lookup)}</h{level}>")
            continue
        bullet = re.match(r"^\s*[-*]\s+(.+)$", line)
        if bullet:
            list_items.append(inline_markdown(bullet.group(1).strip(), note_lookup))
            continue
        flush_list()
        parts.append(f"<p>{inline_markdown(line.strip(), note_lookup)}</p>")

    flush_list()
    return "\n".join(parts) or '<p class="muted">这篇笔记还没有正文。</p>'


def render_note(relative_path: str) -> bytes:
    path = safe_data_path(relative_path)
    if not path.exists() or path.suffix != ".md":
        raise FileNotFoundError(relative_path)
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)
    title = note_title(path, body, fm)
    note_lookup = build_note_lookup(load_note_index())
    tags_html = "".join(f'<span class="tag">#{html.escape(str(tag))}</span>' for tag in normalize_tags(fm.get("tags", [])))
    meta = " / ".join(part for part in [format_date(fm.get("created", "")), str(fm.get("source_type", "") or "").strip()] if part)
    source_url = str(fm.get("source_url", "") or "").strip() or "Telegram/Hermes input"
    source_hash = str(fm.get("source_hash", "") or "").strip()
    note_content = TAG_RE.sub("", notes_section(body)).strip()
    body_html = f"""
<div class="reading-shell">
<p><a href="/">&larr; 返回手册</a></p>
<section class="panel note-body">
  <h1>{html.escape(title)}</h1>
  <p class="note-meta">{html.escape(meta)}</p>
  <div>{tags_html}</div>
  <div class="note-body">{render_markdown_body(note_content, note_lookup)}</div>
  <div class="source-strip">
    <div>来源：{html.escape(source_url)}</div>
    <details class="source-details">
      <summary>查看元信息</summary>
      <div>Source hash：<code>{html.escape(source_hash)}</code></div>
      <div>Vault path：<code>{html.escape(relative_path)}</code></div>
    </details>
  </div>
</section>
</div>
"""
    return html_page(title, body_html)


class Handler(BaseHTTPRequestHandler):
    server_version = "PersonalWiki/0.1"

    def do_GET(self) -> None:
        try:
            parsed = urlparse(self.path)
            api_read_paths = {"/api/notes", "/api/note", "/api/tags", "/api/concepts", "/api/graph"}
            page_read_paths = {"/", "/notes", "/note", "/manual", "/docs/USAGE.md"}
            if parsed.path == "/auth/read":
                self.send_bytes(HTTPStatus.OK, "text/html; charset=utf-8", self.render_read_login(parsed))
                return
            if parsed.path in api_read_paths and not self.authorized_read(REQUIRE_API_READ_AUTH):
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                return
            if parsed.path in page_read_paths and not self.authorized_read(REQUIRE_PAGE_READ_AUTH):
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                return
            if parsed.path == "/":
                self.send_bytes(HTTPStatus.OK, "text/html; charset=utf-8", render_home())
            elif parsed.path in {"/manual", "/docs/USAGE.md"}:
                if not MANUAL_PATH.exists():
                    raise FileNotFoundError(str(MANUAL_PATH))
                self.send_bytes(HTTPStatus.OK, "text/markdown; charset=utf-8", MANUAL_PATH.read_bytes())
            elif parsed.path == "/notes":
                query = parse_qs(parsed.query)
                self.send_bytes(HTTPStatus.OK, "text/html; charset=utf-8", render_notes_page(query))
            elif parsed.path == "/note":
                query = parse_qs(parsed.query)
                relative_path = query.get("path", [""])[0]
                self.send_bytes(HTTPStatus.OK, "text/html; charset=utf-8", render_note(relative_path))
            elif parsed.path == "/api/health":
                self.send_json(HTTPStatus.OK, {"status": "ok", "notes": len(list_notes()), "data_dir": str(DATA_DIR)})
            elif parsed.path == "/api/notes":
                query = parse_qs(parsed.query)
                page = parse_positive_int(first_query(query, "page", "1"), 1)
                page_size = parse_positive_int(first_query(query, "page_size", str(DEFAULT_PAGE_SIZE)), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
                notes = filtered_notes(
                    first_query(query, "q"),
                    first_query(query, "tag"),
                    first_query(query, "concept"),
                    first_query(query, "source_type"),
                )
                self.send_json(HTTPStatus.OK, paginate(notes, page, page_size))
            elif parsed.path == "/api/note":
                query = parse_qs(parsed.query)
                self.send_json(HTTPStatus.OK, read_note(first_query(query, "path")))
            elif parsed.path == "/api/tags":
                self.send_json(HTTPStatus.OK, {"tags": load_note_index().get("tags", [])})
            elif parsed.path == "/api/concepts":
                self.send_json(HTTPStatus.OK, {"concepts": load_note_index().get("concepts", [])})
            elif parsed.path == "/api/graph":
                self.send_json(HTTPStatus.OK, load_graph())
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        except Exception as exc:
            self.send_error_json(exc)

    def do_POST(self) -> None:
        try:
            parsed = urlparse(self.path)
            if parsed.path == "/auth/read":
                self.handle_read_login(parsed)
                return
            writable_paths = {
                "/api/ingest",
                "/api/rebuild",
                "/api/note/update",
                "/api/note/tag",
                "/api/note/archive",
                "/api/note/delete",
                "/api/relink",
            }
            if parsed.path not in writable_paths:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
                return
            if not self.authorized():
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                return
            if parsed.path == "/api/rebuild":
                self.send_json(HTTPStatus.OK, rebuild())
                return
            if parsed.path == "/api/note/update":
                self.send_json(HTTPStatus.OK, update_note(self.read_json()))
                return
            if parsed.path == "/api/note/tag":
                self.send_json(HTTPStatus.OK, tag_note(self.read_json()))
                return
            if parsed.path == "/api/note/archive":
                self.send_json(HTTPStatus.OK, archive_note(self.read_json(), "archived"))
                return
            if parsed.path == "/api/note/delete":
                self.send_json(HTTPStatus.OK, archive_note(self.read_json(), "deleted"))
                return
            if parsed.path == "/api/relink":
                self.send_json(HTTPStatus.OK, relink_notes(self.read_json()))
                return
            payload = self.read_json()
            self.send_json(HTTPStatus.OK, ingest(payload))
        except Exception as exc:
            self.send_error_json(exc)

    def authorized(self) -> bool:
        if not API_TOKEN:
            return ALLOW_UNAUTHENTICATED_WRITE
        header = self.headers.get("Authorization", "")
        return header == f"Bearer {API_TOKEN}"

    def authorized_read(self, required: bool) -> bool:
        if not required:
            return True
        if self.client_address[0] in {"127.0.0.1", "::1"}:
            return True
        allowed_tokens = self.read_auth_tokens()
        if not allowed_tokens:
            return False
        header = self.headers.get("Authorization", "")
        if header.startswith("Bearer ") and self.token_allowed(header[7:], allowed_tokens):
            return True
        cookie_header = self.headers.get("Cookie", "")
        for part in cookie_header.split(";"):
            name, _, value = part.strip().partition("=")
            if name == READ_AUTH_COOKIE and self.token_allowed(value, allowed_tokens):
                return True
        return False

    def read_auth_tokens(self) -> list[str]:
        tokens = []
        for token in (READ_TOKEN,):
            clean = token.strip()
            if clean and clean not in tokens:
                tokens.append(clean)
        return tokens

    def token_allowed(self, token: str, allowed_tokens: list[str]) -> bool:
        return any(hmac.compare_digest(token, allowed) for allowed in allowed_tokens)

    def handle_read_login(self, parsed: Any) -> None:
        allowed_tokens = self.read_auth_tokens()
        if not allowed_tokens:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "read_auth_not_configured"})
            return
        query = parse_qs(parsed.query)
        form = self.read_form()
        token = form.get("token", [""])[0]
        next_url = query.get("next", ["/"])[0] or "/"
        next_url = form.get("next", [next_url])[0] or "/"
        if not next_url.startswith("/") or next_url.startswith("//"):
            next_url = "/"
        if not self.token_allowed(token, allowed_tokens):
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
            return
        self.send_response(HTTPStatus.FOUND.value)
        self.send_header("Location", next_url)
        self.send_header(
            "Set-Cookie",
            self.read_cookie_header(token),
        )
        self.end_headers()

    def read_cookie_header(self, token: str) -> str:
        secure = "; Secure" if self.headers.get("X-Forwarded-Proto", "").lower() == "https" else ""
        return f"{READ_AUTH_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax{secure}"

    def render_read_login(self, parsed: Any) -> bytes:
        query = parse_qs(parsed.query)
        next_url = query.get("next", ["/"])[0] or "/"
        if not next_url.startswith("/") or next_url.startswith("//"):
            next_url = "/"
        body = f"""
<div class="reading-shell">
  <section class="panel">
    <h1>Read access</h1>
    <p>Paste your read token. The token is submitted in the request body and is not placed in the URL.</p>
    <form method="post" action="/auth/read">
      <input type="hidden" name="next" value="{html.escape(next_url, quote=True)}" />
      <label>Read token<br /><input name="token" type="password" autocomplete="current-password" /></label>
      <p><button type="submit">Open Wiki</button></p>
    </form>
  </section>
</div>
"""
        return html_page("Read access", body)

    def read_form(self) -> dict[str, list[str]]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8-sig")
        return parse_qs(raw)

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        data = json.loads(raw.decode("utf-8-sig"))
        if not isinstance(data, dict):
            raise ValueError("JSON body must be an object")
        return data

    def send_json(self, status: HTTPStatus, data: Any) -> None:
        self.send_bytes(status, "application/json; charset=utf-8", json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))

    def send_bytes(self, status: HTTPStatus, content_type: str, body: bytes) -> None:
        self.send_response(status.value)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, exc: Exception) -> None:
        if isinstance(exc, FileNotFoundError):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found", "message": str(exc)})
            return
        if isinstance(exc, (ValueError, json.JSONDecodeError, UnicodeDecodeError)):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": type(exc).__name__, "message": str(exc)})
            return
        traceback.print_exc(file=sys.stderr)
        self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": type(exc).__name__, "message": str(exc)})

    def log_message(self, fmt: str, *args: Any) -> None:
        clean_args = list(args)
        if clean_args and isinstance(clean_args[0], str):
            clean_args[0] = re.sub(r"(token=)[^&\s]+", r"\1[redacted]", clean_args[0])
        sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), fmt % tuple(clean_args)))


def main() -> None:
    ensure_dirs()
    if not GRAPH_PATH.exists() or not NOTE_INDEX_PATH.exists():
        refresh_public_indexes()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Personal wiki serving on http://{HOST}:{PORT} data={DATA_DIR}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
