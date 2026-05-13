#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import os
import sys
from pathlib import Path


SKIP_DIRS = {".git", ".obsidian", "__pycache__", "node_modules", "data", "logs", "run"}


def load_server(repo_root: Path, data_dir: Path):
    os.environ["WIKI_DATA_DIR"] = str(data_dir.resolve())
    server_path = repo_root / "personal-wiki" / "api" / "server.py"
    spec = importlib.util.spec_from_file_location("personal_wiki_server", server_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load server module from {server_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def iter_markdown_files(root: Path):
    for path in sorted(root.rglob("*.md")):
        parts = set(path.relative_to(root).parts[:-1])
        if parts & SKIP_DIRS:
            continue
        yield path


def title_from_markdown(path: Path, text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            title = stripped.lstrip("#").strip()
            if title:
                return title[:120]
    return path.stem.replace("_", " ").replace("-", " ").strip() or "Untitled"


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a folder of Markdown files into Personal Wiki.")
    parser.add_argument("source", type=Path, help="Folder containing Markdown files.")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    parser.add_argument("--tag", action="append", default=["markdown-import"], help="Tag to attach. Can be repeated.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    source = args.source.resolve()
    if not source.exists() or not source.is_dir():
        raise SystemExit(f"Source folder does not exist: {source}")

    server = None if args.dry_run else load_server(args.repo_root.resolve(), args.data_dir.resolve())
    created = duplicate = restored = scanned = 0

    for path in iter_markdown_files(source):
        text = path.read_text(encoding="utf-8-sig")
        if not text.strip():
            continue
        scanned += 1
        payload = {
            "title": title_from_markdown(path, text),
            "content": text,
            "source_type": "markdown-import",
            "source_url": path.as_uri(),
            "tags": sorted(set(args.tag)),
            "metadata": {
                "source_path": str(path),
                "source_root": str(source),
                "relative_path": str(path.relative_to(source)),
            },
        }
        if args.dry_run:
            print(f"would import: {path}")
            continue
        result = server.ingest(payload)
        status = result.get("status")
        if status == "created":
            created += 1
        elif status == "duplicate":
            duplicate += 1
        elif status == "restored":
            restored += 1
        print(f"{status}: {path.name} -> {result.get('note_path', '')}")

    print(
        f"summary: scanned={scanned} created={created} duplicate={duplicate} "
        f"restored={restored} data_dir={args.data_dir.resolve()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
