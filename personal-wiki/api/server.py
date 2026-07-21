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
import sqlite3
import subprocess
import threading
import time
import sys
import traceback
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlencode, urlparse

from retrieval import (
    build_structured_chunks,
    estimate_tokens,
    fts_index_text,
    fts_or_query,
    fts_required_query,
    make_context_text,
    matched_snippet,
    query_tokens,
)
from wiki_time import WIKI_TIME_ZONE as DISPLAY_TZ

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
ATOMS_DIR = VAULT_DIR / "20_atoms"
NOTE_CONTENT_DIRS = (NOTES_DIR, ATOMS_DIR)
ARCHIVE_DIR = VAULT_DIR / "90_archive"
PUBLIC_DIR = DATA_DIR / "public"
MANUAL_PATH = APP_DIR / "docs" / "USAGE.md"
GRAPH_PATH = PUBLIC_DIR / "graph-data.json"
NOTE_INDEX_PATH = PUBLIC_DIR / "note-index.json"
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
INTERNAL_NOTE_FIELDS = {"search_text", "wikilinks", "graph_tags"}
PUBLIC_INDEX_SCHEMA_VERSION = 2
SEARCH_CHUNK_SCHEMA_VERSION = 7
EXACT_HEADING_FAST_PATH_MIN_CHARS = 5

SLUG_RE = re.compile(r"[^a-zA-Z0-9\u4e00-\u9fff]+")
WIKILINK_RE = re.compile(r"\[\[([^\]\|#]+)(?:[|#][^\]]*)?\]\]")
WIKILINK_RENDER_RE = re.compile(r"\[\[([^\]\|#]+)(?:#[^\]\|]+)?(?:\|([^\]]+))?\]\]")
MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
TAG_RE = re.compile(r"(?<!\w)#([\w\u4e00-\u9fff-]+)")
SAFE_MARKDOWN_SCHEMES = {"http", "https", "mailto"}
NOTE_RELATION_LINK_THRESHOLD = 0.50
MAX_RELATED_LINKS_PER_NOTE = 8
MAX_RELATION_CONCEPT_FANOUT = max(8, int(os.environ.get("WIKI_MAX_RELATION_CONCEPT_FANOUT", "256")))
MAX_RELATION_CANDIDATES_PER_NOTE = max(8, int(os.environ.get("WIKI_MAX_RELATION_CANDIDATES_PER_NOTE", "128")))
GENERIC_RELATION_TAGS = {
    "auto-ingested",
    "demo",
    "draft",
    "file",
    "hermes",
    "inbox",
    "link",
    "manual",
    "source",
    "telegram",
    "text",
    "web",
    "web-capture",
}


def env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


REQUIRE_API_READ_AUTH = env_flag("WIKI_REQUIRE_API_READ_AUTH", bool(API_TOKEN or READ_TOKEN))
REQUIRE_PAGE_READ_AUTH = env_flag("WIKI_REQUIRE_PAGE_READ_AUTH", bool(API_TOKEN or READ_TOKEN))
TRUST_LOCALHOST_READ_AUTH = env_flag("WIKI_TRUST_LOCALHOST_READ_AUTH", False)
ALLOW_UNAUTHENTICATED_WRITE = env_flag("WIKI_ALLOW_UNAUTHENTICATED_WRITE", False)
PUBLIC_PAGE_READ = env_flag("WIKI_PUBLIC_PAGE_READ", False)
READ_AUTH_COOKIE = "personal_wiki_read"
WIKI_WRITE_LOCK = threading.Lock()
GIT_LOCK = threading.Lock()
PUBLIC_INDEX_REFRESH_LOCK = threading.Lock()
NOTE_INDEX_CACHE_LOCK = threading.Lock()
GRAPH_CACHE_LOCK = threading.Lock()
FILTERED_NOTES_CACHE_LOCK = threading.Lock()
INDEX_REFRESH_CONDITION = threading.Condition()
NOTE_INDEX_CACHE_TTL_SECONDS = float(os.environ.get("WIKI_NOTE_INDEX_CACHE_TTL_SECONDS", "300"))
GRAPH_CACHE_TTL_SECONDS = float(os.environ.get("WIKI_GRAPH_CACHE_TTL_SECONDS", "300"))
FILTERED_NOTES_CACHE_TTL_SECONDS = float(os.environ.get("WIKI_FILTERED_NOTES_CACHE_TTL_SECONDS", "30"))
FILTERED_NOTES_CACHE_MAX_ENTRIES = int(os.environ.get("WIKI_FILTERED_NOTES_CACHE_MAX_ENTRIES", "256"))
WIKI_SEARCH_MAX_CONCURRENCY = int(os.environ.get("WIKI_SEARCH_MAX_CONCURRENCY", "12"))
WIKI_SEARCH_SEMAPHORE = threading.BoundedSemaphore(WIKI_SEARCH_MAX_CONCURRENCY)
INDEX_REFRESH_DEBOUNCE_SECONDS = max(0.05, float(os.environ.get("WIKI_INDEX_REFRESH_DEBOUNCE_SECONDS", "0.35")))
INDEX_REFRESH_POLL_SECONDS = max(10.0, float(os.environ.get("WIKI_INDEX_REFRESH_POLL_SECONDS", "60")))
INDEX_REFRESH_RETRY_SECONDS = max(1.0, float(os.environ.get("WIKI_INDEX_REFRESH_RETRY_SECONDS", "15")))
INDEX_SCAN_YIELD_EVERY = max(1, int(os.environ.get("WIKI_INDEX_SCAN_YIELD_EVERY", "8")))
INDEX_SCAN_YIELD_SECONDS = max(0.0, float(os.environ.get("WIKI_INDEX_SCAN_YIELD_SECONDS", "0.02")))
INDEX_GRAPH_YIELD_EVERY = max(1, int(os.environ.get("WIKI_INDEX_GRAPH_YIELD_EVERY", "32")))
INDEX_GRAPH_YIELD_SECONDS = max(0.0, float(os.environ.get("WIKI_INDEX_GRAPH_YIELD_SECONDS", "0.012")))
INDEX_FTS_YIELD_EVERY = max(1, int(os.environ.get("WIKI_INDEX_FTS_YIELD_EVERY", "1")))
INDEX_FTS_YIELD_SECONDS = max(0.0, float(os.environ.get("WIKI_INDEX_FTS_YIELD_SECONDS", "0.02")))
_NOTE_INDEX_CACHE: dict[str, Any] = {"expires_at": 0.0, "index": None}
_GRAPH_CACHE: dict[str, Any] = {"expires_at": 0.0, "graph": None}
_FILTERED_NOTES_CACHE: dict[tuple[str, str, str, str], tuple[float, list[dict[str, Any]]]] = {}
_INDEX_REFRESH_STATE: dict[str, Any] = {
    "status": "idle",
    "requested_generation": 0,
    "completed_generation": 0,
    "requested_at": "",
    "started_at": "",
    "completed_at": "",
    "reason": "",
    "pending_paths": set(),
    "last_error": "",
    "last_result": {},
    "worker_started": False,
}
_INDEX_REFRESH_THREAD: threading.Thread | None = None
INGESTION_DIR = Path(os.environ.get("WIKI_INGESTION_DIR", str(PUBLIC_DIR / "ingestion"))).resolve()
INGESTION_MANIFEST_PATH = Path(os.environ.get("WIKI_INGEST_MANIFEST_PATH", str(INGESTION_DIR / "wiki_ingest_manifest.jsonl"))).resolve()
INGESTION_AUDIT_PATH = Path(os.environ.get("WIKI_INGEST_AUDIT_PATH", str(INGESTION_DIR / "knowledge_contract_audit_latest.json"))).resolve()
INGESTION_SYNC_PATH = Path(os.environ.get("WIKI_INGEST_SYNC_PATH", str(INGESTION_DIR / "sync-meta.json"))).resolve()
VECTOR_DOCTOR_PATH = Path(os.environ.get("WIKI_VECTOR_DOCTOR_PATH", str(INGESTION_DIR / "wiki_vector_doctor_latest.json"))).resolve()
SEARCH_DB_PATH = Path(
    os.environ.get("WIKI_SEARCH_DB_PATH", str(PUBLIC_DIR / "search" / "wiki_fts_v2.sqlite"))
).resolve()
INDEX_STATE_PATH = Path(os.environ.get("WIKI_INDEX_STATE_PATH", str(PUBLIC_DIR / "index-state.json"))).resolve()


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def cooperative_index_yield(index: int, every: int, seconds: float) -> None:
    if index > 0 and index % every == 0 and seconds > 0:
        time.sleep(seconds)


def ensure_dirs() -> None:
    for path in (DATA_DIR, VAULT_DIR, SOURCES_DIR, NOTES_DIR, ATOMS_DIR, ARCHIVE_DIR, PUBLIC_DIR):
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
    ensure_git_safe_directory()
    if not (DATA_DIR / ".git").exists():
        run(["git", "init"])
    run(["git", "config", "user.name", "Hermes Wiki Bot"])
    run(["git", "config", "user.email", "hermes-wiki@local"])


def ensure_git_safe_directory() -> None:
    safe_dir = str(DATA_DIR)
    current = run(["git", "config", "--global", "--get-all", "safe.directory"])
    safe_dirs = {line.strip() for line in current.stdout.splitlines() if line.strip()}
    if safe_dir not in safe_dirs and "*" not in safe_dirs:
        run(["git", "config", "--global", "--add", "safe.directory", safe_dir])


def git_commit(message: str, include_public: bool = False) -> str:
    if not shutil.which("git") or not (DATA_DIR / ".git").exists():
        return "git unavailable"
    with GIT_LOCK:
        paths = ["vault"]
        if include_public:
            paths.extend(
                str(path.relative_to(DATA_DIR))
                for path in (NOTE_INDEX_PATH, GRAPH_PATH, INDEX_STATE_PATH)
                if path.is_relative_to(DATA_DIR)
            )
        run(["git", "add", *paths])
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
    requested_frontmatter = payload.get("frontmatter") or {}
    if not isinstance(requested_frontmatter, dict):
        requested_frontmatter = {}
    allowed_frontmatter_fields = {
        "title",
        "type",
        "created_by",
        "source_type",
        "tags",
        "created_at",
        "task_id",
        "agent_id",
        "project",
        "last_reviewed",
        "migration",
    }
    frontmatter = {
        key: value
        for key, value in requested_frontmatter.items()
        if key in allowed_frontmatter_fields and value not in (None, "")
    }

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
        "frontmatter": frontmatter,
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
    with WIKI_WRITE_LOCK:
        return ingest_locked(payload)


def ingest_locked(payload: dict[str, Any]) -> dict[str, Any]:
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
    write_text_atomic(note_path, note)
    index_status = schedule_public_index_refresh("ingest", [rel(note_path)])

    return {
        "status": status,
        "id": note_id,
        "title": item["title"],
        "source_hash": source_hash,
        "source_path": rel(source_path),
        "note_path": rel(note_path),
        "url": f"/note?path={quote(rel(note_path), safe='/')}",
        "index_status": index_status["status"],
        "index_generation": index_status["requested_generation"],
        "git": "queued-with-index-refresh",
    }


def find_note_by_source_hash(source_hash: str) -> Path | None:
    source_path = find_source_by_hash(source_hash)
    if source_path is not None:
        try:
            source_record = json.loads(source_path.read_text(encoding="utf-8"))
            note_path = safe_data_path(str(source_record.get("note_path") or ""))
            if note_path.exists() and note_path.suffix == ".md" and note_path_is_active(note_path):
                return note_path
        except (OSError, json.JSONDecodeError, ValueError):
            pass
    index = get_cached_note_index()
    if index is None and NOTE_INDEX_PATH.exists():
        try:
            loaded = json.loads(NOTE_INDEX_PATH.read_text(encoding="utf-8"))
            index = loaded if isinstance(loaded, dict) else None
        except (OSError, json.JSONDecodeError):
            index = None
    for note in (index or {}).get("notes", []):
        if str(note.get("source_hash") or "") != source_hash:
            continue
        try:
            note_path = safe_data_path(str(note.get("path") or ""))
        except ValueError:
            continue
        if note_path.exists() and note_path.suffix == ".md" and note_path_is_active(note_path):
            return note_path
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
    requested_frontmatter = item.get("frontmatter") if isinstance(item.get("frontmatter"), dict) else {}
    requested_tags = normalize_tags(requested_frontmatter.get("tags", []))
    tags = sorted(set(item["tags"] + requested_tags + [item["source_type"], "auto-ingested"]))
    fm = {
        "title": item["title"],
        "created": created.isoformat(),
        "source_type": item["source_type"],
        "source_url": item["source_url"],
        "source_hash": source_hash,
        "tags": tags,
        "status": "auto",
    }
    for key in (
        "title",
        "type",
        "created_by",
        "source_type",
        "created_at",
        "task_id",
        "agent_id",
        "project",
        "last_reviewed",
        "migration",
    ):
        value = requested_frontmatter.get(key)
        if value not in (None, ""):
            fm[key] = value
    fm["tags"] = tags
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


def normalize_concepts(value: Any) -> list[str]:
    if isinstance(value, str):
        value = [part.strip() for part in re.split(r"[,，]", value) if part.strip()]
    if not isinstance(value, list):
        return []
    return sorted({str(item).strip() for item in value if str(item).strip()})


def normalize_concept_scores(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in value:
        if isinstance(item, dict):
            label = str(item.get("label") or item.get("name") or item.get("concept") or "").strip()
            raw_score = item.get("score", item.get("relevance", 0))
            concept_id = str(item.get("id") or "").strip()
        else:
            label = str(item).strip()
            raw_score = 0
            concept_id = ""
        if not label or label in seen:
            continue
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            score = 0.0
        score = max(0.0, min(1.0, score))
        row: dict[str, Any] = {"label": label, "score": round(score, 3)}
        if concept_id:
            row["id"] = concept_id
        rows.append(row)
        seen.add(label)
    return rows


def concept_score_lookup(rows: list[dict[str, Any]]) -> dict[str, float]:
    return {str(row.get("label") or "").strip(): float(row.get("score") or 0) for row in rows if str(row.get("label") or "").strip()}


def read_note_record(path: Path, include_body: bool = False) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)
    title = note_title(path, body, fm)
    tags = normalize_tags(fm.get("tags", []))
    created_value = note_created_value(fm)
    body_concepts = extract_concepts(body)
    body_tags = sorted({str(tag).strip().lstrip("#") for tag in TAG_RE.findall(body) if str(tag).strip()})
    fm_concepts = normalize_concepts(fm.get("concepts", []))
    concept_scores = normalize_concept_scores(fm.get("concept_scores", []))
    score_labels = {
        str(row.get("label") or "").strip()
        for row in concept_scores
        if str(row.get("label") or "").strip()
    }
    if concept_scores:
        # v3 controlled taxonomy: public concept facets and AI retrieval use scored
        # controlled concepts only. Body wikilinks still become graph wikilink
        # edges, but they must not pollute /api/concepts counts.
        concepts = sorted(score_labels)
    else:
        concepts = sorted(set(body_concepts) | set(fm_concepts))
    record = {
        "title": title,
        "path": rel(path),
        "created": format_date(created_value),
        "created_sort": note_sort_value(created_value),
        "quality_status": str(fm.get("quality_status", "") or fm.get("status", "") or ""),
        "agent_id": str(fm.get("agent_id", "") or ""),
        "task_id": str(fm.get("task_id", "") or ""),
        "source_type": str(fm.get("source_type", "") or ""),
        "source_url": str(fm.get("source_url", "") or ""),
        "source_hash": str(fm.get("source_hash", "") or ""),
        "status": str(fm.get("status", "") or ""),
        "tags": tags,
        "concepts": concepts,
        "concept_scores": concept_scores,
        "wikilinks": body_concepts,
        "graph_tags": body_tags,
        "excerpt": plain_excerpt(body),
        "search_text": plain_search_text(body),
    }
    if include_body:
        record["body"] = body
    return record


def read_note_records(include_body: bool = False, throttle: bool = False) -> list[dict[str, Any]]:
    ensure_dirs_no_git()
    records: list[dict[str, Any]] = []
    for index, path in enumerate(iter_note_paths()):
        records.append(read_note_record(path, include_body=include_body))
        if throttle:
            cooperative_index_yield(index, INDEX_SCAN_YIELD_EVERY, INDEX_SCAN_YIELD_SECONDS)
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


def build_note_index(
    records: list[dict[str, Any]],
    signature: str | None = None,
    generation: str = "",
) -> dict[str, Any]:
    public_notes = [{key: value for key, value in record.items() if key != "body"} for record in records]
    return {
        "schema_version": PUBLIC_INDEX_SCHEMA_VERSION,
        "index_generation": generation,
        "generated_at": now_utc().isoformat(),
        "vault_signature": signature if signature is not None else vault_signature(),
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


def clear_note_caches() -> None:
    with NOTE_INDEX_CACHE_LOCK:
        _NOTE_INDEX_CACHE["expires_at"] = 0.0
        _NOTE_INDEX_CACHE["index"] = None
    with GRAPH_CACHE_LOCK:
        _GRAPH_CACHE["expires_at"] = 0.0
        _GRAPH_CACHE["graph"] = None
    with FILTERED_NOTES_CACHE_LOCK:
        _FILTERED_NOTES_CACHE.clear()


def get_cached_note_index() -> dict[str, Any] | None:
    now = time.monotonic()
    with NOTE_INDEX_CACHE_LOCK:
        cached = _NOTE_INDEX_CACHE.get("index")
        expires_at = float(_NOTE_INDEX_CACHE.get("expires_at") or 0.0)
        if isinstance(cached, dict) and expires_at > now:
            return cached
    return None


def set_cached_note_index(index: dict[str, Any]) -> None:
    with NOTE_INDEX_CACHE_LOCK:
        _NOTE_INDEX_CACHE["index"] = index
        _NOTE_INDEX_CACHE["expires_at"] = time.monotonic() + NOTE_INDEX_CACHE_TTL_SECONDS


def get_cached_graph() -> dict[str, Any] | None:
    now = time.monotonic()
    with GRAPH_CACHE_LOCK:
        cached = _GRAPH_CACHE.get("graph")
        expires_at = float(_GRAPH_CACHE.get("expires_at") or 0.0)
        if isinstance(cached, dict) and expires_at > now:
            return cached
    return None


def set_cached_graph(graph: dict[str, Any]) -> None:
    with GRAPH_CACHE_LOCK:
        _GRAPH_CACHE["graph"] = graph
        _GRAPH_CACHE["expires_at"] = time.monotonic() + GRAPH_CACHE_TTL_SECONDS


def get_cached_filtered_notes(key: tuple[str, str, str, str]) -> list[dict[str, Any]] | None:
    now = time.monotonic()
    with FILTERED_NOTES_CACHE_LOCK:
        cached = _FILTERED_NOTES_CACHE.get(key)
        if not cached:
            return None
        expires_at, notes = cached
        if expires_at <= now:
            _FILTERED_NOTES_CACHE.pop(key, None)
            return None
        return notes


def set_cached_filtered_notes(key: tuple[str, str, str, str], notes: list[dict[str, Any]]) -> None:
    with FILTERED_NOTES_CACHE_LOCK:
        _FILTERED_NOTES_CACHE[key] = (time.monotonic() + FILTERED_NOTES_CACHE_TTL_SECONDS, notes)
        while len(_FILTERED_NOTES_CACHE) > FILTERED_NOTES_CACHE_MAX_ENTRIES:
            oldest = next(iter(_FILTERED_NOTES_CACHE), None)
            if oldest is None:
                break
            _FILTERED_NOTES_CACHE.pop(oldest, None)


def vault_signature() -> str:
    digest = hashlib.sha256()
    if not any(root.exists() for root in NOTE_CONTENT_DIRS):
        return digest.hexdigest()
    for path in sorted(iter_note_paths()):
        try:
            stat = path.stat()
        except OSError:
            continue
        digest.update(rel(path).encode("utf-8", errors="replace"))
        digest.update(str(stat.st_mtime_ns).encode("ascii"))
        digest.update(str(stat.st_size).encode("ascii"))
    return digest.hexdigest()


def fresh_public_indexes() -> dict[str, Any] | None:
    if not NOTE_INDEX_PATH.exists() or not GRAPH_PATH.exists():
        return None
    try:
        index = json.loads(NOTE_INDEX_PATH.read_text(encoding="utf-8"))
        graph = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    index_generation = str(index.get("index_generation") or "")
    graph_generation = str(graph.get("index_generation") or "")
    if int(index.get("schema_version") or 0) != PUBLIC_INDEX_SCHEMA_VERSION:
        return None
    if int(graph.get("schema_version") or 0) != PUBLIC_INDEX_SCHEMA_VERSION:
        return None
    if not index_generation or index_generation != graph_generation:
        return None
    if str(index.get("vault_signature") or "") != str(graph.get("vault_signature") or ""):
        return None
    return {"index": index, "graph": graph}


def note_path_is_active(path: Path) -> bool:
    resolved = path.resolve()
    return any(
        resolved == root.resolve() or root.resolve() in resolved.parents
        for root in NOTE_CONTENT_DIRS
    )


def incremental_note_records(
    existing_index: dict[str, Any],
    changed_paths: list[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str], list[dict[str, Any]]]:
    records_by_path = {
        str(record.get("path") or ""): dict(record)
        for record in existing_index.get("notes", [])
        if str(record.get("path") or "")
    }
    changed_records: list[dict[str, Any]] = []
    removed_paths: list[str] = []
    prior_records: list[dict[str, Any]] = []
    for relative_path in sorted(set(changed_paths)):
        path = safe_data_path(relative_path)
        normalized_path = rel(path)
        prior = records_by_path.get(normalized_path)
        if prior is not None:
            prior_records.append(dict(prior))
        if path.exists() and path.suffix == ".md" and note_path_is_active(path):
            record = read_note_record(path, include_body=True)
            records_by_path[normalized_path] = record
            changed_records.append(record)
        else:
            records_by_path.pop(normalized_path, None)
            removed_paths.append(normalized_path)
    records = list(records_by_path.values())
    records.sort(key=lambda item: item.get("created_sort", 0), reverse=True)
    return records, changed_records, removed_paths, prior_records


def refresh_public_indexes(
    force: bool = False,
    changed_paths: list[str] | None = None,
) -> dict[str, Any]:
    with PUBLIC_INDEX_REFRESH_LOCK:
        existing = fresh_public_indexes()
        if not force:
            if existing is not None:
                set_cached_note_index(existing["index"])
                set_cached_graph(existing["graph"])
                return existing

        with WIKI_WRITE_LOCK:
            if existing is not None and changed_paths:
                records, changed_records, removed_paths, prior_records = incremental_note_records(
                    existing["index"],
                    changed_paths,
                )
                refresh_mode = "incremental"
            else:
                records = read_note_records(include_body=True, throttle=True)
                changed_records = records
                removed_paths = []
                prior_records = []
                refresh_mode = "full"
            signature = vault_signature()
        generation = f"{time.time_ns()}-{signature[:12]}"
        index = build_note_index(records, signature=signature, generation=generation)
        if refresh_mode == "incremental":
            graph = build_graph_incremental(
                records,
                existing["graph"],
                changed_records,
                prior_records,
                removed_paths,
                signature=signature,
                generation=generation,
            )
        else:
            graph = build_graph_from_records(
                records,
                signature=signature,
                generation=generation,
                throttle=True,
            )
        fts = sync_search_index(
            changed_records,
            removed_paths=removed_paths,
            delete_missing=refresh_mode == "full",
            force_repair=refresh_mode == "full",
        )
        write_json(NOTE_INDEX_PATH, index)
        write_json(GRAPH_PATH, graph)
        set_cached_note_index(index)
        set_cached_graph(graph)
        with FILTERED_NOTES_CACHE_LOCK:
            _FILTERED_NOTES_CACHE.clear()
        return {"index": index, "graph": graph, "fts": fts, "refresh_mode": refresh_mode}


def load_note_index() -> dict[str, Any]:
    ensure_dirs_no_git()
    cached = get_cached_note_index()
    if cached is not None:
        return cached
    if not NOTE_INDEX_PATH.exists() or not GRAPH_PATH.exists():
        schedule_public_index_refresh("missing-note-index")
        return {"generated_at": "", "vault_signature": "", "count": 0, "notes": [], "tags": [], "concepts": [], "source_types": []}
    try:
        index = json.loads(NOTE_INDEX_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        schedule_public_index_refresh("invalid-note-index")
        return {"generated_at": "", "vault_signature": "", "count": 0, "notes": [], "tags": [], "concepts": [], "source_types": []}
    if int(index.get("schema_version") or 0) != PUBLIC_INDEX_SCHEMA_VERSION:
        schedule_public_index_refresh("stale-note-index-schema")
    set_cached_note_index(index)
    return index


def load_graph() -> dict[str, Any]:
    ensure_dirs_no_git()
    cached = get_cached_graph()
    if cached is not None:
        return cached
    if not GRAPH_PATH.exists() or not NOTE_INDEX_PATH.exists():
        schedule_public_index_refresh("missing-graph-index")
        return {"generated_at": "", "vault_signature": "", "nodes": [], "links": []}
    try:
        graph = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        schedule_public_index_refresh("invalid-graph-index")
        return {"generated_at": "", "vault_signature": "", "nodes": [], "links": []}
    index = load_note_index()
    if (
        int(graph.get("schema_version") or 0) != PUBLIC_INDEX_SCHEMA_VERSION
        or str(graph.get("index_generation") or "") != str(index.get("index_generation") or "")
        or str(graph.get("vault_signature") or "") != str(index.get("vault_signature") or "")
    ):
        schedule_public_index_refresh("public-index-generation-mismatch")
    set_cached_graph(graph)
    return graph


def filtered_notes(
    query: str = "",
    tag: str = "",
    concept: str = "",
    source_type: str = "",
) -> list[dict[str, Any]]:
    q = query.strip().lower()
    tag = tag.strip().lstrip("#")
    concept = concept.strip()
    source_type = source_type.strip()
    cache_key = (q, tag, concept, source_type)
    cached = get_cached_filtered_notes(cache_key)
    if cached is not None:
        return cached

    acquired = WIKI_SEARCH_SEMAPHORE.acquire(timeout=5)
    if not acquired:
        raise TimeoutError("wiki search concurrency limit reached")
    try:
        index = load_note_index()
        notes = list(index.get("notes", []))

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

        result = [public_note(note) for note in notes if matches(note)]
        set_cached_filtered_notes(cache_key, result)
        return result
    finally:
        WIKI_SEARCH_SEMAPHORE.release()


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


def build_graph_from_records(
    records: list[dict[str, Any]],
    signature: str | None = None,
    generation: str = "",
    throttle: bool = False,
) -> dict[str, Any]:
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

    for record_index, record in enumerate(records):
        title = str(record.get("title", ""))
        node_id = str(record.get("path", ""))
        body = str(record.get("body", ""))
        wikilinks = list(record.get("wikilinks") or WIKILINK_RE.findall(body))
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
            "weight": max(1, len(wikilinks) + len(tags)),
        }
        remember_title(title, node_id)
        remember_title(Path(node_id).stem, node_id)
        if throttle:
            cooperative_index_yield(record_index, INDEX_GRAPH_YIELD_EVERY, INDEX_GRAPH_YIELD_SECONDS)

    def ensure_concept_node(concept: str) -> str:
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
        return target_id

    for record_index, record in enumerate(records):
        body = str(record.get("body", ""))
        source_id = str(record.get("path", ""))
        body_wikilinks = {
            str(target_title).strip()
            for target_title in (record.get("wikilinks") or WIKILINK_RE.findall(body))
            if str(target_title).strip()
        }
        for concept in sorted(body_wikilinks):
            target_id = ensure_concept_node(concept)
            add_link(links, link_keys, source_id, target_id, "wikilink", 2, score=0.9)
        score_map = concept_score_lookup(record.get("concept_scores", []) if isinstance(record.get("concept_scores"), list) else [])
        record_concepts = {str(item).strip() for item in record.get("concepts", []) if str(item).strip()}
        for concept in sorted(record_concepts):
            target_id = ensure_concept_node(concept)
            score = score_map.get(concept, 0.9 if concept in body_wikilinks else 0.6)
            add_link(links, link_keys, source_id, target_id, "concept", max(1, round(score * 4)), score=score)
        fm_tags = record.get("tags") if isinstance(record.get("tags"), list) else []
        body_tags = list(record.get("graph_tags") or TAG_RE.findall(body))
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
            add_link(links, link_keys, source_id, tag_id, "tag", 1, score=0.25)
        if throttle:
            cooperative_index_yield(record_index, INDEX_GRAPH_YIELD_EVERY, INDEX_GRAPH_YIELD_SECONDS)

    add_related_note_links(records, links, link_keys, throttle=throttle)

    return {
        "schema_version": PUBLIC_INDEX_SCHEMA_VERSION,
        "index_generation": generation,
        "generated_at": now_utc().isoformat(),
        "vault_signature": signature if signature is not None else vault_signature(),
        "nodes": list(nodes.values()),
        "links": links,
    }


def build_graph_incremental(
    records: list[dict[str, Any]],
    existing_graph: dict[str, Any],
    changed_records: list[dict[str, Any]],
    prior_records: list[dict[str, Any]],
    removed_paths: list[str],
    signature: str,
    generation: str,
) -> dict[str, Any]:
    record_by_id = {
        str(record.get("path") or ""): record
        for record in records
        if str(record.get("path") or "")
    }
    changed_by_id = {
        str(record.get("path") or ""): record
        for record in changed_records
        if str(record.get("path") or "")
    }
    prior_by_id = {
        str(record.get("path") or ""): record
        for record in prior_records
        if str(record.get("path") or "")
    }
    changed_ids = set(changed_by_id) | set(prior_by_id) | set(removed_paths)

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

    for note_id, record in record_by_id.items():
        remember_title(str(record.get("title") or ""), note_id)
        remember_title(Path(note_id).stem, note_id)

    changed_titles: set[str] = set()
    for record in list(changed_by_id.values()) + list(prior_by_id.values()):
        title = str(record.get("title") or "").strip()
        path = str(record.get("path") or "").strip()
        if title:
            changed_titles.add(title)
        if path:
            changed_titles.add(Path(path).stem)

    content_affected = set(changed_ids)
    if changed_titles:
        for note_id, record in record_by_id.items():
            targets = {
                str(value).strip()
                for value in list(record.get("wikilinks") or []) + list(record.get("concepts") or [])
                if str(value).strip()
            }
            if targets & changed_titles:
                content_affected.add(note_id)

    terms = {note_id: relation_terms(record) for note_id, record in record_by_id.items()}
    concept_postings: dict[str, list[str]] = {}
    for note_id, note_terms in terms.items():
        for concept in note_terms.get("concepts", set()):
            concept_postings.setdefault(concept, []).append(note_id)
    eligible_postings = {
        concept: note_ids
        for concept, note_ids in concept_postings.items()
        if len(note_ids) <= MAX_RELATION_CONCEPT_FANOUT
    }
    seed_concepts: set[str] = set()
    for record in list(changed_by_id.values()) + list(prior_by_id.values()):
        seed_concepts.update(relation_terms(record).get("concepts", set()))
    relation_component = {note_id for note_id in changed_ids if note_id in record_by_id}
    frontier = [note_id for concept in seed_concepts for note_id in eligible_postings.get(concept, [])]
    while frontier:
        note_id = frontier.pop()
        if note_id in relation_component:
            continue
        relation_component.add(note_id)
        for concept in terms.get(note_id, {}).get("concepts", set()):
            frontier.extend(eligible_postings.get(concept, []))
    relation_filter_ids = relation_component | changed_ids

    nodes = {
        str(node.get("id") or ""): dict(node)
        for node in existing_graph.get("nodes", [])
        if str(node.get("id") or "")
    }
    for node_id, node in list(nodes.items()):
        if node.get("kind") == "note" and node_id not in record_by_id:
            nodes.pop(node_id, None)

    links: list[dict[str, Any]] = []
    for link in existing_graph.get("links", []):
        source = str(link.get("source") or "")
        target = str(link.get("target") or "")
        link_type = str(link.get("type") or "")
        if source in changed_ids or target in changed_ids:
            continue
        if link_type == "related" and (source in relation_filter_ids or target in relation_filter_ids):
            continue
        if link_type != "related" and source in content_affected:
            continue
        links.append(dict(link))
    link_keys = {
        (str(link.get("source") or ""), str(link.get("target") or ""), str(link.get("type") or ""))
        for link in links
    }

    def ensure_concept_node(concept: str) -> str:
        target_id = title_to_id.get(concept) or f"concept:{concept}"
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
        return target_id

    throttle_incremental = len(content_affected) > MAX_RELATION_CONCEPT_FANOUT
    for note_index, note_id in enumerate(sorted(content_affected)):
        record = record_by_id.get(note_id)
        if record is None:
            continue
        title = str(record.get("title") or "")
        wikilinks = [str(value).strip() for value in record.get("wikilinks", []) if str(value).strip()]
        tags = list(record.get("tags") or [])
        nodes[note_id] = {
            "id": note_id,
            "label": title,
            "title": title,
            "path": note_id,
            "url": f"/note?path={quote(note_id, safe='/')}",
            "tags": tags,
            "source_type": record.get("source_type", ""),
            "kind": "note",
            "weight": max(1, len(wikilinks) + len(tags)),
        }
        for concept in sorted(set(wikilinks)):
            add_link(links, link_keys, note_id, ensure_concept_node(concept), "wikilink", 2, score=0.9)
        score_map = concept_score_lookup(
            record.get("concept_scores", []) if isinstance(record.get("concept_scores"), list) else []
        )
        for concept in sorted({str(value).strip() for value in record.get("concepts", []) if str(value).strip()}):
            target_id = ensure_concept_node(concept)
            score = score_map.get(concept, 0.9 if concept in wikilinks else 0.6)
            add_link(links, link_keys, note_id, target_id, "concept", max(1, round(score * 4)), score=score)
        graph_tags = {
            str(tag).strip().lstrip("#")
            for tag in list(record.get("tags") or []) + list(record.get("graph_tags") or [])
            if str(tag).strip()
        }
        for tag in sorted(graph_tags):
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
            add_link(links, link_keys, note_id, tag_id, "tag", 1, score=0.25)
        if throttle_incremental:
            cooperative_index_yield(note_index, INDEX_GRAPH_YIELD_EVERY, INDEX_GRAPH_YIELD_SECONDS)

    component_records = [record_by_id[note_id] for note_id in sorted(relation_component) if note_id in record_by_id]
    add_related_note_links(
        component_records,
        links,
        link_keys,
        throttle=len(component_records) > MAX_RELATION_CONCEPT_FANOUT,
    )

    referenced_nodes = {
        str(link.get(field) or "")
        for link in links
        for field in ("source", "target")
        if str(link.get(field) or "")
    }
    for node_id, node in list(nodes.items()):
        if node.get("kind") != "note" and node_id not in referenced_nodes:
            nodes.pop(node_id, None)

    return {
        "schema_version": PUBLIC_INDEX_SCHEMA_VERSION,
        "index_generation": generation,
        "generated_at": now_utc().isoformat(),
        "vault_signature": signature,
        "nodes": list(nodes.values()),
        "links": links,
        "incremental": {
            "changed_notes": len(changed_ids),
            "content_notes": len(content_affected & set(record_by_id)),
            "relation_notes": len(relation_component),
        },
    }


def add_related_note_links(
    records: list[dict[str, Any]],
    links: list[dict[str, Any]],
    link_keys: set[tuple[str, str, str]],
    throttle: bool = False,
) -> None:
    notes = sorted(
        (record for record in records if str(record.get("path", "")).strip()),
        key=lambda record: str(record.get("path", "")),
    )
    terms = {str(record.get("path", "")): relation_terms(record) for record in notes}
    concept_postings: dict[str, list[str]] = {}
    for note_id, note_terms in terms.items():
        for concept in note_terms.get("concepts", set()):
            concept_postings.setdefault(concept, []).append(note_id)

    candidates: list[tuple[float, str, str, dict[str, Any]]] = []
    for note_index, left in enumerate(notes):
        left_id = str(left.get("path", ""))
        left_terms = terms.get(left_id, {})
        candidate_shared_concepts: dict[str, int] = {}
        for concept in left_terms.get("concepts", set()):
            posting = concept_postings.get(concept, [])
            if len(posting) > MAX_RELATION_CONCEPT_FANOUT:
                continue
            for right_id in posting:
                if right_id <= left_id:
                    continue
                candidate_shared_concepts[right_id] = candidate_shared_concepts.get(right_id, 0) + 1

        ranked_ids = sorted(
            candidate_shared_concepts,
            key=lambda right_id: (
                -candidate_shared_concepts[right_id],
                -len((left_terms.get("tags") or set()) & (terms.get(right_id, {}).get("tags") or set())),
                right_id,
            ),
        )[:MAX_RELATION_CANDIDATES_PER_NOTE]
        for right_id in ranked_ids:
            score, reason = note_relation_score(terms.get(left_id, {}), terms.get(right_id, {}))
            if score < NOTE_RELATION_LINK_THRESHOLD:
                continue
            candidates.append((score, left_id, right_id, reason))
        if throttle:
            cooperative_index_yield(note_index, INDEX_GRAPH_YIELD_EVERY, INDEX_GRAPH_YIELD_SECONDS)

    related_counts: dict[str, int] = {}
    for score, left_id, right_id, reason in sorted(candidates, key=lambda item: (-item[0], item[1], item[2])):
        if related_counts.get(left_id, 0) >= MAX_RELATED_LINKS_PER_NOTE:
            continue
        if related_counts.get(right_id, 0) >= MAX_RELATED_LINKS_PER_NOTE:
            continue
        add_link(
            links,
            link_keys,
            left_id,
            right_id,
            "related",
            max(1, round(score * 4)),
            score=score,
            reason=reason,
        )
        related_counts[left_id] = related_counts.get(left_id, 0) + 1
        related_counts[right_id] = related_counts.get(right_id, 0) + 1


def relation_terms(record: dict[str, Any]) -> dict[str, set[str]]:
    concepts = {
        normalize_relation_term(item)
        for item in record.get("concepts", [])
        if normalize_relation_term(item)
    }
    tags = {
        normalize_relation_term(item)
        for item in record.get("tags", [])
        if normalize_relation_term(item) and normalize_relation_term(item) not in GENERIC_RELATION_TAGS
    }
    return {"concepts": concepts, "tags": tags}


def normalize_relation_term(value: Any) -> str:
    return str(value or "").strip().lstrip("#").casefold()


def note_relation_score(
    left: dict[str, set[str]],
    right: dict[str, set[str]],
) -> tuple[float, dict[str, Any]]:
    shared_concepts = sorted((left.get("concepts") or set()) & (right.get("concepts") or set()))
    shared_tags = sorted((left.get("tags") or set()) & (right.get("tags") or set()))
    score = min(0.72, len(shared_concepts) * 0.28)
    if len(shared_concepts) >= 2:
        score += 0.10
    score += min(0.30, len(shared_tags) * 0.12)
    if shared_concepts and shared_tags:
        score += 0.12
    score = min(0.95, score)
    return round(score, 2), {
        "shared_concepts": shared_concepts[:8],
        "shared_tags": shared_tags[:8],
    }


def add_link(
    links: list[dict[str, Any]],
    link_keys: set[tuple[str, str, str]],
    source: str,
    target: str,
    link_type: str,
    weight: int,
    score: float | None = None,
    reason: dict[str, Any] | None = None,
) -> None:
    key = (source, target, link_type)
    if source == target or key in link_keys:
        return
    link_keys.add(key)
    link = {"source": source, "target": target, "type": link_type, "weight": weight}
    if score is not None:
        normalized = max(0.0, min(1.0, score))
        link["score"] = round(normalized, 2)
        link["strength"] = f"{round(normalized * 100)}%"
    if reason:
        link["reason"] = reason
    links.append(link)


def ensure_dirs_no_git() -> None:
    for path in (DATA_DIR, VAULT_DIR, SOURCES_DIR, NOTES_DIR, ATOMS_DIR, ARCHIVE_DIR, PUBLIC_DIR):
        path.mkdir(parents=True, exist_ok=True)


def iter_note_paths() -> list[Path]:
    paths: list[Path] = []
    for root in NOTE_CONTENT_DIRS:
        if root.exists():
            paths.extend(p for p in root.rglob("*.md") if p.is_file())
    return sorted(paths, reverse=True)


def rel(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(DATA_DIR.resolve())).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def safe_data_path(relative: str) -> Path:
    data_root = DATA_DIR.resolve()
    candidate = (data_root / relative).resolve()
    if data_root not in candidate.parents and candidate != data_root:
        raise ValueError("Path is outside data directory")
    return candidate


def write_text_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
    try:
        temporary.write_text(text, encoding="utf-8")
        os.replace(temporary, path)
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


def write_json(path: Path, data: Any) -> None:
    write_text_atomic(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def chunk_search_text(text: str, size: int = 900, overlap: int = 120) -> list[str]:
    """Compatibility wrapper for callers that only need chunk text.

    New indexing uses ``build_structured_chunks`` directly so it can retain
    heading paths and exact source ranges. ``overlap`` is intentionally ignored:
    parent/neighbor expansion now restores context without duplicating every
    chunk in the index.
    """

    del overlap
    return [
        str(chunk["text"])
        for chunk in build_structured_chunks(text, title="", path="", size=size)
    ]


def folded_heading_leaf(value: Any) -> str:
    if isinstance(value, (list, tuple)):
        parts = [str(item).strip() for item in value]
    else:
        try:
            parsed = json.loads(str(value or "[]"))
        except json.JSONDecodeError:
            parsed = []
        parts = [str(item).strip() for item in parsed] if isinstance(parsed, list) else []
    return parts[-1].casefold() if parts and parts[-1] else ""


def _ensure_search_schema_locked(connection: sqlite3.Connection) -> set[str]:
    connection.execute(
        "create table if not exists notes("
        "path text primary key, title text, title_folded text, source_type text, quality_status text, chars integer, sha256 text)"
    )
    connection.execute(
        "create table if not exists chunks("
        "id text primary key, path text, chunk_index integer, title text, text text, chars integer, sha256 text,"
        "section_id text, parent_id text, heading_path text, heading_level integer,"
        "start_char integer, end_char integer, context_text text)"
    )
    connection.execute(
        "create virtual table if not exists chunks_fts using "
        "fts5(title, text, path unindexed, chunk_id unindexed, tokenize='unicode61')"
    )
    connection.execute(
        "create table if not exists heading_lookup("
        "path text not null, section_id text not null, first_chunk_id text not null,"
        "first_chunk_index integer not null, heading_leaf_folded text not null,"
        "primary key(path,section_id)) without rowid"
    )
    columns = {str(row[1]) for row in connection.execute("pragma table_info(notes)").fetchall()}
    additions = {
        "title_folded": "text",
        "status": "text",
        "created": "text",
        "source_url": "text",
        "metadata_json": "text",
        "content_sha256": "text",
        "chunk_schema_version": "integer not null default 0",
    }
    for name, column_type in additions.items():
        if name not in columns:
            connection.execute(f"alter table notes add column {name} {column_type}")
            columns.add(name)
    chunk_columns = {str(row[1]) for row in connection.execute("pragma table_info(chunks)").fetchall()}
    chunk_additions = {
        "section_id": "text",
        "parent_id": "text",
        "heading_path": "text",
        "heading_level": "integer",
        "start_char": "integer",
        "end_char": "integer",
        "context_text": "text",
        "title_folded": "text",
        "heading_text_folded": "text",
    }
    for name, column_type in chunk_additions.items():
        if name not in chunk_columns:
            connection.execute(f"alter table chunks add column {name} {column_type}")
            chunk_columns.add(name)
    connection.execute(
        "create index if not exists chunks_path_index on chunks(path,chunk_index)"
    )
    connection.execute(
        "create index if not exists chunks_section_index on chunks(path,section_id,chunk_index)"
    )
    connection.execute(
        "create index if not exists heading_lookup_leaf_index "
        "on heading_lookup(heading_leaf_folded,path,first_chunk_index)"
    )
    return columns


def ensure_search_schema(connection: sqlite3.Connection) -> set[str]:
    """Migrate the SQLite schema under a cross-process database write lock."""

    connection.execute("begin exclusive")
    try:
        columns = _ensure_search_schema_locked(connection)
        connection.commit()
        return columns
    except Exception:
        connection.rollback()
        raise


def sync_search_index(
    records: list[dict[str, Any]],
    removed_paths: list[str] | None = None,
    delete_missing: bool = True,
    force_repair: bool = False,
) -> dict[str, Any]:
    started = time.monotonic()
    SEARCH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(SEARCH_DB_PATH), timeout=10)
    connection.execute("pragma busy_timeout=10000")
    connection.execute("pragma journal_mode=WAL")
    ensure_search_schema(connection)
    existing = {
        str(path): {
            "note_hash": str(note_hash or ""),
            "content_hash": str(content_hash or ""),
            "chunk_schema_version": int(chunk_schema_version or 0),
        }
        for path, note_hash, content_hash, chunk_schema_version in connection.execute(
            "select path,sha256,content_sha256,chunk_schema_version from notes"
        ).fetchall()
    }
    chunk_counts = {
        str(path): int(count)
        for path, count in connection.execute("select path,count(*) from chunks group by path").fetchall()
    }
    fts_counts = {
        str(path): int(count)
        for path, count in connection.execute("select path,count(*) from chunks_fts group by path").fetchall()
    }
    active_paths: set[str] = set()
    updated_notes = 0
    metadata_updated_notes = 0
    legacy_chunks_reused = 0
    deleted_notes = 0
    written_chunks = 0
    try:
        connection.execute("begin immediate")
        for record_index, record in enumerate(records):
            path = str(record.get("path") or "").strip()
            if not path:
                continue
            active_paths.add(path)
            title = str(record.get("title") or Path(path).stem).strip()
            body = str(record.get("body") or record.get("search_text") or "")
            if not body.strip():
                body = title
            metadata = {
                "created": str(record.get("created") or ""),
                "source_type": str(record.get("source_type") or ""),
                "source_url": str(record.get("source_url") or ""),
                "status": str(record.get("status") or ""),
                "quality_status": str(record.get("quality_status") or ""),
                "tags": list(record.get("tags") or []),
                "concepts": list(record.get("concepts") or []),
            }
            metadata_json = json.dumps(metadata, ensure_ascii=False, sort_keys=True)
            content_hash = hashlib.sha256(
                f"{title}\n{body}\n{metadata_json}".encode("utf-8")
            ).hexdigest()
            body_hash = hashlib.sha256(f"{path}\n{title}\n{body}".encode("utf-8")).hexdigest()
            note_payload = f"{path}\n{title}\n{body}\n{metadata_json}"
            note_hash = hashlib.sha256(note_payload.encode("utf-8")).hexdigest()
            connection.execute(
                "insert into notes(path,title,title_folded,source_type,quality_status,chars,sha256,status,created,source_url,metadata_json,content_sha256,chunk_schema_version) "
                "values(?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(path) do update set "
                "title=excluded.title,title_folded=excluded.title_folded,source_type=excluded.source_type,quality_status=excluded.quality_status,"
                "chars=excluded.chars,sha256=excluded.sha256,status=excluded.status,created=excluded.created,"
                "source_url=excluded.source_url,metadata_json=excluded.metadata_json,content_sha256=excluded.content_sha256,"
                "chunk_schema_version=excluded.chunk_schema_version",
                (
                    path,
                    title,
                    title.casefold(),
                    metadata["source_type"],
                    metadata["quality_status"],
                    len(body),
                    note_hash,
                    metadata["status"],
                    metadata["created"],
                    metadata["source_url"],
                    metadata_json,
                    content_hash,
                    SEARCH_CHUNK_SCHEMA_VERSION,
                ),
            )
            chunks_intact = chunk_counts.get(path, 0) > 0 and chunk_counts.get(path) == fts_counts.get(path)
            existing_row = existing.get(path) or {}
            existing_content_hash = str(existing_row.get("content_hash") or "")
            existing_chunk_schema = int(existing_row.get("chunk_schema_version") or 0)
            legacy_chunks = (
                bool(existing_row)
                and not existing_content_hash
                and chunks_intact
                and existing_chunk_schema == SEARCH_CHUNK_SCHEMA_VERSION
            )
            chunks_current = (
                bool(existing_content_hash)
                and existing_content_hash == content_hash
                and chunks_intact
                and existing_chunk_schema == SEARCH_CHUNK_SCHEMA_VERSION
            )
            if force_repair:
                legacy_chunks = False
                chunks_current = False
            if legacy_chunks or chunks_current:
                if legacy_chunks:
                    legacy_chunks_reused += 1
                if str(existing_row.get("note_hash") or "") != note_hash:
                    metadata_updated_notes += 1
                continue
            connection.execute("delete from heading_lookup where path = ?", (path,))
            connection.execute("delete from chunks_fts where path = ?", (path,))
            connection.execute("delete from chunks where path = ?", (path,))
            chunks = build_structured_chunks(body or title, title=title, path=path)
            indexed_sections: set[str] = set()
            for chunk_index, chunk in enumerate(chunks):
                chunk_text = str(chunk.get("text") or "")
                heading_path = list(chunk.get("heading_path") or [])
                heading_text = " > ".join(str(item) for item in heading_path)
                context_text = make_context_text(title, heading_path, metadata)
                chunk_hash = hashlib.sha256(
                    f"{SEARCH_CHUNK_SCHEMA_VERSION}:{body_hash}:{chunk_index}:{chunk_text}".encode("utf-8")
                ).hexdigest()
                chunk_id = f"{body_hash[:12]}:{chunk_index}"
                connection.execute(
                    "insert into chunks("
                    "id,path,chunk_index,title,text,chars,sha256,section_id,parent_id,heading_path,heading_level,"
                    "start_char,end_char,context_text,title_folded,heading_text_folded) "
                    "values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        chunk_id,
                        path,
                        chunk_index,
                        title,
                        chunk_text,
                        len(chunk_text),
                        chunk_hash,
                        str(chunk.get("section_id") or ""),
                        str(chunk.get("parent_id") or ""),
                        json.dumps(heading_path, ensure_ascii=False),
                        int(chunk.get("heading_level") or 0),
                        int(chunk.get("start_char") or 0),
                        int(chunk.get("end_char") or 0),
                        context_text,
                        title.casefold(),
                        heading_text.casefold(),
                    ),
                )
                connection.execute(
                    "insert into chunks_fts(title,text,path,chunk_id) values(?,?,?,?)",
                    (
                        fts_index_text(
                            " ".join(part for part in [title, " ".join(heading_path)] if part)
                        ),
                        fts_index_text(
                            "\n".join(part for part in [context_text, chunk_text] if part)
                        ),
                        path,
                        chunk_id,
                    ),
                )
                section_id = str(chunk.get("section_id") or "")
                heading_leaf_folded = folded_heading_leaf(heading_path)
                if heading_leaf_folded and section_id and section_id not in indexed_sections:
                    connection.execute(
                        "insert into heading_lookup("
                        "path,section_id,first_chunk_id,first_chunk_index,heading_leaf_folded) "
                        "values(?,?,?,?,?)",
                        (
                            path,
                            section_id,
                            chunk_id,
                            chunk_index,
                            heading_leaf_folded,
                        ),
                    )
                    indexed_sections.add(section_id)
                written_chunks += 1
            updated_notes += 1
            cooperative_index_yield(updated_notes, INDEX_FTS_YIELD_EVERY, INDEX_FTS_YIELD_SECONDS)

        stale_paths = set(removed_paths or [])
        if delete_missing:
            stale_paths.update(set(existing) - active_paths)
        stale_paths.difference_update(active_paths)
        stale_paths = sorted(stale_paths)
        for stale_index, path in enumerate(stale_paths):
            connection.execute("delete from heading_lookup where path = ?", (path,))
            connection.execute("delete from chunks_fts where path = ?", (path,))
            connection.execute("delete from chunks where path = ?", (path,))
            connection.execute("delete from notes where path = ?", (path,))
            deleted_notes += 1
            cooperative_index_yield(stale_index, INDEX_FTS_YIELD_EVERY, INDEX_FTS_YIELD_SECONDS)
        connection.commit()
        total_notes = int(connection.execute("select count(*) from notes").fetchone()[0])
        total_chunks = int(connection.execute("select count(*) from chunks").fetchone()[0])
        total_headings = int(connection.execute("select count(*) from heading_lookup").fetchone()[0])
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "status": "ok",
        "notes": total_notes,
        "chunks": total_chunks,
        "headings": total_headings,
        "updated_notes": updated_notes,
        "metadata_updated_notes": metadata_updated_notes,
        "legacy_chunks_reused": legacy_chunks_reused,
        "deleted_notes": deleted_notes,
        "written_chunks": written_chunks,
        "duration_ms": round((time.monotonic() - started) * 1000, 1),
    }


def index_state_snapshot_locked() -> dict[str, Any]:
    worker_alive = bool(_INDEX_REFRESH_THREAD and _INDEX_REFRESH_THREAD.is_alive())
    return {
        "status": str(_INDEX_REFRESH_STATE.get("status") or "idle"),
        "worker_started": bool(_INDEX_REFRESH_STATE.get("worker_started")),
        "worker_alive": worker_alive,
        "requested_generation": int(_INDEX_REFRESH_STATE.get("requested_generation") or 0),
        "completed_generation": int(_INDEX_REFRESH_STATE.get("completed_generation") or 0),
        "requested_at": str(_INDEX_REFRESH_STATE.get("requested_at") or ""),
        "started_at": str(_INDEX_REFRESH_STATE.get("started_at") or ""),
        "completed_at": str(_INDEX_REFRESH_STATE.get("completed_at") or ""),
        "reason": str(_INDEX_REFRESH_STATE.get("reason") or ""),
        "pending_paths": sorted(str(path) for path in (_INDEX_REFRESH_STATE.get("pending_paths") or set())),
        "last_error": str(_INDEX_REFRESH_STATE.get("last_error") or ""),
        "last_signature": str(_INDEX_REFRESH_STATE.get("last_signature") or ""),
        "last_result": dict(_INDEX_REFRESH_STATE.get("last_result") or {}),
    }


def get_index_status() -> dict[str, Any]:
    with INDEX_REFRESH_CONDITION:
        should_restart = bool(_INDEX_REFRESH_STATE.get("worker_started")) and not bool(
            _INDEX_REFRESH_THREAD and _INDEX_REFRESH_THREAD.is_alive()
        )
    if should_restart:
        start_index_worker()
    with INDEX_REFRESH_CONDITION:
        return index_state_snapshot_locked()


def persist_index_state_locked() -> bool:
    try:
        write_json(INDEX_STATE_PATH, index_state_snapshot_locked())
        return True
    except OSError as exc:
        _INDEX_REFRESH_STATE["last_error"] = f"index-state-write: {type(exc).__name__}: {exc}"
        return False


def schedule_public_index_refresh(reason: str, changed_paths: list[str] | tuple[str, ...] | None = None) -> dict[str, Any]:
    normalized_paths = {str(path).strip() for path in (changed_paths or []) if str(path).strip()}
    with INDEX_REFRESH_CONDITION:
        _INDEX_REFRESH_STATE["requested_generation"] = int(_INDEX_REFRESH_STATE.get("requested_generation") or 0) + 1
        pending_paths = _INDEX_REFRESH_STATE.setdefault("pending_paths", set())
        if not isinstance(pending_paths, set):
            pending_paths = set(pending_paths)
            _INDEX_REFRESH_STATE["pending_paths"] = pending_paths
        pending_paths.update(normalized_paths)
        _INDEX_REFRESH_STATE["status"] = "queued"
        _INDEX_REFRESH_STATE["requested_at"] = now_utc().isoformat()
        _INDEX_REFRESH_STATE["reason"] = reason
        _INDEX_REFRESH_STATE["last_error"] = ""
        persist_index_state_locked()
        snapshot = index_state_snapshot_locked()
        INDEX_REFRESH_CONDITION.notify_all()
        return snapshot


def read_index_signature() -> str:
    cached = get_cached_note_index()
    if cached is not None:
        return str(cached.get("vault_signature") or "")
    try:
        index = json.loads(NOTE_INDEX_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ""
    return str(index.get("vault_signature") or "")


def search_index_note_count() -> int:
    if not SEARCH_DB_PATH.exists():
        return 0
    try:
        connection = sqlite3.connect(str(SEARCH_DB_PATH), timeout=2)
        count = int(connection.execute("select count(*) from notes").fetchone()[0])
        connection.close()
        return count
    except (OSError, sqlite3.Error, TypeError, ValueError):
        return 0


def search_index_schema_ready(connection: sqlite3.Connection) -> bool:
    note_columns = {
        str(row[1]) for row in connection.execute("pragma table_info(notes)").fetchall()
    }
    chunk_columns = {
        str(row[1]) for row in connection.execute("pragma table_info(chunks)").fetchall()
    }
    heading_lookup_columns = {
        str(row[1])
        for row in connection.execute("pragma table_info(heading_lookup)").fetchall()
    }
    heading_lookup_indexes = {
        str(row[1])
        for row in connection.execute("pragma index_list(heading_lookup)").fetchall()
    }
    required_chunk_columns = {
        "section_id",
        "parent_id",
        "heading_path",
        "heading_level",
        "start_char",
        "end_char",
        "context_text",
        "title_folded",
        "heading_text_folded",
    }
    return {
        "chunk_schema_version",
        "title_folded",
    }.issubset(note_columns) and required_chunk_columns.issubset(chunk_columns) and {
        "path",
        "section_id",
        "first_chunk_id",
        "first_chunk_index",
        "heading_leaf_folded",
    }.issubset(heading_lookup_columns) and "heading_lookup_leaf_index" in heading_lookup_indexes


def search_index_healthy(expected_notes: int) -> bool:
    if not SEARCH_DB_PATH.exists():
        return expected_notes == 0
    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(str(SEARCH_DB_PATH), timeout=2)
        connection.execute("pragma busy_timeout=2000")
        connection.create_function(
            "folded_heading_leaf",
            1,
            folded_heading_leaf,
            deterministic=True,
        )
        if not search_index_schema_ready(connection):
            return False
        notes = int(connection.execute("select count(*) from notes").fetchone()[0])
        chunks = int(connection.execute("select count(*) from chunks").fetchone()[0])
        fts_chunks = int(connection.execute("select count(*) from chunks_fts").fetchone()[0])
        headings = int(connection.execute("select count(*) from heading_lookup").fetchone()[0])
        expected_headings = int(
            connection.execute(
                "select count(*) from ("
                "select path,section_id from chunks "
                "where folded_heading_leaf(heading_path) <> '' group by path,section_id)"
            ).fetchone()[0]
        )
        stale_notes = int(
            connection.execute(
                "select count(*) from notes where coalesce(chunk_schema_version,0) != ?",
                (SEARCH_CHUNK_SCHEMA_VERSION,),
            ).fetchone()[0]
        )
        notes_without_chunks = int(
            connection.execute(
                "select count(*) from notes n left join chunks c on c.path=n.path where c.id is null"
            ).fetchone()[0]
        )
        orphan_chunks = int(
            connection.execute(
                "select count(*) from chunks c left join notes n on n.path=c.path where n.path is null"
            ).fetchone()[0]
        )
        invalid_headings = int(
            connection.execute(
                "select count(*) from heading_lookup h "
                "left join chunks c on c.id=h.first_chunk_id "
                "left join ("
                "select path,section_id,min(chunk_index) as first_chunk_index from chunks "
                "where folded_heading_leaf(heading_path) <> '' group by path,section_id"
                ") expected on expected.path=h.path and expected.section_id=h.section_id "
                "where c.id is null or c.path <> h.path or c.section_id <> h.section_id "
                "or c.chunk_index <> h.first_chunk_index or expected.path is null "
                "or expected.first_chunk_index <> h.first_chunk_index "
                "or h.heading_leaf_folded <> folded_heading_leaf(c.heading_path)"
            ).fetchone()[0]
        )
        chunk_ids = {
            str(row[0]) for row in connection.execute("select id from chunks").fetchall()
        }
        fts_chunk_ids = {
            str(row[0])
            for row in connection.execute("select chunk_id from chunks_fts").fetchall()
        }
        return (
            notes == expected_notes
            and chunks == fts_chunks
            and headings == expected_headings
            and (notes == 0 or chunks >= notes)
            and stale_notes == 0
            and notes_without_chunks == 0
            and orphan_chunks == 0
            and invalid_headings == 0
            and chunk_ids == fts_chunk_ids
        )
    except (OSError, sqlite3.Error, TypeError, ValueError):
        return False
    finally:
        if connection is not None:
            connection.close()


def index_worker_loop() -> None:
    while True:
        pending_paths: list[str] = []
        try:
            with INDEX_REFRESH_CONDITION:
                requested = int(_INDEX_REFRESH_STATE.get("requested_generation") or 0)
                completed = int(_INDEX_REFRESH_STATE.get("completed_generation") or 0)
                if requested <= completed:
                    INDEX_REFRESH_CONDITION.wait(timeout=INDEX_REFRESH_POLL_SECONDS)
                    requested = int(_INDEX_REFRESH_STATE.get("requested_generation") or 0)
                    completed = int(_INDEX_REFRESH_STATE.get("completed_generation") or 0)

            if requested <= completed:
                current_signature = vault_signature()
                indexed_signature = str(_INDEX_REFRESH_STATE.get("last_signature") or "") or read_index_signature()
                if current_signature != indexed_signature:
                    schedule_public_index_refresh("external-vault-change")
                continue

            while True:
                with INDEX_REFRESH_CONDITION:
                    observed_generation = int(_INDEX_REFRESH_STATE.get("requested_generation") or 0)
                    INDEX_REFRESH_CONDITION.wait(timeout=INDEX_REFRESH_DEBOUNCE_SECONDS)
                    latest_generation = int(_INDEX_REFRESH_STATE.get("requested_generation") or 0)
                    if latest_generation != observed_generation:
                        continue
                    target_generation = latest_generation
                    pending_paths = sorted(str(path) for path in (_INDEX_REFRESH_STATE.get("pending_paths") or set()))
                    _INDEX_REFRESH_STATE["pending_paths"] = set()
                    _INDEX_REFRESH_STATE["status"] = "running"
                    _INDEX_REFRESH_STATE["started_at"] = now_utc().isoformat()
                    persist_index_state_locked()
                    break

            public = refresh_public_indexes(force=True, changed_paths=pending_paths)
            full_repair = False
            expected_notes = int(public["index"].get("count") or 0)
            if not search_index_healthy(expected_notes):
                public = refresh_public_indexes(force=True, changed_paths=None)
                full_repair = True
                expected_notes = int(public["index"].get("count") or 0)
            if not search_index_healthy(expected_notes):
                raise RuntimeError("search index remained unhealthy after full repair")
            result = {
                "notes": int(public["index"].get("count") or 0),
                "graph_nodes": len(public["graph"].get("nodes") or []),
                "graph_links": len(public["graph"].get("links") or []),
                "fts": dict(public.get("fts") or {}),
                "changed_paths": len(pending_paths),
                "refresh_mode": str(public.get("refresh_mode") or "full"),
                "full_repair": full_repair,
                "graph_incremental": dict(public["graph"].get("incremental") or {}),
            }
            with INDEX_REFRESH_CONDITION:
                _INDEX_REFRESH_STATE["completed_generation"] = target_generation
                _INDEX_REFRESH_STATE["completed_at"] = now_utc().isoformat()
                _INDEX_REFRESH_STATE["last_signature"] = str(public["index"].get("vault_signature") or "")
                _INDEX_REFRESH_STATE["last_result"] = result
                _INDEX_REFRESH_STATE["last_error"] = ""
                if int(_INDEX_REFRESH_STATE.get("requested_generation") or 0) > target_generation:
                    _INDEX_REFRESH_STATE["status"] = "queued"
                else:
                    _INDEX_REFRESH_STATE["status"] = "idle"
                persist_index_state_locked()
            git_commit("index: background refresh", include_public=True)
        except Exception as exc:
            with INDEX_REFRESH_CONDITION:
                _INDEX_REFRESH_STATE["status"] = "failed"
                _INDEX_REFRESH_STATE["last_error"] = f"{type(exc).__name__}: {exc}"
                persist_index_state_locked()
            time.sleep(INDEX_REFRESH_RETRY_SECONDS)
            schedule_public_index_refresh("retry-after-failure", pending_paths)


def start_index_worker() -> None:
    global _INDEX_REFRESH_THREAD
    public_pair = fresh_public_indexes()
    indexed_signature = str((public_pair or {}).get("index", {}).get("vault_signature") or "")
    with INDEX_REFRESH_CONDITION:
        if _INDEX_REFRESH_THREAD is not None and _INDEX_REFRESH_THREAD.is_alive():
            return
        _INDEX_REFRESH_STATE["worker_started"] = True
        _INDEX_REFRESH_STATE["last_signature"] = indexed_signature
        thread = threading.Thread(target=index_worker_loop, name="wiki-index-worker", daemon=True)
        _INDEX_REFRESH_THREAD = thread
        thread.start()

    note_count = int(load_note_index().get("count") or 0)
    if public_pair is None:
        schedule_public_index_refresh("startup-public-index-mismatch")
    elif vault_signature() != indexed_signature:
        schedule_public_index_refresh("startup-vault-signature-mismatch")
    elif not search_index_healthy(note_count):
        schedule_public_index_refresh("search-index-coverage-mismatch")


def public_note(note: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in note.items() if key not in INTERNAL_NOTE_FIELDS}


def list_notes() -> list[dict[str, Any]]:
    return [public_note(note) for note in load_note_index().get("notes", [])]


def parse_datetime_value(value: Any) -> dt.datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed


def format_date(value: Any) -> str:
    parsed = parse_datetime_value(value)
    if parsed is None:
        raw = str(value or "").strip()
        return raw[:16]
    return parsed.astimezone(DISPLAY_TZ).strftime("%Y-%m-%d %H:%M CST")


def note_created_value(fm: dict[str, Any]) -> Any:
    return fm.get("created_at") or fm.get("created") or fm.get("updated") or ""


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
    index_status = schedule_public_index_refresh("manual-rebuild")
    return {
        "status": "queued",
        "index_status": index_status["status"],
        "index_generation": index_status["requested_generation"],
        "git": "queued-with-index-refresh",
    }


def resolve_note_path(relative_path: str) -> Path:
    raw = str(relative_path or "").strip().lstrip("/")
    candidates = [raw]
    if raw and not raw.startswith("vault/"):
        candidates.append("vault/" + raw)
    for candidate in candidates:
        path = safe_data_path(candidate)
        if path.exists() and path.suffix == ".md":
            return path
    return safe_data_path(raw)


def read_note(relative_path: str) -> dict[str, Any]:
    path = resolve_note_path(relative_path)
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
    path = resolve_note_path(relative_path)
    fm = dict(note["frontmatter"])
    title = str(payload.get("title") or note["title"]).strip() or "Untitled source"
    has_body_update = "content" in payload or "body" in payload
    content = payload_text(payload, ("content", "body"), str(note["raw_body"]) if not has_body_update else str(note["content"]))
    tags = payload.get("tags", fm.get("tags", []))
    fm["title"] = title
    fm["tags"] = normalize_tags(tags)
    fm["updated"] = now_utc().isoformat()
    write_text_atomic(path, render_note_document(title, content, fm))
    index_status = schedule_public_index_refresh("update-note", [rel(path)])
    return {
        "status": "updated",
        "path": rel(path),
        "url": f"/note?path={quote(rel(path), safe='/')}",
        "index_status": index_status["status"],
        "index_generation": index_status["requested_generation"],
        "git": "queued-with-index-refresh",
    }


def tag_note(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_dirs()
    relative_path = str(payload.get("path") or "").strip()
    note = read_note(relative_path)
    path = resolve_note_path(relative_path)
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
    write_text_atomic(path, render_note_document(title, str(note["raw_body"]).strip(), fm))
    index_status = schedule_public_index_refresh("tag-note", [rel(path)])
    return {
        "status": "tagged",
        "path": rel(path),
        "tags": fm["tags"],
        "index_status": index_status["status"],
        "index_generation": index_status["requested_generation"],
        "git": "queued-with-index-refresh",
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
        write_text_atomic(path, prefix + next_body)
        replacements += count
        changed.append({"path": rel(path), "replacements": count})

    index_status = schedule_public_index_refresh(
        "relink-notes",
        [str(item["path"]) for item in changed],
    )
    return {
        "status": "relinked",
        "from": old,
        "to": new,
        "changed": changed,
        "replacements": replacements,
        "index_status": index_status["status"],
        "index_generation": index_status["requested_generation"],
        "git": "queued-with-index-refresh",
    }


def archive_note(payload: dict[str, Any], action: str = "archived") -> dict[str, Any]:
    ensure_dirs()
    relative_path = str(payload.get("path") or "").strip()
    path = resolve_note_path(relative_path)
    if not path.exists() or path.suffix != ".md":
        raise FileNotFoundError(relative_path)
    archive_dir = ARCHIVE_DIR / now_utc().strftime("%Y-%m-%d")
    archive_dir.mkdir(parents=True, exist_ok=True)
    target = unique_path(archive_dir / path.name)
    path.replace(target)
    index_status = schedule_public_index_refresh(action, [relative_path])
    return {
        "status": action,
        "from": relative_path,
        "archive_path": rel(target),
        "index_status": index_status["status"],
        "index_generation": index_status["requested_generation"],
        "git": "queued-with-index-refresh",
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
    .nav-links {{ display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; }}
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
    .dashboard-grid {{ display:grid; grid-template-columns:repeat(4,minmax(150px,1fr)); gap:12px; margin:14px 0 18px; }}
    .metric {{ border:1px solid var(--line); border-radius:8px; background:#fff; padding:14px; }}
    .metric strong {{ display:block; font-size:26px; line-height:1.1; color:#101828; }}
    .metric span {{ color:var(--muted); font-size:13px; }}
    .table-wrap {{ overflow:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }}
    table.data-table {{ width:100%; border-collapse:collapse; min-width:920px; }}
    .data-table th, .data-table td {{ border-bottom:1px solid #e8edf4; padding:10px 11px; text-align:left; vertical-align:top; font-size:13px; }}
    .data-table th {{ background:#f6f8fb; color:#344054; font-weight:800; position:sticky; top:0; z-index:1; }}
    .data-table code {{ background:#eef2f7; padding:2px 4px; border-radius:4px; font-size:12px; overflow-wrap:anywhere; }}
    .pill {{ display:inline-flex; align-items:center; min-height:24px; padding:2px 7px; border-radius:999px; font-size:12px; font-weight:800; border:1px solid #dbe4f0; background:#f8fafc; color:#344054; }}
    .pill-pass, .pill-true {{ border-color:#b8e3cc; background:#ecfdf3; color:#087443; }}
    .pill-review {{ border-color:#fedf89; background:#fffaeb; color:#93370d; }}
    .pill-fail, .pill-false {{ border-color:#fecaca; background:#fff1f2; color:#b42318; }}
    .warning-list {{ display:grid; gap:8px; margin-top:12px; }}
    .warning-item {{ border:1px solid #fedf89; background:#fffcf5; border-radius:8px; padding:10px 12px; }}
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
    top_tags = render_facet_links("常用标签", index.get("tags", []), "tag", 10) + '<p class="muted"><a href="/tags">查看全部标签</a></p>'
    top_concepts = render_facet_links("概念入口", index.get("concepts", []), "concept", 10) + '<p class="muted"><a href="/concepts">查看全部概念</a></p>'

    body = f"""
<div class="topbar">
  <div>
    <div class="eyebrow">Hermes 自动入库</div>
    <h1>{html.escape(SITE_TITLE)}</h1>
    <p class="muted">链接、文件、语音转文字和零散想法都会先进 Vault，再在这里变成可浏览的手册。</p>
  </div>
  <div class="top-actions">
    <form class="search" action="/notes" method="get"><input name="q" type="search" placeholder="搜索全部笔记、标签、概念" aria-label="搜索全部笔记、标签、概念"></form>
    <div class="nav-links"><a class="button-link" href="/ingestion">入库面板</a><a class="button-link" href="/notes">全部笔记</a><a class="button-link" href="/tags">全部标签</a><a class="button-link" href="/concepts">全部概念</a></div>
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
        const desired = link.type === "tag"
          ? Math.max(118, span * 0.24)
          : link.type === "related"
            ? Math.max(94, span * 0.18)
            : Math.max(78, span * 0.15);
        const strength = (link.type === "tag" ? 0.010 : link.type === "related" ? 0.018 : 0.028) * Number(link.weight || 1);
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
      const relationScore = Number(link.score || (link.type === "tag" ? 0.25 : link.type === "related" ? 0.5 : 0.9));
      const opacity = link.type === "tag" ? "0.30" : String(Math.min(0.78, Math.max(0.34, 0.26 + relationScore * 0.5)));
      const el = svgEl("path", {{
        d: linkPath(source, target, index, link.type),
        class: "link-line",
        "data-source": String(link.source),
        "data-target": String(link.target),
        opacity: opacity
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


def safe_public_path(path: Path) -> Path:
    candidate = path.resolve()
    allowed_roots = [PUBLIC_DIR.resolve(), INGESTION_DIR.resolve()]
    for root in allowed_roots:
        if candidate == root or root in candidate.parents:
            return candidate
    raise ValueError("ingestion path is outside public directory")


def read_json_file(path: Path) -> Any:
    try:
        safe = safe_public_path(path)
        if not safe.exists():
            return None
        return json.loads(safe.read_text(encoding="utf-8-sig"))
    except Exception:
        return None


def parse_jsonl_lines(lines: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in lines:
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(item, dict):
            rows.append(item)
    return rows


def read_jsonl_tail(path: Path, limit: int = 200) -> list[dict[str, Any]]:
    try:
        safe = safe_public_path(path)
        if not safe.exists():
            return []
        lines = safe.read_text(encoding="utf-8-sig", errors="ignore").splitlines()[-limit:]
    except Exception:
        return []
    return parse_jsonl_lines(lines)


def read_jsonl_stats(path: Path) -> dict[str, Any]:
    try:
        safe = safe_public_path(path)
        if not safe.exists():
            return {"count": 0, "ok_count": 0, "fail_count": 0, "latest_ts": ""}
        rows = parse_jsonl_lines(safe.read_text(encoding="utf-8-sig", errors="ignore").splitlines())
    except Exception:
        return {"count": 0, "ok_count": 0, "fail_count": 0, "latest_ts": ""}
    return {
        "count": len(rows),
        "ok_count": sum(1 for item in rows if item.get("ok") is True),
        "fail_count": sum(1 for item in rows if item.get("ok") is False),
        "latest_ts": max((str(item.get("ts") or "") for item in rows), default=""),
    }


def load_ingestion_dashboard() -> dict[str, Any]:
    # Load only recent rows for table rendering, but compute headline metrics from
    # the full manifest so the dashboard does not under-report once records exceed 300.
    manifest_items = read_jsonl_tail(INGESTION_MANIFEST_PATH, 300)
    manifest_stats = read_jsonl_stats(INGESTION_MANIFEST_PATH)
    audit = read_json_file(INGESTION_AUDIT_PATH) or {}
    sync_meta = read_json_file(INGESTION_SYNC_PATH) or {}
    vector_doctor = read_json_file(VECTOR_DOCTOR_PATH) or {}
    notes = list_notes()
    by_quality: dict[str, int] = {}
    by_agent: dict[str, int] = {}
    by_source: dict[str, int] = {}
    for note in notes:
        quality = str(note.get("quality_status") or "unknown")
        by_quality[quality] = by_quality.get(quality, 0) + 1
        agent = str(note.get("agent_id") or "unknown")
        by_agent[agent] = by_agent.get(agent, 0) + 1
        source = str(note.get("source_type") or "unknown")
        by_source[source] = by_source.get(source, 0) + 1
    ok_count = sum(1 for item in manifest_items if item.get("ok") is True)
    fail_count = sum(1 for item in manifest_items if item.get("ok") is False)
    latest_ts = max((str(item.get("ts") or "") for item in manifest_items), default="")
    return {
        "manifest_items": manifest_items,
        "audit": audit,
        "sync_meta": sync_meta,
        "vector_doctor": vector_doctor,
        "note_count": len(notes),
        "manifest_count": manifest_stats.get("count", len(manifest_items)),
        "manifest_loaded_count": len(manifest_items),
        "ok_count": manifest_stats.get("ok_count", ok_count),
        "fail_count": manifest_stats.get("fail_count", fail_count),
        "latest_ts": manifest_stats.get("latest_ts") or latest_ts,
        "by_quality": by_quality,
        "by_agent": by_agent,
        "by_source": by_source,
    }


def pill(value: Any) -> str:
    text = str(value)
    cls = re.sub(r"[^a-z0-9-]+", "-", text.lower()).strip("-") or "unknown"
    return f'<span class="pill pill-{html.escape(cls)}">{html.escape(text)}</span>'


def render_count_facets(title: str, data: dict[str, int], limit: int = 12) -> str:
    if not data:
        return ""
    items = sorted(data.items(), key=lambda item: (-item[1], item[0]))[:limit]
    links = "".join(f'<span class="facet">{html.escape(key)} <strong>{count}</strong></span>' for key, count in items)
    return f'<h3>{html.escape(title)}</h3><div class="facet-list">{links}</div>'


def render_ingestion_page(query: dict[str, list[str]] | None = None) -> bytes:
    data = load_ingestion_dashboard()
    manifest_items = list(reversed(data["manifest_items"]))
    audit = data.get("audit") or {}
    audit_summary = audit.get("summary") or {}
    sync_meta = data.get("sync_meta") or {}
    vector_doctor = data.get("vector_doctor") or {}
    vector_status = vector_doctor.get("status") or {}
    rows: list[str] = []
    for item in manifest_items[:160]:
        response = item.get("response") if isinstance(item.get("response"), dict) else {}
        wiki_path = str(response.get("note_path") or response.get("path") or "")
        if wiki_path and not wiki_path.startswith("vault/") and not wiki_path.startswith("/"):
            wiki_path = "vault/" + wiki_path.lstrip("/")
        note_url = str(response.get("url") or "")
        if wiki_path:
            note_link = f"/note?path={quote(wiki_path, safe='/')}"
        elif note_url.startswith("/note?"):
            note_link = note_url
        else:
            note_link = "/notes"
        rows.append(
            "<tr>"
            f"<td>{html.escape(format_date(item.get('ts', '')))}</td>"
            f"<td><a href=\"{html.escape(note_link)}\">{html.escape(str(item.get('title') or ''))}</a></td>"
            f"<td>{pill(item.get('ok'))}</td>"
            f"<td><code>{html.escape(wiki_path)}</code></td>"
            f"<td><code>{html.escape(str(item.get('source_file') or ''))}</code></td>"
            "</tr>"
        )
    if not rows:
        rows.append('<tr><td colspan="5" class="muted">还没有同步入库 manifest。运行 sync 脚本后这里会显示正式记录。</td></tr>')

    warning_rows: list[str] = []
    for item in audit.get("results", []) if isinstance(audit.get("results"), list) else []:
        issues = item.get("issues") or []
        warnings = item.get("warnings") or []
        if not issues and not warnings:
            continue
        warning_rows.append(
            "<tr>"
            f"<td>{html.escape(str(item.get('kind') or ''))}</td>"
            f"<td>{pill(item.get('status'))}</td>"
            f"<td><code>{html.escape(str(item.get('path') or ''))}</code></td>"
            f"<td>{html.escape(', '.join(str(x) for x in issues[:6]))}</td>"
            f"<td>{html.escape(', '.join(str(x) for x in warnings[:8]))}</td>"
            "</tr>"
        )
    if not warning_rows:
        warning_rows.append('<tr><td colspan="5" class="muted">当前审计无问题或未同步审计报告。</td></tr>')

    summary_json = html.escape(json.dumps(audit_summary, ensure_ascii=False, indent=2)) if audit_summary else "未同步审计摘要"
    body = f"""
<div class="topbar">
  <div>
    <div class="eyebrow">正式库面板 · 北京时间</div>
    <h1>入库与质量面板</h1>
    <p class="muted">这里读取 Personal Wiki 正式数据，不是临时 3425 页面。时间统一显示为中国时区 CST。</p>
  </div>
  <div class="top-actions">
    <div class="nav-links"><a class="button-link" href="/">知识地图</a><a class="button-link" href="/notes">全部笔记</a></div>
  </div>
</div>
<div class="dashboard-grid">
  <div class="metric"><strong>{data['note_count']}</strong><span>正式 Wiki 笔记</span></div>
  <div class="metric"><strong>{data['manifest_count']}</strong><span>同步入库记录</span></div>
  <div class="metric"><strong>{data['ok_count']}</strong><span>成功入库</span></div>
  <div class="metric"><strong>{vector_status.get('fts_chunk_count', 0)}</strong><span>FTS 检索 chunk</span></div>
  <div class="metric"><strong>{html.escape(str(vector_status.get('semantic_status', 'unknown')))}</strong><span>Embedding 状态</span></div>
</div>
<div class="collection-layout">
  <section class="panel">
    <div class="section-actions"><div><h2>最近入库</h2><p class="muted">最新记录：{html.escape(format_date(data.get('latest_ts', '')))}；同步时间：{html.escape(format_date(sync_meta.get('synced_at', '')))}</p></div></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>入库时间</th><th>标题</th><th>状态</th><th>Wiki 路径</th><th>源文件</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
  </section>
  <aside class="panel">
    <h2>质量摘要</h2>
    <pre>{summary_json}</pre>
    <h2 style="margin-top:14px">检索 / 向量</h2>
    <div class="facet-list">
      <span class="facet">FTS <strong>{html.escape(str(vector_status.get('fts_status', 'unknown')))}</strong></span>
      <span class="facet">chunks <strong>{int(vector_status.get('fts_chunk_count') or 0)}</strong></span>
      <span class="facet">notes <strong>{int(vector_status.get('fts_note_count') or 0)}</strong></span>
      <span class="facet">embedding <strong>{html.escape(str(vector_status.get('semantic_status', 'unknown')))}</strong></span>
    </div>
    <p class="muted" style="margin-top:8px">下一步：{html.escape(str(vector_status.get('next_action', '')))}</p>
    {render_count_facets('质量状态', data.get('by_quality', {}))}
    {render_count_facets('来源类型', data.get('by_source', {}))}
    {render_count_facets('Agent', data.get('by_agent', {}), 8)}
  </aside>
</div>
<section class="panel" style="margin-top:16px">
  <div class="section-actions"><div><h2>审计警告 / 问题</h2><p class="muted">不合格内容不应进入主 Wiki；剩余 warning 用于驱动后续修复。</p></div></div>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>类型</th><th>状态</th><th>路径</th><th>问题</th><th>警告</th></tr></thead><tbody>{''.join(warning_rows)}</tbody></table></div>
</section>
"""
    return html_page("入库与质量面板", body)


def search_note_metadata(connection: sqlite3.Connection, paths: list[str]) -> dict[str, dict[str, Any]]:
    unique_paths = sorted({path for path in paths if path})
    if not unique_paths:
        return {}
    try:
        columns = {str(row[1]) for row in connection.execute("pragma table_info(notes)").fetchall()}
        if "metadata_json" not in columns:
            return {}
        placeholders = ",".join("?" for _ in unique_paths)
        rows = connection.execute(
            f"select path, metadata_json from notes where path in ({placeholders})",
            unique_paths,
        ).fetchall()
    except sqlite3.Error:
        return {}

    metadata_by_path: dict[str, dict[str, Any]] = {}
    for path, raw_metadata in rows:
        if not raw_metadata:
            continue
        try:
            metadata = json.loads(str(raw_metadata))
        except json.JSONDecodeError:
            continue
        if not isinstance(metadata, dict):
            continue
        metadata_by_path[str(path)] = {
            "created": str(metadata.get("created") or ""),
            "source_type": str(metadata.get("source_type") or ""),
            "source_url": str(metadata.get("source_url") or ""),
            "status": str(metadata.get("status") or ""),
            "quality_status": str(metadata.get("quality_status") or ""),
            "tags": list(metadata.get("tags") or []),
            "concepts": list(metadata.get("concepts") or []),
            "metadata": {"status_verified": True, "source_type_verified": True},
        }
    return metadata_by_path


def decode_heading_path(value: Any) -> list[str]:
    try:
        parsed = json.loads(str(value or "[]"))
    except json.JSONDecodeError:
        parsed = []
    if not isinstance(parsed, list):
        return []
    return [str(item).strip() for item in parsed if str(item).strip()]


def casefold_contains(value: Any, query: Any) -> int:
    folded_query = str(query or "").casefold()
    return int(bool(folded_query and folded_query in str(value or "").casefold()))


def heading_path_contains(value: Any, query: Any) -> int:
    return casefold_contains(" > ".join(decode_heading_path(value)), query)


def stable_folded_exact_title_rows(
    connection: sqlite3.Connection,
    query: str,
    limit: int,
    max_per_path: int,
    *,
    whole_title: bool = False,
) -> list[tuple[Any, ...]]:
    """Select exact-title supplements without entering or scanning the FTS index.

    Title matches are discovered in the much smaller notes table first.  Chunk
    lookup is then constrained by the ``chunks(path,chunk_index)`` index for
    each stable path, so an exact title never causes a scan of every chunk.
    Supplemental rows receive a neutral BM25 value before merging with the
    general candidate window.
    """

    folded_query = query.casefold()
    if not folded_query:
        return []
    title_predicate = "title_folded=?" if whole_title else "instr(title_folded,?) > 0"
    matching_paths = connection.execute(
        f"select path from notes where {title_predicate} order by path limit ?",
        (folded_query, limit),
    ).fetchall()
    selected_rows: list[tuple[Any, ...]] = []
    for (path,) in matching_paths:
        path_rows = connection.execute(
            "select c.title,c.path,c.id,c.chunk_index,c.text,c.section_id,c.parent_id,"
            "c.heading_path,c.heading_level,c.start_char,c.end_char,c.chars,c.context_text,"
            "0.0 as bm25_rank "
            "from chunks c where c.path=? order by c.chunk_index limit ?",
            (str(path or ""), max_per_path),
        ).fetchall()
        selected_rows.extend(path_rows[: max(0, limit - len(selected_rows))])
        if len(selected_rows) >= limit:
            break
    return selected_rows


def stable_folded_exact_heading_rows(
    connection: sqlite3.Connection,
    query: str,
    limit: int,
    max_per_path: int,
) -> tuple[list[tuple[Any, ...]], bool]:
    """Select strict leaf-heading matches through the dedicated B-tree lookup.

    A globally unique leaf heading is strong enough to return without entering
    the FTS index. Ambiguous headings are returned as supplements and still go
    through the general BM25 candidate pool so common labels such as "Summary"
    are not ordered by path alone.
    """

    folded_query = query.casefold()
    if not folded_query:
        return [], False
    fetch_limit = min(5000, max(limit * 8, 40))
    while True:
        lookup_rows = connection.execute(
            "select c.title,c.path,c.id,c.chunk_index,c.text,c.section_id,c.parent_id,"
            "c.heading_path,c.heading_level,c.start_char,c.end_char,c.chars,c.context_text,"
            "0.0 as bm25_rank "
            "from heading_lookup h join chunks c on c.id=h.first_chunk_id "
            "where h.heading_leaf_folded=? "
            "order by h.path,h.first_chunk_index limit ?",
            (folded_query, fetch_limit + 1),
        ).fetchall()
        exhausted = len(lookup_rows) <= fetch_limit
        unique_match = exhausted and len(lookup_rows) == 1
        selected_rows: list[tuple[Any, ...]] = []
        per_path: dict[str, int] = {}
        for row in lookup_rows[:fetch_limit]:
            path = str(row[1] or "")
            if per_path.get(path, 0) >= max_per_path:
                continue
            per_path[path] = per_path.get(path, 0) + 1
            selected_rows.append(row)
            if len(selected_rows) >= limit:
                break
        if len(selected_rows) >= limit or exhausted or fetch_limit >= 5000:
            return selected_rows, unique_match
        fetch_limit = min(5000, fetch_limit * 4)


def search_chunk_row(row: tuple[Any, ...], query: str) -> dict[str, Any]:
    heading_path = decode_heading_path(row[7])
    title = str(row[0] or "")
    text = str(row[4] or "")
    folded_query = query.casefold()
    folded_title = title.casefold()
    whole_title = bool(folded_query and folded_title == folded_query)
    title_contains = bool(casefold_contains(title, query))
    exact_heading_leaf = bool(
        folded_query
        and heading_path
        and heading_path[-1].casefold() == folded_query
    )
    heading_contains = bool(heading_path_contains(row[7], query))
    exact_text = bool(folded_query and folded_query in text.casefold())
    bm25_rank = float(row[13] or 0.0)
    # Structural equality is more precise than a substring appearing anywhere
    # in a document title.  Keep whole-title lookup strongest, but make an
    # exact leaf heading win the per-path cap over an earlier chunk whose title
    # merely contains the query.
    exact_boost = (
        6.0
        if whole_title
        else 5.0
        if exact_heading_leaf
        else 4.0
        if title_contains
        else 2.0
        if heading_contains
        else 0.0
    )
    match_priority = (
        4
        if whole_title
        else 3
        if exact_heading_leaf
        else 2
        if title_contains
        else 0
    )
    snippet = matched_snippet(text, query)
    return {
        "title": title,
        "path": str(row[1] or ""),
        "chunk_id": str(row[2] or ""),
        "chunk_index": int(row[3] or 0),
        "snippet": snippet,
        "section_id": str(row[5] or ""),
        "heading_path": heading_path,
        "heading_level": int(row[8] or 0),
        "start_char": int(row[9] or 0),
        "end_char": int(row[10] or 0),
        "chars": int(row[11] or len(text)),
        "estimated_tokens": estimate_tokens(snippet),
        "available_estimated_tokens": estimate_tokens(text),
        "context": str(row[12] or ""),
        "bm25_rank": round(bm25_rank, 8),
        "score": round(-bm25_rank + exact_boost, 8),
        "_match_priority": match_priority,
        "match_type": (
            "exact-title"
            if whole_title
            else "exact-heading"
            if exact_heading_leaf
            else "exact-title"
            if title_contains
            else "exact-heading"
            if heading_contains
            else "exact-text"
            if exact_text
            else "bm25"
        ),
        "expand": {
            "neighbor": f"/api/search/chunks/expand?id={quote(str(row[2] or ''))}&level=neighbor&q={quote(query)}",
            "section": f"/api/search/chunks/expand?id={quote(str(row[2] or ''))}&level=section&q={quote(query)}",
            "document": f"/api/search/chunks/expand?id={quote(str(row[2] or ''))}&level=document&q={quote(query)}",
        },
    }


def select_search_candidates(
    rows: list[tuple[Any, ...]],
    query: str,
    limit: int,
    max_per_path: int,
) -> list[dict[str, Any]]:
    candidates = [search_chunk_row(row, query) for row in rows]
    candidates.sort(
        key=lambda item: (
            -int(item["_match_priority"]),
            float(item["bm25_rank"]),
            str(item["path"]),
            int(item["chunk_index"]),
        )
    )
    selected: list[dict[str, Any]] = []
    per_path: dict[str, int] = {}
    seen_chunks: set[str] = set()
    for candidate in candidates:
        path = str(candidate["path"])
        chunk_id = str(candidate["chunk_id"])
        if chunk_id in seen_chunks or per_path.get(path, 0) >= max_per_path:
            continue
        seen_chunks.add(chunk_id)
        per_path[path] = per_path.get(path, 0) + 1
        candidate.pop("_match_priority", None)
        selected.append(candidate)
        if len(selected) >= limit:
            break
    return selected


def search_chunks(query: str, limit: int = 10, max_per_path: int = 2) -> dict[str, Any]:
    q = query.strip()
    limit = max(1, min(int(limit or 10), 50))
    max_per_path = max(1, min(int(max_per_path or 2), 8))
    if not q:
        return {"query": q, "count": 0, "results": [], "status": "empty-query"}
    safe_db = safe_public_path(SEARCH_DB_PATH)
    if not safe_db.exists():
        return {"query": q, "count": 0, "results": [], "status": "missing-index"}
    fts_query = fts_or_query(q)
    if not fts_query:
        return {"query": q, "count": 0, "results": [], "status": "empty-query"}

    con = sqlite3.connect(str(safe_db), timeout=2)
    con.execute("pragma busy_timeout=2000")
    rows: list[tuple[Any, ...]] = []
    exact_rows: list[tuple[Any, ...]] = []
    selected: list[dict[str, Any]] = []
    metadata_by_path: dict[str, dict[str, Any]] = {}
    last_error = ""
    ranking = "fts5-rank-tie-safe"
    rank_tie_fallbacks = 0
    try:
        expected_notes = (
            int(load_note_index().get("count") or 0) if NOTE_INDEX_PATH.exists() else None
        )
        if not search_index_schema_ready(con):
            return {
                "query": q,
                "count": 0,
                "results": [],
                "status": "rebuilding-index",
            }
        indexed_notes = int(con.execute("select count(*) from notes").fetchone()[0])
        stale_notes = int(
            con.execute(
                "select count(*) from notes where coalesce(chunk_schema_version,0) != ?",
                (SEARCH_CHUNK_SCHEMA_VERSION,),
            ).fetchone()[0]
        )
        if (expected_notes is not None and indexed_notes != expected_notes) or stale_notes:
            return {
                "query": q,
                "count": 0,
                "results": [],
                "status": "rebuilding-index",
            }

        whole_title_rows = stable_folded_exact_title_rows(
            con, q, limit, max_per_path, whole_title=True
        )
        if whole_title_rows:
            rows = whole_title_rows
            exact_rows = whole_title_rows
            selected = select_search_candidates(rows, q, limit, max_per_path)
            ranking = "folded-exact-title-fast-path"
        else:
            exact_title_rows = stable_folded_exact_title_rows(
                con, q, limit, max_per_path
            )
            exact_heading_rows, unique_exact_heading = stable_folded_exact_heading_rows(
                con, q, limit, max_per_path
            )
            if (
                unique_exact_heading
                and len(q) >= EXACT_HEADING_FAST_PATH_MIN_CHARS
                and not exact_title_rows
            ):
                rows = exact_heading_rows
                exact_rows = exact_heading_rows
                selected = select_search_candidates(rows, q, limit, max_per_path)
                ranking = "folded-exact-heading-fast-path"
            else:
                exact_rows = [*exact_title_rows, *exact_heading_rows]

                fetch_limit = min(5000, max(limit * 8, 40))
                while True:
                    fast_rows = con.execute(
                        "select c.title,c.path,c.id,c.chunk_index,c.text,c.section_id,c.parent_id,"
                        "c.heading_path,c.heading_level,c.start_char,c.end_char,c.chars,c.context_text,"
                        "rank as bm25_rank "
                        "from chunks_fts join chunks c on c.id = chunks_fts.chunk_id "
                        "where chunks_fts match ? and rank match 'bm25(8.0,1.0,0.0,0.0)' "
                        "order by rank limit ?",
                        (fts_query, fetch_limit + 1),
                    ).fetchall()
                    fast_exhausted = len(fast_rows) <= fetch_limit
                    boundary_tied = (
                        len(fast_rows) > fetch_limit
                        and float(fast_rows[fetch_limit - 1][13] or 0.0)
                        == float(fast_rows[fetch_limit][13] or 0.0)
                    )
                    if boundary_tied:
                        rank_tie_fallbacks += 1
                        rows = con.execute(
                            "select c.title,c.path,c.id,c.chunk_index,c.text,c.section_id,c.parent_id,"
                            "c.heading_path,c.heading_level,c.start_char,c.end_char,c.chars,c.context_text,"
                            "bm25(chunks_fts,8.0,1.0,0.0,0.0) as bm25_rank "
                            "from chunks_fts join chunks c on c.id = chunks_fts.chunk_id "
                            "where chunks_fts match ? order by bm25_rank,c.path,c.chunk_index limit ?",
                            (fts_query, fetch_limit),
                        ).fetchall()
                    else:
                        rows = fast_rows[:fetch_limit]
                    general_selected = select_search_candidates(rows, q, limit, max_per_path)
                    if (
                        len(general_selected) >= limit
                        or fast_exhausted
                        or fetch_limit >= 5000
                    ):
                        break
                    fetch_limit = min(5000, fetch_limit * 4)
                rows_by_id = {str(row[2] or ""): row for row in rows}
                for exact_row in exact_rows:
                    rows_by_id.setdefault(str(exact_row[2] or ""), exact_row)
                rows = list(rows_by_id.values())
                selected = select_search_candidates(rows, q, limit, max_per_path)
        metadata_by_path = search_note_metadata(con, [str(row["path"]) for row in selected])
    except sqlite3.Error as exc:
        last_error = str(exc)
    finally:
        con.close()

    for result in selected:
        result.update(metadata_by_path.get(str(result["path"]), {}))
    return {
        "query": q,
        "fts_query": fts_query,
        "retrieval": "fts5-bm25-structured-v2",
        "status": "ok" if not last_error else "query-error",
        "error": last_error,
        "ranking": ranking,
        "rank_tie_fallbacks": rank_tie_fallbacks,
        "exact_probe_candidates": len(exact_rows),
        "candidate_count": len(rows),
        "count": len(selected),
        "results": selected,
    }


def truncate_to_token_budget(
    text: str,
    max_tokens: int,
    anchor_at: int = 0,
) -> tuple[str, bool, int, int]:
    if estimate_tokens(text) <= max_tokens:
        return text, False, 0, len(text)
    anchor_at = max(0, min(int(anchor_at or 0), len(text)))
    low, high = 0, len(text)
    while low < high:
        middle = (low + high + 1) // 2
        start = max(0, anchor_at - middle // 2)
        end = min(len(text), start + middle)
        start = max(0, end - middle)
        if estimate_tokens(text[start:end]) <= max_tokens:
            low = middle
        else:
            high = middle - 1
    start = max(0, anchor_at - low // 2)
    end = min(len(text), start + low)
    start = max(0, end - low)
    return text[start:end], True, start, end


def expansion_anchor_in_chunk(text: str, query: str) -> int:
    folded = text.casefold()
    exact = query.strip().casefold()
    if exact:
        position = folded.find(exact)
        if position >= 0:
            return position + max(1, len(exact) // 2)
    for token in sorted(query_tokens(query), key=len, reverse=True):
        position = folded.find(token.casefold())
        if position >= 0:
            return position + max(1, len(token) // 2)
    return len(text) // 2


def expand_search_chunk(
    chunk_id: str,
    level: str = "neighbor",
    radius: int = 1,
    max_tokens: int = 1600,
    query: str = "",
) -> dict[str, Any]:
    requested_id = str(chunk_id or "").strip()
    requested_level = str(level or "neighbor").strip().lower()
    radius = max(1, min(int(radius or 1), 3))
    max_tokens = max(128, min(int(max_tokens or 1600), 12000))
    if not requested_id:
        raise ValueError("chunk id is required")
    if requested_level not in {"chunk", "neighbor", "section", "document"}:
        raise ValueError("level must be chunk, neighbor, section, or document")
    safe_db = safe_public_path(SEARCH_DB_PATH)
    if not safe_db.exists():
        raise FileNotFoundError(requested_id)

    con = sqlite3.connect(str(safe_db), timeout=2)
    con.execute("pragma busy_timeout=2000")
    try:
        if not search_index_schema_ready(con):
            return {
                "status": "rebuilding-index",
                "chunk_id": requested_id,
                "level": requested_level,
            }
        stale_notes = int(
            con.execute(
                "select count(*) from notes where coalesce(chunk_schema_version,0) != ?",
                (SEARCH_CHUNK_SCHEMA_VERSION,),
            ).fetchone()[0]
        )
        if stale_notes:
            return {
                "status": "rebuilding-index",
                "chunk_id": requested_id,
                "level": requested_level,
            }
        base = con.execute(
            "select id,path,chunk_index,title,text,section_id,heading_path,start_char,end_char "
            "from chunks where id = ?",
            (requested_id,),
        ).fetchone()
        if base is None:
            raise FileNotFoundError(requested_id)
        path = str(base[1] or "")
        chunk_index = int(base[2] or 0)
        section_id = str(base[5] or "")
        if requested_level == "document":
            rows = con.execute(
                "select id,path,chunk_index,title,text,section_id,heading_path,start_char,end_char "
                "from chunks where path = ? order by chunk_index",
                (path,),
            ).fetchall()
        elif requested_level == "section" and section_id:
            document_rows = con.execute(
                "select id,path,chunk_index,title,text,section_id,heading_path,start_char,end_char "
                "from chunks where path = ? order by chunk_index",
                (path,),
            ).fetchall()
            base_heading_path = decode_heading_path(base[6])
            section_start = next(
                (
                    index
                    for index, row in enumerate(document_rows)
                    if str(row[5] or "") == section_id
                ),
                -1,
            )
            rows = []
            if section_start >= 0:
                for row in document_rows[section_start:]:
                    row_section_id = str(row[5] or "")
                    row_heading_path = decode_heading_path(row[6])
                    same_section = row_section_id == section_id
                    descendant = bool(base_heading_path) and row_heading_path[
                        : len(base_heading_path)
                    ] == base_heading_path
                    if not same_section and not descendant:
                        break
                    rows.append(row)
            if not rows:
                rows = [base]
        elif requested_level == "neighbor":
            rows = con.execute(
                "select id,path,chunk_index,title,text,section_id,heading_path,start_char,end_char "
                "from chunks where path = ? and chunk_index between ? and ? order by chunk_index",
                (path, chunk_index - radius, chunk_index + radius),
            ).fetchall()
        else:
            rows = [base]
    finally:
        con.close()

    content_parts: list[str] = []
    part_ranges: list[tuple[tuple[Any, ...], int, int]] = []
    cursor = 0
    for row in rows:
        if content_parts:
            content_parts.append("\n\n")
            cursor += 2
        part = str(row[4] or "")
        part_start = cursor
        content_parts.append(part)
        cursor += len(part)
        part_ranges.append((row, part_start, cursor))
    available_content = "".join(content_parts)
    available_tokens = estimate_tokens(available_content)
    base_range = next(
        (
            (row, part_start, part_end)
            for row, part_start, part_end in part_ranges
            if str(row[0] or "") == requested_id
        ),
        part_ranges[0],
    )
    base_text = str(base_range[0][4] or "")
    anchor_at = base_range[1] + expansion_anchor_in_chunk(base_text, query)
    content, truncated, window_start, window_end = truncate_to_token_budget(
        available_content,
        max_tokens,
        anchor_at,
    )
    included_ranges = [
        (row, part_start, part_end)
        for row, part_start, part_end in part_ranges
        if part_start < window_end and part_end > window_start
    ]
    if not included_ranges:
        included_ranges = [base_range]
    source_starts: list[int] = []
    source_ends: list[int] = []
    for row, part_start, part_end in included_ranges:
        overlap_start = max(window_start, part_start)
        overlap_end = min(window_end, part_end)
        row_source_start = int(row[7] or 0)
        source_starts.append(row_source_start + max(0, overlap_start - part_start))
        source_ends.append(row_source_start + max(0, overlap_end - part_start))
    start_char = min(source_starts)
    end_char = max(source_ends)

    return {
        "status": "ok",
        "chunk_id": requested_id,
        "level": requested_level,
        "path": path,
        "title": str(base[3] or ""),
        "heading_path": decode_heading_path(base[6]),
        "content": content,
        "start_char": start_char,
        "end_char": end_char,
        "range_basis": "indexed-snapshot",
        "chars": len(content),
        "estimated_tokens": estimate_tokens(content),
        "max_tokens": max_tokens,
        "truncated": truncated,
        "available_chars": len(available_content),
        "available_estimated_tokens": available_tokens,
        "content_window_start": window_start,
        "content_window_end": window_end,
        "anchor_chunk_id": requested_id,
        "included_chunk_ids": [str(row[0] or "") for row, _, _ in included_ranges],
        "available_chunk_count": len(rows),
    }


def search_agent_notes(query: str, limit: int = 10, concept: str = "") -> dict[str, Any]:
    """Fast AI-facing retrieval over note-index metadata.

    This is intentionally lightweight: it uses in-memory note-index data,
    concept_scores, title/excerpt/search_text hits, and the vector doctor status.
    It is not a semantic embedding search unless doctor reports semantic_status=ready.
    """
    q = query.strip()
    limit = max(1, min(int(limit or 10), 50))
    requested_concept = concept.strip()
    index = load_note_index()
    concepts = [str(item.get("name") or "") for item in index.get("concepts", []) if str(item.get("name") or "")]
    query_concepts = [name for name in concepts if name and name in q]
    tokens = [tok.casefold() for tok in re.findall(r"[\w\u4e00-\u9fff]+", q) if tok.strip()]
    rows: list[dict[str, Any]] = []
    for note in index.get("notes", []):
        score = 0.0
        reasons: dict[str, Any] = {}
        concept_rows = note.get("concept_scores", []) if isinstance(note.get("concept_scores"), list) else []
        concept_lookup = concept_score_lookup(concept_rows)
        if requested_concept:
            cscore = concept_lookup.get(requested_concept, 0.0)
            if cscore <= 0:
                continue
            score += cscore * 4.0
            reasons["requested_concept"] = {"label": requested_concept, "score": round(cscore, 3)}
        matched_query_concepts: list[dict[str, Any]] = []
        for label in query_concepts:
            cscore = concept_lookup.get(label, 0.0)
            if cscore > 0:
                score += cscore * 3.0
                matched_query_concepts.append({"label": label, "score": round(cscore, 3)})
        if matched_query_concepts:
            reasons["query_concepts"] = matched_query_concepts
        title = str(note.get("title", ""))
        excerpt = str(note.get("excerpt", ""))
        search_text = str(note.get("search_text", ""))
        tags_text = " ".join(str(item) for item in note.get("tags", []))
        concepts_text = " ".join(str(item) for item in note.get("concepts", []))
        lower_fields = {
            "title": title.casefold(),
            "excerpt": excerpt.casefold(),
            "search_text": search_text.casefold(),
            "tags": tags_text.casefold(),
            "concepts": concepts_text.casefold(),
        }
        token_hits: dict[str, int] = {}
        for tok in tokens[:12]:
            if not tok:
                continue
            if tok in lower_fields["title"]:
                score += 0.9
                token_hits["title"] = token_hits.get("title", 0) + 1
            if tok in lower_fields["concepts"]:
                score += 0.65
                token_hits["concepts"] = token_hits.get("concepts", 0) + 1
            if tok in lower_fields["tags"]:
                score += 0.35
                token_hits["tags"] = token_hits.get("tags", 0) + 1
            if tok in lower_fields["excerpt"]:
                score += 0.25
                token_hits["excerpt"] = token_hits.get("excerpt", 0) + 1
            if tok in lower_fields["search_text"]:
                score += 0.08
                token_hits["body"] = token_hits.get("body", 0) + 1
        if token_hits:
            reasons["token_hits"] = token_hits
        if score <= 0:
            continue
        public = public_note(note)
        public["retrieval_score"] = round(score, 3)
        public["retrieval_reasons"] = reasons
        public["top_concept_scores"] = concept_rows[:8]
        rows.append(public)
    rows.sort(key=lambda item: (-float(item.get("retrieval_score") or 0), -float(item.get("created_sort") or 0)))
    vector_status = (read_json_file(VECTOR_DOCTOR_PATH) or {}).get("status", {})
    return {
        "query": q,
        "concept": requested_concept,
        "status": "ok",
        "retrieval_layers": {
            "concept_scores": True,
            "metadata_index": True,
            "fts_chunks": bool((vector_status or {}).get("fts_status") == "ready"),
            "semantic_embedding": (vector_status or {}).get("semantic_status", "missing"),
        },
        "count": min(len(rows), limit),
        "total_candidates": len(rows),
        "results": rows[:limit],
    }


def render_taxonomy_page(kind: str) -> bytes:
    index = load_note_index()
    if kind == "concepts":
        title = "全部概念"
        subtitle = "概念是知识图谱节点，用来表示人能理解的主题、系统、项目和方法。"
        items = index.get("concepts", [])
        param = "concept"
    else:
        title = "全部标签"
        subtitle = "标签是机器筛选用的稳定 slug：domain/type/asset/purpose/topic。"
        items = index.get("tags", [])
        param = "tag"

    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        name = str(item.get("name") or "")
        if kind == "tags" and "-" in name:
            group = name.split("-", 1)[0]
        else:
            group = "concept" if kind == "concepts" else "other"
        grouped.setdefault(group, []).append(item)

    order = ["domain", "type", "asset", "purpose", "topic", "quality", "other", "concept"]
    sections: list[str] = []
    for group in order:
        group_items = grouped.get(group)
        if not group_items:
            continue
        links = "\n".join(
            f'<a class="facet" href="{html.escape(url_with_params("/notes", {param: item["name"]}))}">{html.escape(str(item["name"]))} <strong>{int(item["count"])}</strong></a>'
            for item in group_items
        )
        group_title = {
            "domain": "领域 domain",
            "type": "内容类型 type",
            "asset": "资产形态 asset",
            "purpose": "用途 purpose",
            "topic": "细分主题 topic",
            "quality": "质量 quality",
            "other": "其它",
            "concept": "概念节点",
        }.get(group, group)
        sections.append(f'<section class="panel" style="margin-top:16px"><h2>{html.escape(group_title)}</h2><div class="facet-list">{links}</div></section>')

    body = f"""
<div class="topbar">
  <div>
    <div class="eyebrow">Personal Wiki 分类体系</div>
    <h1>{html.escape(title)}</h1>
    <p class="muted">{html.escape(subtitle)} 当前共 {len(items)} 个。</p>
  </div>
  <div class="top-actions"><div class="nav-links"><a class="button-link" href="/">知识地图</a><a class="button-link" href="/notes">全部笔记</a><a class="button-link" href="/ingestion">入库面板</a></div></div>
</div>
{''.join(sections) if sections else '<div class="empty">暂无分类。</div>'}
"""
    return html_page(title, body)


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
    path = resolve_note_path(relative_path)
    if not path.exists() or path.suffix != ".md":
        raise FileNotFoundError(relative_path)
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)
    title = note_title(path, body, fm)
    note_lookup = build_note_lookup(load_note_index())
    tags_html = "".join(f'<span class="tag">#{html.escape(str(tag))}</span>' for tag in normalize_tags(fm.get("tags", [])))
    meta = " / ".join(part for part in [format_date(note_created_value(fm)), str(fm.get("source_type", "") or "").strip()] if part)
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
            api_read_paths = {
                "/api/notes",
                "/api/note",
                "/api/tags",
                "/api/concepts",
                "/api/graph",
                "/api/ingestion",
                "/api/index/status",
                "/api/search/chunks",
                "/api/search/chunks/expand",
                "/api/search/agent",
            }
            page_read_paths = {"/", "/notes", "/note", "/tags", "/concepts", "/ingestion", "/manual", "/docs/USAGE.md"}
            if parsed.path == "/auth/read":
                self.send_bytes(HTTPStatus.OK, "text/html; charset=utf-8", self.render_read_login(parsed))
                return
            if parsed.path in api_read_paths and not self.authorized_read(REQUIRE_API_READ_AUTH):
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                return
            if parsed.path in page_read_paths and not PUBLIC_PAGE_READ and not self.authorized_read(REQUIRE_PAGE_READ_AUTH):
                self.redirect_to_read_login(parsed)
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
            elif parsed.path == "/tags":
                self.send_bytes(HTTPStatus.OK, "text/html; charset=utf-8", render_taxonomy_page("tags"))
            elif parsed.path == "/concepts":
                self.send_bytes(HTTPStatus.OK, "text/html; charset=utf-8", render_taxonomy_page("concepts"))
            elif parsed.path == "/ingestion":
                query = parse_qs(parsed.query)
                self.send_bytes(HTTPStatus.OK, "text/html; charset=utf-8", render_ingestion_page(query))
            elif parsed.path == "/note":
                query = parse_qs(parsed.query)
                relative_path = query.get("path", [""])[0]
                self.send_bytes(HTTPStatus.OK, "text/html; charset=utf-8", render_note(relative_path))
            elif parsed.path == "/api/health":
                index_status = get_index_status()
                self.send_json(
                    HTTPStatus.OK,
                    {
                        "status": "ok",
                        "notes": len(list_notes()),
                        "data_dir": str(DATA_DIR),
                        "index": {
                            "status": index_status["status"],
                            "requested_generation": index_status["requested_generation"],
                            "completed_generation": index_status["completed_generation"],
                            "last_error": index_status["last_error"],
                            "last_result": index_status["last_result"],
                        },
                    },
                )
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
            elif parsed.path == "/api/ingestion":
                self.send_json(HTTPStatus.OK, load_ingestion_dashboard())
            elif parsed.path == "/api/index/status":
                self.send_json(HTTPStatus.OK, get_index_status())
            elif parsed.path == "/api/search/chunks":
                query = parse_qs(parsed.query)
                q = first_query(query, "q")
                limit = parse_positive_int(first_query(query, "limit", "10"), 10, 50)
                max_per_path = parse_positive_int(first_query(query, "max_per_path", "2"), 2, 8)
                self.send_json(HTTPStatus.OK, search_chunks(q, limit, max_per_path))
            elif parsed.path == "/api/search/chunks/expand":
                query = parse_qs(parsed.query)
                chunk_id = first_query(query, "id")
                level = first_query(query, "level", "neighbor")
                expansion_query = first_query(query, "q")
                radius = parse_positive_int(first_query(query, "radius", "1"), 1, 3)
                max_tokens = parse_positive_int(
                    first_query(query, "max_tokens", "1600"), 1600, 12000
                )
                self.send_json(
                    HTTPStatus.OK,
                    expand_search_chunk(
                        chunk_id,
                        level,
                        radius,
                        max_tokens,
                        expansion_query,
                    ),
                )
            elif parsed.path == "/api/search/agent":
                query = parse_qs(parsed.query)
                q = first_query(query, "q")
                concept = first_query(query, "concept")
                limit = parse_positive_int(first_query(query, "limit", "10"), 10, 50)
                self.send_json(HTTPStatus.OK, search_agent_notes(q, limit, concept))
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
                with WIKI_WRITE_LOCK:
                    response = update_note(self.read_json())
                self.send_json(HTTPStatus.OK, response)
                return
            if parsed.path == "/api/note/tag":
                with WIKI_WRITE_LOCK:
                    response = tag_note(self.read_json())
                self.send_json(HTTPStatus.OK, response)
                return
            if parsed.path == "/api/note/archive":
                with WIKI_WRITE_LOCK:
                    response = archive_note(self.read_json(), "archived")
                self.send_json(HTTPStatus.OK, response)
                return
            if parsed.path == "/api/note/delete":
                with WIKI_WRITE_LOCK:
                    response = archive_note(self.read_json(), "deleted")
                self.send_json(HTTPStatus.OK, response)
                return
            if parsed.path == "/api/relink":
                with WIKI_WRITE_LOCK:
                    response = relink_notes(self.read_json())
                self.send_json(HTTPStatus.OK, response)
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
        if TRUST_LOCALHOST_READ_AUTH and self.client_address[0] in {"127.0.0.1", "::1"}:
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

    def redirect_to_read_login(self, parsed: Any) -> None:
        next_url = parsed.path
        if parsed.query:
            next_url += "?" + parsed.query
        if not next_url.startswith("/") or next_url.startswith("//"):
            next_url = "/"
        self.send_response(HTTPStatus.FOUND.value)
        self.send_header("Location", f"/auth/read?next={quote(next_url, safe='')}")
        self.end_headers()

    def render_read_login(self, parsed: Any) -> bytes:
        query = parse_qs(parsed.query)
        next_url = query.get("next", ["/"])[0] or "/"
        if not next_url.startswith("/") or next_url.startswith("//"):
            next_url = "/"
        body = f"""
<div class="reading-shell">
  <section class="panel">
    <h1>Personal Wiki 访问</h1>
    <p>这里不是账号密码登录。当前私有预览只需要输入只读访问口令。</p>
    <form method="post" action="/auth/read">
      <input type="hidden" name="next" value="{html.escape(next_url, quote=True)}" />
      <label>访问口令<br /><input name="token" type="password" autocomplete="current-password" /></label>
      <p><button type="submit">打开 Wiki</button></p>
    </form>
  </section>
</div>
"""
        return html_page("Personal Wiki 访问", body)

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
        refresh_public_indexes(force=True)
    start_index_worker()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Personal wiki serving on http://{HOST}:{PORT} data={DATA_DIR}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
