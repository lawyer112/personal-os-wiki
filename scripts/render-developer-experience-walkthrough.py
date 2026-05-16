#!/usr/bin/env python3
"""Render a public-safe developer-experience walkthrough video.

The output is intentionally presentation-like: fake product surfaces, clear
captions, and local TTS narration. It avoids private data and does not require a
running Personal OS instance.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "assets" / "demo"
WIDTH = 1920
HEIGHT = 1080
FPS = 30
PYTHON_AUDIO_GAP_SECONDS = 0.85

FFMPEG_CANDIDATES = [
    os.environ.get("FFMPEG"),
    shutil.which("ffmpeg"),
    "/Users/eathonmarsk/Documents/Codex/2026-05-12/infuse-emby/downloads/emby-unpacked/osx-arm64/EmbyServer.app/Contents/MacOS/ffmpeg",
]
FFPROBE_CANDIDATES = [
    os.environ.get("FFPROBE"),
    shutil.which("ffprobe"),
    "/Users/eathonmarsk/Documents/Codex/2026-05-12/infuse-emby/downloads/emby-unpacked/osx-arm64/EmbyServer.app/Contents/MacOS/ffprobe",
]

COLORS = {
    "bg": "#F4F1EA",
    "paper": "#FFFFFF",
    "ink": "#111827",
    "muted": "#5B6472",
    "line": "#D7D0C2",
    "teal": "#0F766E",
    "teal_soft": "#DDF4EF",
    "blue": "#2563EB",
    "blue_soft": "#E5EDFF",
    "orange": "#C2410C",
    "orange_soft": "#FFEDD5",
    "violet": "#6D28D9",
    "violet_soft": "#EDE9FE",
    "slate": "#1F2937",
    "soft": "#F8FAFC",
}

SCENES = [
    {
        "title": "Personal OS + Personal Wiki",
        "kicker": "Making AI agents work from tasks, evidence, and review",
        "kind": "title",
        "bullets": [
            "Local-first AI agent workbench",
            "Built for long-running work, not one-off chat answers",
            "Public demo data only",
        ],
        "narration": (
            "Hi, I am Haowen Yin. This is a short walkthrough of Personal OS "
            "plus Personal Wiki, a local-first AI agent workbench I built to "
            "solve a problem I kept seeing in my own AI workflows. Chat history "
            "is not enough for real work."
        ),
    },
    {
        "title": "The Problem",
        "kicker": "Real developer work is messier than the current prompt",
        "kind": "problem",
        "bullets": [
            "Saved links, voice notes, project fragments, and unfinished ideas",
            "Outputs from multiple agents and tools",
            "The hard question: what should happen next?",
        ],
        "narration": (
            "Most AI tools answer the current prompt well. But real developer "
            "work is messier than that. A user has saved links, voice notes, "
            "project fragments, unfinished ideas, server observations, and "
            "outputs from different agents. The hard question is not only what "
            "the input means. The hard question is what should happen next."
        ),
    },
    {
        "title": "The Product Loop",
        "kicker": "From messy input to reviewable agent work",
        "kind": "loop",
        "bullets": [
            "Input becomes durable Wiki memory",
            "Actionable parts become tasks with definitions of done",
            "Agents submit evidence, then humans or reviewers approve",
        ],
        "narration": (
            "The core loop is simple. Messy input becomes durable Wiki memory, "
            "executable tasks, agent claims, heartbeat updates, evidence "
            "submissions, review decisions, and updated knowledge for the next "
            "run. This gives agents shared work state instead of asking them to "
            "guess from old chat history."
        ),
    },
    {
        "title": "Capture First",
        "kicker": "Do not spend tokens before the item is worth processing",
        "kind": "capture",
        "bullets": [
            "Preserve the raw trace in Inbox",
            "Keep source, intent, and messy context",
            "Let an agent decide realtime, batch, daily review, or manual-only",
        ],
        "narration": (
            "Personal OS can keep the raw input first. A saved link or rough "
            "idea enters the Inbox with its original trace intact. The user "
            "does not need to write the final title, summary, tags, or task "
            "structure. That can happen later, when an agent decides the item "
            "is worth processing."
        ),
    },
    {
        "title": "Wiki As Durable Memory",
        "kicker": "Markdown context that humans and agents can inspect",
        "kind": "wiki",
        "bullets": [
            "Source links, tags, concepts, backlinks, and graph-friendly notes",
            "Stable knowledge outside a single chat window",
            "Simple enough for people, structured enough for agents",
        ],
        "narration": (
            "Stable knowledge goes into Personal Wiki as Markdown: source "
            "links, tags, concepts, backlinks, graph-friendly structure, and "
            "human-readable notes. This keeps durable context outside a single "
            "chat window while still being simple enough for people and agents "
            "to inspect."
        ),
    },
    {
        "title": "Tasks As Execution State",
        "kicker": "A task is not done because an agent said so",
        "kind": "task",
        "bullets": [
            "Next action, definition of done, risk level, and required output",
            "Wiki links connect context to execution",
            "Review expectations are explicit before the agent starts",
        ],
        "narration": (
            "If an input contains real work, Personal OS turns it into a task "
            "with a next action, definition of done, risk level, required "
            "output, Wiki links, and review expectations. That is the "
            "difference between an AI response and an executable piece of work."
        ),
    },
    {
        "title": "Agent Protocol",
        "kicker": "Predictable work loop instead of improvising from memory",
        "kind": "protocol",
        "bullets": [
            "poll -> claim -> load context -> execute",
            "heartbeat -> contribute -> submit -> review",
            "Evidence and artifacts are part of completion",
        ],
        "narration": (
            "Agents follow a protocol: poll, claim, load context, execute, "
            "heartbeat, contribute, submit, and review. The agent owns the task "
            "for a lease, works against the definition of done, and submits "
            "evidence instead of claiming success only in a message."
        ),
    },
    {
        "title": "Review And Trust",
        "kicker": "The system asks for evidence before it treats work as done",
        "kind": "review",
        "bullets": [
            "What changed?",
            "Where is the artifact?",
            "Should a human or reviewer agent approve it?",
        ],
        "narration": (
            "The system does not treat an agent message as completion by "
            "default. It asks what changed, where the artifact is, what "
            "evidence supports it, and whether a human or reviewer agent should "
            "approve it. This reviewability is what makes long-running agent "
            "work easier to trust."
        ),
    },
    {
        "title": "Mandarin Developer Experience Fit",
        "kicker": "From curiosity to reliable adoption",
        "kind": "fit",
        "bullets": [
            "Bilingual explanations and practical local deployment paths",
            "Realistic demos instead of abstract product claims",
            "Feedback loops from user friction back into product insight",
        ],
        "narration": (
            "For Mandarin-speaking developers, the biggest gap is often not "
            "curiosity. It is the bridge from curiosity to reliable adoption: "
            "clear demos, realistic workflows, localized explanations, safe "
            "defaults, and a feedback loop from real user friction back into "
            "product insight."
        ),
    },
    {
        "title": "Why This Matters",
        "kicker": "A product surface for API design, docs, demos, and safety",
        "kind": "closing",
        "bullets": [
            "Agent workflow design",
            "Developer documentation and examples",
            "Local-first safety boundaries",
            "GitHub: github.com/lawyer112/personal-os-wiki",
        ],
        "narration": (
            "That is why I built this project as a product surface, not just a "
            "private note system. It combines API design, documentation, demos, "
            "local deployment, agent workflow design, and safety boundaries. "
            "Thank you for watching."
        ),
    },
]


def pick_tool(candidates: list[str | None], name: str) -> str:
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return str(candidate)
    raise SystemExit(f"{name} not found. Set {name.upper()} in the environment.")


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Helvetica.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        if path and Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if text_size(draw, candidate, fnt)[0] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def rounded(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], fill: str, outline: str | None = None, radius: int = 22, width: int = 2) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_text_block(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fnt: ImageFont.ImageFont, fill: str, max_width: int, gap: int = 10) -> int:
    x, y = xy
    for line in wrap(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += text_size(draw, line, fnt)[1] + gap
    return y


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], fill: str) -> None:
    draw.line([start, end], fill=fill, width=5)
    x1, y1 = start
    x2, y2 = end
    if x2 >= x1:
        points = [(x2, y2), (x2 - 18, y2 - 10), (x2 - 18, y2 + 10)]
    else:
        points = [(x2, y2), (x2 + 18, y2 - 10), (x2 + 18, y2 + 10)]
    draw.polygon(points, fill=fill)


def card(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], title: str, body: str, accent: str) -> None:
    rounded(draw, xy, COLORS["paper"], COLORS["line"], 26, 2)
    x1, y1, x2, _ = xy
    rounded(draw, (x1 + 24, y1 + 24, x1 + 54, y1 + 54), accent, None, 8)
    draw.text((x1 + 72, y1 + 22), title, font=font(32, True), fill=COLORS["ink"])
    draw_text_block(draw, (x1 + 32, y1 + 86), body, font(24), COLORS["muted"], x2 - x1 - 64, 8)


def draw_shell(draw: ImageDraw.ImageDraw, scene_no: int, title: str, kicker: str) -> None:
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=COLORS["bg"])
    rounded(draw, (56, 54, 1864, 1026), COLORS["paper"], COLORS["line"], 32, 2)
    draw.text((104, 96), "Personal OS + Personal Wiki", font=font(30, True), fill=COLORS["teal"])
    draw.text((104, 134), "Developer Experience project walkthrough", font=font(21), fill=COLORS["muted"])
    draw.text((1618, 100), f"{scene_no:02d} / {len(SCENES):02d}", font=font(28, True), fill=COLORS["orange"])
    draw.line((104, 186, 1816, 186), fill=COLORS["line"], width=2)
    draw_text_block(draw, (104, 238), title, font(66, True), COLORS["ink"], 930, 14)
    draw_text_block(draw, (108, 338), kicker, font(30), COLORS["muted"], 880, 8)


def draw_bullets(draw: ImageDraw.ImageDraw, bullets: list[str]) -> None:
    y = 650
    for idx, bullet in enumerate(bullets):
        accent = [COLORS["teal"], COLORS["blue"], COLORS["orange"], COLORS["violet"]][idx % 4]
        rounded(draw, (112, y + 6, 134, y + 28), accent, None, 7)
        y = draw_text_block(draw, (156, y), bullet, font(30), COLORS["ink"], 790, 8) + 20


def draw_visual(draw: ImageDraw.ImageDraw, scene: dict[str, object]) -> None:
    kind = scene["kind"]
    if kind == "title":
        card(draw, (1050, 292, 1728, 482), "Task", "Clear owner, next action, definition of done.", COLORS["teal"])
        card(draw, (1130, 522, 1808, 712), "Evidence", "Artifacts and links prove progress.", COLORS["blue"])
        card(draw, (1050, 752, 1728, 942), "Review", "Humans or reviewer agents approve the result.", COLORS["orange"])
        arrow(draw, (1390, 492), (1390, 516), COLORS["muted"])
        arrow(draw, (1390, 722), (1390, 746), COLORS["muted"])
    elif kind == "problem":
        labels = ["Saved links", "Voice notes", "Agent outputs", "Project fragments", "Server observations", "Unfinished ideas"]
        coords = [(1060, 300), (1370, 300), (1060, 470), (1370, 470), (1060, 640), (1370, 640)]
        for idx, (x, y) in enumerate(coords):
            rounded(draw, (x, y, x + 260, y + 96), [COLORS["teal_soft"], COLORS["blue_soft"], COLORS["orange_soft"]][idx % 3], COLORS["line"], 20)
            draw_text_block(draw, (x + 24, y + 28), labels[idx], font(26, True), COLORS["ink"], 210)
        rounded(draw, (1178, 820, 1660, 922), COLORS["slate"], None, 24)
        draw_text_block(draw, (1220, 850), "What should happen next?", font(32, True), "#FFFFFF", 410)
    elif kind == "loop":
        items = [("Input", COLORS["teal"]), ("Wiki", COLORS["blue"]), ("Task", COLORS["orange"]), ("Agent", COLORS["violet"]), ("Review", COLORS["slate"])]
        x = 1010
        y = 470
        for idx, (label, color) in enumerate(items):
            rounded(draw, (x, y, x + 150, y + 92), color, None, 22)
            draw_text_block(draw, (x + 28, y + 30), label, font(27, True), "#FFFFFF", 110)
            if idx < len(items) - 1:
                arrow(draw, (x + 158, y + 46), (x + 218, y + 46), COLORS["muted"])
            x += 222
        card(draw, (1120, 650, 1740, 850), "Updated knowledge", "The next run starts from reviewed state, not stale chat history.", COLORS["teal"])
    elif kind == "capture":
        card(draw, (1030, 295, 1770, 835), "Inbox item", "Source: saved link\nRaw text: rough user intent\nStatus: unprocessed\nPolicy: agent decides cadence\nCost: no LLM call yet", COLORS["teal"])
    elif kind == "wiki":
        card(draw, (1030, 292, 1770, 892), "Markdown note", "# README launch walkthrough\n\nSource link: github.com/lawyer112/personal-os-wiki\n\nTags: agent-workbench, local-first, demo\nConcepts: task claiming, review gates, durable memory\nBacklinks: Inbox item, reviewable task", COLORS["blue"])
    elif kind == "task":
        card(draw, (1030, 292, 1770, 892), "Reviewable task", "Title: Attach final demo evidence\nNext action: verify media and docs\nDefinition of done: video, Wiki evidence, and README link are present\nRisk: public-safe only\nReview: required", COLORS["orange"])
    elif kind == "protocol":
        labels = ["poll", "claim", "context", "execute", "heartbeat", "submit", "review"]
        x = 1015
        y = 395
        for idx, label in enumerate(labels):
            rounded(draw, (x, y, x + 190, y + 86), COLORS["soft"], COLORS["line"], 20)
            draw_text_block(draw, (x + 34, y + 28), label, font(27, True), COLORS["ink"], 138)
            if idx < len(labels) - 1:
                arrow(draw, (x + 198, y + 43), (x + 242, y + 43), COLORS["muted"])
            x += 242
            if idx == 2:
                x = 1135
                y = 595
        card(draw, (1080, 760, 1760, 900), "Contract", "Agents work against explicit API state, not hidden chat assumptions.", COLORS["violet"])
    elif kind == "review":
        card(draw, (1020, 300, 1330, 822), "Evidence", "Artifact URL\nWiki evidence link\nDefinition-of-done flag\nSummary of changes", COLORS["blue"])
        card(draw, (1410, 300, 1760, 822), "Decision", "Approve\nRequest changes\nBlock\nArchive with reason", COLORS["teal"])
        arrow(draw, (1344, 560), (1390, 560), COLORS["muted"])
    elif kind == "fit":
        rows = [
            ("Clear demos", "make capability usable"),
            ("Localized docs", "reduce adoption friction"),
            ("Safe defaults", "build trust"),
            ("Feedback loops", "inform product insight"),
        ]
        y = 310
        for idx, (left, right) in enumerate(rows):
            color = [COLORS["teal"], COLORS["blue"], COLORS["orange"], COLORS["violet"]][idx]
            rounded(draw, (1030, y, 1745, y + 112), COLORS["paper"], COLORS["line"], 22)
            rounded(draw, (1055, y + 28, 1088, y + 61), color, None, 9)
            draw_text_block(draw, (1110, y + 22), left, font(30, True), COLORS["ink"], 240)
            draw_text_block(draw, (1380, y + 25), right, font(27), COLORS["muted"], 310)
            y += 132
    elif kind == "closing":
        card(draw, (1030, 320, 1770, 520), "Repository", "github.com/lawyer112/personal-os-wiki", COLORS["teal"])
        card(draw, (1030, 570, 1770, 770), "Review kit", "README, API guide, agent guide, safety docs, and demo media.", COLORS["blue"])
        card(draw, (1030, 820, 1770, 940), "Thank you", "Built from high-intensity, hands-on AI workflow practice.", COLORS["orange"])


def render_slide(path: Path, scene: dict[str, object], index: int) -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), COLORS["bg"])
    draw = ImageDraw.Draw(image)
    draw_shell(draw, index + 1, str(scene["title"]), str(scene["kicker"]))
    draw_bullets(draw, list(scene["bullets"]))
    draw_visual(draw, scene)
    image.save(path)


def run(cmd: list[str], cwd: Path | None = None) -> None:
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def audio_duration(ffprobe: str, path: Path) -> float:
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def main() -> None:
    ffmpeg = pick_tool(FFMPEG_CANDIDATES, "ffmpeg")
    ffprobe = pick_tool(FFPROBE_CANDIDATES, "ffprobe")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="developer-experience-walkthrough-video-") as tmp_raw:
        tmp = Path(tmp_raw)
        segments: list[Path] = []
        for index, scene in enumerate(SCENES):
            slide = tmp / f"slide-{index:02d}.png"
            audio = tmp / f"audio-{index:02d}.aiff"
            segment = tmp / f"segment-{index:02d}.mp4"
            render_slide(slide, scene, index)
            run(["say", "-v", "Daniel", "-r", "168", "-o", str(audio), str(scene["narration"])])
            duration = audio_duration(ffprobe, audio) + PYTHON_AUDIO_GAP_SECONDS
            run(
                [
                    ffmpeg,
                    "-y",
                    "-loop",
                    "1",
                    "-framerate",
                    str(FPS),
                    "-i",
                    str(slide),
                    "-i",
                    str(audio),
                    "-t",
                    f"{duration:.3f}",
                    "-vf",
                    "format=yuv420p",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-tune",
                    "stillimage",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "128k",
                    "-movflags",
                    "+faststart",
                    "-shortest",
                    str(segment),
                ]
            )
            segments.append(segment)

        concat = tmp / "concat.txt"
        concat.write_text("".join(f"file '{segment}'\n" for segment in segments), encoding="utf-8")
        output = OUT_DIR / "developer-experience-walkthrough.mp4"
        run([ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(output)])

        poster = OUT_DIR / "developer-experience-walkthrough.poster.png"
        shutil.copyfile(tmp / "slide-00.png", poster)

    print(f"wrote {output}")
    print(f"wrote {poster}")


if __name__ == "__main__":
    main()
