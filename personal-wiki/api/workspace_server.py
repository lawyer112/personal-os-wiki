#!/usr/bin/env python3
"""中文工作台的知识接口。保留旧接口，并为受管手册增加版本与并发保护。

部署时只运行此入口。不要同时运行旧入口或绕过接口直接修改受管手册。
"""
from __future__ import annotations

import contextlib
import hashlib
import html
import json
import os
import re
import tempfile
import threading
import time
import uuid
from http import HTTPStatus
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import server as wiki

try:
    import fcntl
except ImportError:
    fcntl = None

_LOCK = threading.RLock()
_CACHE: dict[str, Any] = {}
MAX_BODY = 1024 * 1024
METADATA_FIELDS = ("space", "book", "chapter", "owner", "confidence", "status", "sensitivity", "valid_until", "source_url")


class ConflictError(ValueError):
    pass


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


@contextlib.contextmanager
def vault_lock():
    """单进程线程锁及 Linux 跨进程文件锁。Windows 单进程部署同样受线程锁保护。"""
    wiki.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _LOCK:
        with (wiki.DATA_DIR / ".workspace.lock").open("a+b") as handle:
            if fcntl:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                if fcntl:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def atomic_write(path: Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".workspace-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(raw)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def note_path(relative: str) -> Path:
    if not isinstance(relative, str) or len(relative) > 1000 or "\\" in relative:
        raise ValueError("知识路径格式不正确")
    path = wiki.safe_data_path(relative)
    if wiki.NOTES_DIR.resolve() not in path.parents or path.suffix.lower() != ".md":
        raise ValueError("只能访问知识页面，不能覆盖原始资料或系统文件")
    return path


def history_dir(relative: str) -> Path:
    note_path(relative)
    return wiki.DATA_DIR / ".workspace-history" / digest(relative.encode("utf-8"))


def preserve(relative: str, raw: bytes) -> str:
    revision = digest(raw)
    target = history_dir(relative) / f"{revision}.md"
    if not target.exists():
        atomic_write(target, raw)
    return revision


def decode_note(relative: str, raw: bytes) -> dict[str, Any]:
    text = raw.decode("utf-8-sig")
    frontmatter, body = wiki.parse_frontmatter(text)
    title = wiki.note_title(Path(relative), body, frontmatter)
    content = wiki.notes_section(body)
    content = re.sub(r"^#\s+" + re.escape(title) + r"\s*\n", "", content, count=1).strip()
    return {
        "path": relative,
        "title": title,
        "content": content,
        "raw_body": body,
        "frontmatter": frontmatter,
        "revision": digest(raw),
        "id": str(frontmatter.get("workspace_id") or uuid.uuid5(uuid.NAMESPACE_URL, relative)),
    }


def read_managed_note(relative: str, revision: str = "") -> dict[str, Any]:
    path = note_path(relative)
    if not path.is_file():
        raise FileNotFoundError("知识页面不存在")
    current = path.read_bytes()
    current_revision = digest(current)
    if revision and revision != current_revision:
        if not re.fullmatch(r"[a-f0-9]{64}", revision):
            raise ValueError("版本编号格式不正确")
        snapshot = history_dir(relative) / f"{revision}.md"
        if not snapshot.is_file():
            raise FileNotFoundError("此历史版本不存在，不能用最新版代替")
        raw = snapshot.read_bytes()
        if digest(raw) != revision:
            raise ValueError("历史版本校验失败")
    else:
        raw = current
    note = decode_note(relative, raw)
    note["currentRevision"] = current_revision
    note["historical"] = note["revision"] != current_revision
    snapshots = []
    folder = history_dir(relative)
    for snapshot in sorted(folder.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)[:50]:
        snapshots.append({"revision": snapshot.stem, "savedAt": wiki.dt.datetime.fromtimestamp(snapshot.stat().st_mtime, wiki.dt.UTC).isoformat()})
    note["history"] = snapshots
    return note


def checked_string(value: Any, name: str, maximum: int = 160, required: bool = False) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{name}必须是文字")
    result = value.strip()
    if len(result) > maximum or (required and not result):
        raise ValueError(f"{name}为空或过长")
    return result


def validate_payload(payload: dict[str, Any], existing: dict[str, Any] | None = None) -> tuple[str, str, dict[str, Any]]:
    title = checked_string(payload.get("title", ""), "标题", 200, True)
    content = checked_string(payload.get("content", ""), "正文", 200000, True)
    metadata = dict(existing or {})
    incoming = payload.get("metadata", {})
    if not isinstance(incoming, dict):
        raise ValueError("手册属性必须是对象")
    for key in METADATA_FIELDS:
        if key in incoming:
            metadata[key] = checked_string(incoming[key], "手册属性", 500 if key == "source_url" else 200)
    for field, allowed in {
        "status": {"draft", "published", "deprecated"},
        "confidence": {"verified", "inferred", "speculative"},
        "sensitivity": {"internal", "private", "public"},
    }.items():
        if field in incoming and metadata[field] not in allowed:
            raise ValueError("手册状态、可信程度或资料级别不正确")
    if "tags" in payload:
        tags = payload["tags"]
        if not isinstance(tags, list) or len(tags) > 30:
            raise ValueError("标签应为不超过 30 项的数组")
        metadata["tags"] = [checked_string(tag, "标签", 80, True) for tag in tags]
    if metadata.get("valid_until"):
        try:
            wiki.dt.datetime.fromisoformat(str(metadata["valid_until"]).replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("复核到期时间格式不正确") from exc
    metadata.setdefault("status", "draft")
    metadata.setdefault("confidence", "speculative")
    metadata.setdefault("sensitivity", "internal")
    metadata["title"] = title
    return title, content, metadata


def after_write() -> bool:
    _CACHE.clear()
    try:
        wiki.refresh_public_indexes()
        return True
    except Exception:
        # 正文已原子保存，不以索引失败引导用户重复创建。返回明确的降级状态。
        return False


def write_managed_note(payload: dict[str, Any]) -> dict[str, Any]:
    with vault_lock():
        wiki.ensure_dirs_no_git()
        relative = payload.get("path")
        if relative:
            path = note_path(relative)
            if not path.is_file():
                raise FileNotFoundError("知识页面不存在")
            raw = path.read_bytes()
            expected = payload.get("expectedRevision")
            if expected != digest(raw):
                raise ConflictError("知识页面已被更新，请重新读取并合并修改，不能覆盖他人的新版本")
            original = decode_note(relative, raw)
            title, content, metadata = validate_payload(payload, original["frontmatter"])
            preserve(relative, raw)
        else:
            request_id = payload.get("requestId", "")
            if not isinstance(request_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{12,100}", request_id):
                raise ValueError("创建知识页面需要有效的请求标识")
            title, content, metadata = validate_payload(payload)
            request_hash = digest(json.dumps({"title": title, "content": content, "metadata": metadata}, sort_keys=True, ensure_ascii=False).encode("utf-8"))
            stable_id = str(uuid.uuid5(uuid.NAMESPACE_URL, "personal-os-manual:" + request_id))
            path = wiki.NOTES_DIR / "manuals" / f"{stable_id}.md"
            relative = wiki.rel(path)
            if path.exists():
                previous = read_managed_note(relative)
                if previous["frontmatter"].get("workspace_request_hash") != request_hash:
                    raise ConflictError("该请求标识已经用于另一份内容，请核对创建结果")
                return {"ok": True, "note": previous, "replayed": True, "indexed": after_write()}
            metadata["workspace_request_hash"] = request_hash
            metadata["created"] = wiki.now_utc().isoformat()
            metadata["workspace_id"] = stable_id
        metadata.setdefault("workspace_id", str(uuid.uuid5(uuid.NAMESPACE_URL, relative)))
        metadata["updated"] = wiki.now_utc().isoformat()
        output = wiki.render_note_document(title, content, metadata).encode("utf-8")
        preserve(relative, output)
        atomic_write(path, output)
        indexed = after_write()
        return {"ok": True, "note": read_managed_note(relative), "indexed": indexed, "replayed": False}


def catalog(query: dict[str, list[str]]) -> dict[str, Any]:
    now = time.monotonic()
    signature = wiki.vault_signature()
    cache_key = (str(wiki.DATA_DIR), signature)
    with _LOCK:
        if _CACHE.get("key") != cache_key or now - _CACHE.get("time", 0) > 5:
            rows = []
            for path in wiki.NOTES_DIR.rglob("*.md"):
                if not path.is_file() or path.is_symlink():
                    continue
                try:
                    relative = wiki.rel(path)
                    note = decode_note(relative, path.read_bytes())
                    metadata = note["frontmatter"]
                    rows.append({"id": note["id"], "path": relative, "title": note["title"], "revision": note["revision"],
                        "excerpt": wiki.plain_excerpt(note["content"], 200), "tags": wiki.normalize_tags(metadata.get("tags", [])),
                        "space": str(metadata.get("space") or "未分类资料"), "book": str(metadata.get("book") or "收集与整理"),
                        "chapter": str(metadata.get("chapter") or "默认章节"), "status": str(metadata.get("status") or "draft"),
                        "updated": str(metadata.get("updated") or metadata.get("created") or ""),
                        "_search": (note["title"] + " " + note["content"] + " " + json.dumps(metadata, ensure_ascii=False)).casefold()})
                except (OSError, ValueError, UnicodeError):
                    continue
            rows.sort(key=lambda row: (row["updated"], row["path"]), reverse=True)
            _CACHE.update({"key": cache_key, "time": now, "rows": rows})
        rows = list(_CACHE["rows"])
    tree: dict[tuple[str, str, str], int] = {}
    for row in rows:
        key = (row["space"], row["book"], row["chapter"])
        tree[key] = tree.get(key, 0) + 1
    q = query.get("q", [""])[0].strip().casefold()[:200]
    for field in ("space", "book", "chapter", "status"):
        value = query.get(field, [""])[0]
        if value:
            rows = [row for row in rows if row[field] == value]
    if q:
        rows = [row for row in rows if q in row["_search"]]
    try:
        page = max(1, min(100000, int(query.get("page", ["1"])[0])))
    except ValueError:
        page = 1
    page_size = 30
    total = len(rows)
    selected = rows[(page - 1) * page_size:page * page_size]
    return {"ok": True, "notes": [{key: value for key, value in row.items() if key != "_search"} for row in selected],
        "page": page, "pageSize": page_size, "total": total,
        "tree": [{"space": key[0], "book": key[1], "chapter": key[2], "count": value} for key, value in sorted(tree.items())]}


class Handler(wiki.Handler):
    def read_json(self) -> dict[str, Any]:
        if self.headers.get("Transfer-Encoding"):
            raise ValueError("不支持分块请求正文")
        length = int(self.headers.get("Content-Length", "0"))
        if length < 1 or length > MAX_BODY:
            raise ValueError("请求正文为空或超过 1 MB 限制")
        return super().read_json()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/workspace/"):
            if parsed.path == "/api/health":
                self.send_json(HTTPStatus.OK, {"status": "ok", "notes": len(wiki.list_notes()), "workspace_version": 1})
                return
            super().do_GET()
            return
        if not self.authorized_read(True):
            self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "读取凭证无效"})
            return
        try:
            query = parse_qs(parsed.query)
            if parsed.path == "/api/workspace/notes":
                result = catalog(query)
            elif parsed.path == "/api/workspace/note":
                with vault_lock():
                    result = {"ok": True, "note": read_managed_note(query.get("path", [""])[0], query.get("revision", [""])[0])}
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "接口不存在"})
                return
            self.send_json(HTTPStatus.OK, result)
        except Exception as exc:
            self.workspace_error(exc)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/workspace/note":
            if not self.authorized():
                self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "写入凭证无效"})
                return
            try:
                self.send_json(HTTPStatus.OK, write_managed_note(self.read_json()))
            except Exception as exc:
                self.workspace_error(exc)
            return
        # 旧写入入口仍受同一把锁保护；受管手册只允许经 CAS 入口修改。
        if parsed.path in {"/api/note/update", "/api/note/tag", "/api/note/archive", "/api/note/delete", "/api/relink"}:
            self.send_json(HTTPStatus.CONFLICT, {"ok": False, "error": "此部署已启用手册版本保护，请使用工作台版本接口修改知识"})
            return
        with vault_lock():
            super().do_POST()
            _CACHE.clear()

    def workspace_error(self, exc: Exception) -> None:
        if isinstance(exc, ConflictError):
            status, message = HTTPStatus.CONFLICT, str(exc)
        elif isinstance(exc, FileNotFoundError):
            status, message = HTTPStatus.NOT_FOUND, "知识页面或历史版本不存在"
        elif isinstance(exc, (ValueError, UnicodeError)):
            status, message = HTTPStatus.BAD_REQUEST, str(exc)
        else:
            status, message = HTTPStatus.INTERNAL_SERVER_ERROR, "知识服务处理失败，请检查服务日志"
            wiki.traceback.print_exc()
        self.send_json(status, {"ok": False, "error": message})

    def render_read_login(self, parsed: Any) -> bytes:
        next_url = parse_qs(parsed.query).get("next", ["/"])[0]
        if not next_url.startswith("/") or next_url.startswith("//"):
            next_url = "/"
        body = f'<div class="reading-shell"><section class="panel"><h1>知识库访问验证</h1><p>输入读取凭证。凭证不会写入页面地址。</p><form method="post" action="/auth/read"><input type="hidden" name="next" value="{html.escape(next_url, quote=True)}"><label>读取凭证<input name="token" type="password" autocomplete="current-password" required></label><p><button type="submit">进入知识库</button></p></form></section></div>'
        return wiki.html_page("知识库访问验证", body)


def main() -> None:
    # 所有受支持的启动方式共用新版独立 Wiki 页面与版本保护接口。
    from site_server import main as start_site
    start_site()


if __name__ == "__main__":
    main()
