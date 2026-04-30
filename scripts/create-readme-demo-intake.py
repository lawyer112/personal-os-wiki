#!/usr/bin/env python3
"""Create a sanitized README demo intake item.

The script reads a private agent env file, posts fake demo content to
Personal OS `/api/intake`, and prints only a non-secret summary. It is meant
for recording public README assets without exposing real backlog data.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
from typing import Any
from urllib import request


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export ") :]
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("'").strip('"')
    return values


def post_json(url: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    with request.urlopen(req, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def build_payload(stamp: str, demo_url: str) -> dict[str, Any]:
    title_suffix = f"README demo {stamp}"
    source_text = (
        "Demo Telegram message: save this link into Personal Wiki, extract one "
        "reviewable task, keep one follow-up idea, and return a Telegram-style "
        f"reminder. Link: {demo_url}"
    )
    return {
        "source": {
            "sourceType": "telegram",
            "sourcePlatform": "telegram",
            "sourceMessageId": f"readme-demo-{stamp}",
            "sourceUrl": "https://t.me/personal-os-demo",
            "rawText": source_text,
            "attachments": [{"type": "link", "url": demo_url}],
            "createdBy": "user",
        },
        "agent": {
            "model": "readme-demo-agent",
            "classification": {"kind": "mixed", "confidence": 0.98},
            "reasoningSummary": (
                "The Telegram link is durable context, so it belongs in "
                "Personal Wiki. The concrete follow-up belongs in Personal OS "
                "as a reviewable task, while the optional short-video idea stays "
                "in the idea pool."
            ),
            "outputSummary": (
                "Captured the link, wrote one Wiki note, created one task, "
                "recorded one idea, and generated a Telegram reminder payload."
            ),
        },
        "project": {
            "name": f"README Demo Loop {stamp}",
            "goal": "Show Telegram intake becoming Wiki knowledge and executable work.",
            "priority": "P1",
            "currentFocus": "Public product walkthrough",
        },
        "wikiNotes": [
            {
                "title": f"Telegram link intake walkthrough - {title_suffix}",
                "content": (
                    f"# Telegram link intake walkthrough - {title_suffix}\n\n"
                    f"Source link: {demo_url}\n\n"
                    "This public demo note shows the product loop: a Telegram "
                    "message becomes durable Wiki context, and the actionable "
                    "part becomes a Personal OS task with review evidence.\n\n"
                    "## Extracted meaning\n\n"
                    "- Keep the original link as knowledge.\n"
                    "- Create one task for the README demo update.\n"
                    "- Keep the short-video follow-up as an idea, not a task.\n"
                ),
                "source_type": "telegram",
                "tags": ["readme-demo", "telegram", "personal-os", "personal-wiki"],
                "metadata": {"public_demo": True, "stamp": stamp},
            }
        ],
        "tasks": [
            {
                "title": f"Add README walkthrough video evidence - {title_suffix}",
                "description": (
                    "Public demo task generated from a Telegram-style link intake."
                ),
                "status": "review",
                "priority": "P1",
                "nextAction": (
                    "Review the generated Wiki note, confirm the task evidence, "
                    "and attach the final README demo media."
                ),
                "definitionOfDone": (
                    "README shows the demo media and explains the Telegram -> "
                    "Wiki -> Task -> Reminder loop without exposing private data."
                ),
                "estimateMinutes": 25,
                "wikiLinks": [],
            }
        ],
        "ideas": [
            {
                "title": f"Make a 30 second short version - {title_suffix}",
                "body": (
                    "After the README demo is accepted, cut a shorter version "
                    "for social previews."
                ),
                "status": "captured",
                "priority": "P2",
                "tags": ["readme-demo", "video"],
                "nextAction": "Reuse the same fake data and trim the waiting segments.",
            }
        ],
        "notes": [],
        "projectEvents": [
            {
                "title": f"Demo intake processed - {title_suffix}",
                "body": "Telegram-style input produced Wiki, task, idea, and reminder outputs.",
                "eventType": "demo",
            }
        ],
        "notification": {"recipient": "readme-demo"},
    }


def sanitize_summary(response: dict[str, Any]) -> dict[str, Any]:
    wiki_items = response.get("wiki") or []
    tasks = response.get("tasks") or []
    ideas = response.get("ideas") or []
    notification = response.get("notification") or {}
    payload = notification.get("payload") or {}
    return {
        "ok": response.get("ok") is True,
        "inbox_id": (response.get("inbox") or {}).get("id"),
        "agent_run_id": response.get("agentRunId"),
        "task_id": (tasks[0] or {}).get("id") if tasks else None,
        "task_title": (tasks[0] or {}).get("title") if tasks else None,
        "idea_id": (ideas[0] or {}).get("id") if ideas else None,
        "wiki_title": (wiki_items[0] or {}).get("title") if wiki_items else None,
        "wiki_ok": (wiki_items[0] or {}).get("ok") if wiki_items else None,
        "wiki_status": (wiki_items[0] or {}).get("status") if wiki_items else None,
        "wiki_path": (wiki_items[0] or {}).get("note_path") if wiki_items else None,
        "wiki_url": (wiki_items[0] or {}).get("url") if wiki_items else None,
        "wiki_error": (wiki_items[0] or {}).get("error") if wiki_items else None,
        "notification_text": payload.get("text"),
        "notification_buttons": payload.get("buttons"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.environ.get("PERSONAL_OS_BASE_URL"))
    parser.add_argument("--env", default=os.environ.get("PERSONAL_OS_AGENT_ENV"))
    parser.add_argument(
        "--demo-url",
        default="https://github.com/lawyer112/personal-os-wiki",
    )
    parser.add_argument("--stamp", default=dt.datetime.now().strftime("%Y%m%d-%H%M%S"))
    args = parser.parse_args()

    env_path = Path(args.env).expanduser() if args.env else Path.home() / ".config/personal-os/agent.env"
    env = {**load_env_file(env_path), **os.environ}
    base_url = (args.base_url or env.get("PERSONAL_OS_BASE_URL") or "").rstrip("/")
    token = env.get("PERSONAL_OS_API_TOKEN")
    if not base_url:
        raise SystemExit("PERSONAL_OS_BASE_URL is required.")
    if not token or token == "change-me":
        raise SystemExit("PERSONAL_OS_API_TOKEN is required.")

    response = post_json(
        f"{base_url}/api/intake",
        token,
        build_payload(args.stamp, args.demo_url),
    )
    print(json.dumps(sanitize_summary(response), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
