#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import os
import re
import sys
from pathlib import Path


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


def normalize(text: str) -> str:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            lines.append(stripped)
    return "\n".join(lines).strip()


def split_blocks(text: str) -> list[str]:
    blocks: list[str] = []
    current: list[str] = []
    in_fence = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            current.append(line)
            continue
        if not in_fence and stripped.startswith("#"):
            continue
        if not in_fence and not stripped:
            block = normalize("\n".join(current))
            if block:
                blocks.append(block)
            current = []
            continue
        if not in_fence and re.match(r"^[-*+]\s+", stripped):
            block = normalize("\n".join(current))
            if block:
                blocks.append(block)
            current = [re.sub(r"^[-*+]\s+", "", stripped)]
            block = normalize("\n".join(current))
            if block:
                blocks.append(block)
            current = []
            continue
        current.append(line)
    block = normalize("\n".join(current))
    if block:
        blocks.append(block)
    return blocks


def title_for(block: str) -> str:
    first = block.splitlines()[0].strip()
    first = re.sub(r"https?://\S+", "Link", first)
    return first[:80] or "Obsidian inbox item"


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest Markdown blocks from an Obsidian inbox folder.")
    parser.add_argument(
        "--vault",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "vault",
        help="Obsidian vault path.",
    )
    parser.add_argument("--inbox", default="Personal OS Inbox")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    parser.add_argument("--tag", action="append", default=["obsidian-inbox"])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    inbox_dir = (args.vault / args.inbox).resolve()
    if not inbox_dir.exists() or not inbox_dir.is_dir():
        raise SystemExit(f"Inbox folder does not exist: {inbox_dir}")

    server = None if args.dry_run else load_server(args.repo_root.resolve(), args.data_dir.resolve())
    scanned = created = duplicate = 0

    for path in sorted(inbox_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8-sig")
        for index, block in enumerate(split_blocks(text), start=1):
            block_hash = hashlib.sha256(block.encode("utf-8")).hexdigest()[:16]
            scanned += 1
            payload = {
                "title": title_for(block),
                "content": block,
                "source_type": "obsidian-inbox",
                "source_url": f"{path.as_uri()}#block-{block_hash}",
                "tags": sorted(set(args.tag)),
                "metadata": {
                    "source_path": str(path),
                    "block_index": index,
                    "block_hash": block_hash,
                },
            }
            if args.dry_run:
                print(f"would ingest: {path.name} block={index} hash={block_hash}")
                continue
            result = server.ingest(payload)
            status = str(result.get("status") or "")
            if status == "created":
                created += 1
            elif status == "duplicate":
                duplicate += 1
            print(f"{status}: {path.name} block={index} -> {result.get('note_path', '')}")

    print(f"summary: scanned={scanned} created={created} duplicate={duplicate} inbox={inbox_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
