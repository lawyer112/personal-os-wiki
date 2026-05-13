#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
}


def get_json(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def safe_name(title: str, fallback: str) -> str:
    base = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', " ", title).strip()
    base = re.sub(r"\s+", " ", base).strip(" .")
    if not base:
        base = fallback
    if base.upper() in RESERVED_NAMES:
        base = f"{base}-note"
    return base[:100]


def yaml_scalar(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def yaml_list(values: list[str]) -> list[str]:
    return [f"  - {yaml_scalar(value)}" for value in values]


def note_url(base_url: str, path: str) -> str:
    encoded = urllib.parse.quote(path, safe="/")
    return f"{base_url.rstrip('/')}/note?path={encoded}"


def build_note(base_url: str, record: dict[str, Any], note: dict[str, Any]) -> str:
    title = str(record.get("title") or note.get("title") or "Untitled")
    tags = [str(tag) for tag in record.get("tags") or [] if str(tag).strip()]
    concepts = [str(concept) for concept in record.get("concepts") or [] if str(concept).strip()]
    path = str(record.get("path") or note.get("path") or "")
    source_hash = str(record.get("source_hash") or "")
    source_url = str(record.get("source_url") or "")
    body = str(note.get("raw_body") or note.get("content") or "").strip()

    lines = [
        "---",
        f"title: {yaml_scalar(title)}",
        "personal_wiki_mirror: true",
        f"personal_wiki_path: {yaml_scalar(path)}",
        f"personal_wiki_url: {yaml_scalar(note_url(base_url, path))}",
    ]
    if source_hash:
        lines.append(f"source_hash: {yaml_scalar(source_hash)}")
    if source_url:
        lines.append(f"source_url: {yaml_scalar(source_url)}")
    if tags:
        lines.append("tags:")
        lines.extend(yaml_list(tags))
    if concepts:
        lines.append("concepts:")
        lines.extend(yaml_list(concepts))
    lines.extend(
        [
            "---",
            "",
            f"# {title}",
            "",
            "> Generated mirror from Personal Wiki. Edit the source in Personal Wiki, not this file.",
            "",
        ]
    )
    if body.startswith("#"):
        lines.append(body)
    else:
        lines.extend([body])
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Export Personal Wiki notes into an Obsidian-readable mirror folder.")
    parser.add_argument("--base-url", default="http://127.0.0.1:3422")
    parser.add_argument(
        "--vault",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "vault",
        help="Obsidian vault path.",
    )
    parser.add_argument("--mirror-dir", default="Personal Wiki Mirror")
    parser.add_argument("--clean", action="store_true", help="Remove the mirror directory before exporting.")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    vault = args.vault.resolve()
    target = vault / args.mirror_dir
    target.mkdir(parents=True, exist_ok=True)
    if args.clean and target.exists():
        shutil.rmtree(target)
        target.mkdir(parents=True, exist_ok=True)

    notes_payload = get_json(f"{base_url}/api/notes?page_size=100")
    notes = list(notes_payload.get("notes") or [])
    written = 0
    used_names: set[str] = set()
    index_lines = ["# Personal Wiki Mirror", ""]

    for record in notes:
        path = str(record.get("path") or "")
        if not path:
            continue
        encoded = urllib.parse.quote(path, safe="/")
        note = get_json(f"{base_url}/api/note?path={encoded}")
        stem = safe_name(str(record.get("title") or note.get("title") or ""), Path(path).stem)
        name = f"{stem}.md"
        if name.lower() in used_names:
            suffix = str(record.get("source_hash") or written + 1)[:8]
            name = f"{stem}-{suffix}.md"
        used_names.add(name.lower())
        (target / name).write_text(build_note(base_url, record, note), encoding="utf-8")
        index_lines.append(f"- [[{Path(name).stem}]]")
        written += 1

    (target / "_index.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    print(f"exported={written} target={target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
