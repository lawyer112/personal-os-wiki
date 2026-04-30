#!/usr/bin/env python3
"""Render bilingual README walkthrough media from safe fake data."""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "assets" / "demo"
WIDTH = 1280
HEIGHT = 720
FPS = 24
SCENE_SECONDS = 1.75

COLORS = {
    "bg": "#EEF1F4",
    "panel": "#FFFFFF",
    "ink": "#0F172A",
    "muted": "#64748B",
    "line": "#D4D4D8",
    "soft": "#F8FAFC",
    "green": "#047857",
    "green_soft": "#DCFCE7",
    "amber": "#B45309",
    "amber_soft": "#FEF3C7",
    "blue": "#2563EB",
    "blue_soft": "#DBEAFE",
    "red": "#B91C1C",
    "dark": "#111827",
}


TEXT = {
    "en": {
        "file": "personal-os-wiki-readme-demo.en",
        "brand": "Personal OS",
        "tagline": "Capture, decide later, then turn knowledge into owned work.",
        "nav": ["Today", "Capture", "Inbox", "Tasks", "Wiki"],
        "scenes": [
            "Open Capture",
            "Paste link and selected text",
            "Save to Inbox",
            "Review raw input",
            "Agent chooses cadence",
            "Process selected capture",
            "Open Personal Wiki",
            "Open reviewable task",
            "Send reminder payload",
        ],
        "capture": "Capture",
        "capture_hint": "A passive save: no LLM call happens here.",
        "url": "URL",
        "title": "Title",
        "selection": "Selection",
        "note": "Note",
        "save": "Save to Inbox",
        "saved": "Saved to Inbox",
        "inbox": "Inbox",
        "new": "new",
        "raw_input": "Web capture: README launch article",
        "source": "https://github.com/lawyer112/personal-os-wiki",
        "quote": "Saved links should become knowledge only when an agent is asked.",
        "note_text": "Later: extract a Wiki note, one task, and a reminder payload.",
        "policy_title": "Cadence belongs to the agent",
        "policy_body": "Realtime, batched review, daily review, or manual-only are all valid.",
        "agent": "Agent",
        "classify": "Classify and write once it is worth spending tokens.",
        "wiki": "Personal Wiki",
        "wiki_title": "README launch walkthrough",
        "wiki_body": "The capture becomes durable context with source link, tags, and graph links.",
        "task": "Reviewable task",
        "task_title": "Attach final README demo media",
        "task_body": "Definition of done: video links, Wiki evidence, and reminder payload are present.",
        "reminder": "Telegram-ready reminder",
        "reminder_body": "Demo processed: 1 Wiki note, 1 task, 1 idea, and review evidence.",
        "footer": "Fake public data only. No private tokens, hostnames, chats, or real backlog.",
    },
    "zh-CN": {
        "file": "personal-os-wiki-readme-demo.zh-CN",
        "brand": "Personal OS",
        "tagline": "先采集，后判断，再把知识变成有人负责的工作。",
        "nav": ["今日", "采集", "输入箱", "任务", "知识库"],
        "scenes": [
            "打开采集页",
            "粘贴链接和选中文本",
            "保存到输入箱",
            "查看原始输入",
            "由智能体决定节奏",
            "处理选中的采集",
            "打开知识库",
            "打开可复核任务",
            "发送提醒消息",
        ],
        "capture": "采集",
        "capture_hint": "这是被动保存：这里不会调用大模型。",
        "url": "链接",
        "title": "标题",
        "selection": "选中文本",
        "note": "备注",
        "save": "保存到输入箱",
        "saved": "已保存到输入箱",
        "inbox": "输入箱",
        "new": "未处理",
        "raw_input": "网页采集：README 发布文章",
        "source": "https://github.com/lawyer112/personal-os-wiki",
        "quote": "保存链接不等于立刻消耗模型额度，明确需要时再处理。",
        "note_text": "稍后提取一篇知识笔记、一个任务和一条提醒。",
        "policy_title": "处理节奏属于智能体",
        "policy_body": "实时、批量复盘、每天复盘或纯手动，都可以配置。",
        "agent": "智能体",
        "classify": "只有值得处理时，才分类、写入和生成结果。",
        "wiki": "知识库",
        "wiki_title": "README 发布演示",
        "wiki_body": "采集内容变成带来源、标签和图谱链接的长期知识。",
        "task": "可复核任务",
        "task_title": "挂上最终 README 演示视频",
        "task_body": "完成定义：视频链接、知识证据和提醒内容都存在。",
        "reminder": "Telegram 提醒消息",
        "reminder_body": "演示已处理：1 篇知识、1 个任务、1 个想法和复核证据。",
        "footer": "只使用公开假数据。不包含私有 token、主机名、聊天或真实任务。",
    },
}


def load_font(size: int, locale: str, bold: bool = False) -> ImageFont.FreeTypeFont:
    if locale == "zh-CN":
        candidates = [
            Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"),
            Path("C:/Windows/Fonts/simhei.ttf"),
        ]
    else:
        candidates = [
            Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size=size)


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, width: int) -> list[str]:
    words = list(text) if any(ord(char) > 127 for char in text) else text.split()
    lines: list[str] = []
    current = ""
    joiner = "" if any(ord(char) > 127 for char in text) else " "
    for word in words:
        candidate = word if not current else f"{current}{joiner}{word}"
        if text_size(draw, candidate, font)[0] <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def rounded(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], fill: str, outline: str | None = None, radius: int = 12, width: int = 1) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font: ImageFont.ImageFont, fill: str, max_width: int | None = None, line_gap: int = 7) -> int:
    x, y = xy
    if max_width is None:
        draw.text((x, y), text, font=font, fill=fill)
        return y + text_size(draw, text, font)[1]
    for line in wrap(draw, text, font, max_width):
        draw.text((x, y), line, font=font, fill=fill)
        y += text_size(draw, line, font)[1] + line_gap
    return y


def ease(value: float) -> float:
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, value)))


def interp(a: float, b: float, t: float) -> float:
    return a + (b - a) * ease(t)


def scene_for_frame(frame: int) -> tuple[int, float]:
    frames_per_scene = int(SCENE_SECONDS * FPS)
    index = min(frame // frames_per_scene, 8)
    local = (frame % frames_per_scene) / frames_per_scene
    return index, local


def draw_shell(draw: ImageDraw.ImageDraw, locale: str, active: str, scene: int) -> None:
    t = TEXT[locale]
    font_brand = load_font(24, locale, True)
    font_small = load_font(14, locale)
    font_nav = load_font(17, locale, True)

    rounded(draw, (28, 28, 248, 692), COLORS["panel"], COLORS["line"], 16)
    draw_text(draw, (54, 58), t["brand"], font_brand, COLORS["ink"])
    draw_text(draw, (54, 94), t["tagline"], font_small, COLORS["muted"], 160, 5)

    y = 174
    active_index = {"Today": 0, "Capture": 1, "Inbox": 2, "Tasks": 3, "Wiki": 4}.get(active, 0)
    for idx, label in enumerate(t["nav"]):
        fill = COLORS["green"] if idx == active_index else COLORS["panel"]
        text_fill = "#FFFFFF" if idx == active_index else COLORS["ink"]
        rounded(draw, (48, y, 228, y + 42), fill, None, 10)
        draw_text(draw, (66, y + 11), label, font_nav, text_fill)
        y += 50

    font_footer = load_font(13, locale)
    draw_text(draw, (54, 638), t["footer"], font_footer, COLORS["muted"], 160, 5)

    x0 = 282
    rounded(draw, (x0, 28, 1252, 692), COLORS["panel"], COLORS["line"], 16)
    draw_stepper(draw, locale, scene)


def draw_stepper(draw: ImageDraw.ImageDraw, locale: str, scene: int) -> None:
    t = TEXT[locale]
    font = load_font(13, locale, True)
    x = 318
    y = 52
    gap = 93
    for idx, label in enumerate(t["scenes"]):
        color = COLORS["green"] if idx <= scene else COLORS["line"]
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=color)
        if idx < len(t["scenes"]) - 1:
            draw.line((x + 9, y, x + gap - 9, y), fill=color, width=3)
        if idx == scene:
            draw_text(draw, (x - 36, y + 16), label, font, COLORS["ink"], 130, 3)
        x += gap


def draw_field(draw: ImageDraw.ImageDraw, locale: str, x: int, y: int, label: str, value: str, width: int, height: int, focus: bool = False, multiline: bool = False, reveal: float = 1.0) -> None:
    font_label = load_font(16, locale, True)
    font_value = load_font(16, locale)
    draw_text(draw, (x, y), label, font_label, COLORS["ink"])
    border = COLORS["green"] if focus else COLORS["line"]
    rounded(draw, (x, y + 28, x + width, y + 28 + height), "#FFFFFF", border, 10, 2 if focus else 1)
    shown = value[: int(len(value) * max(0.0, min(1.0, reveal)))]
    if multiline:
        draw_text(draw, (x + 14, y + 42), shown, font_value, COLORS["ink"], width - 28, 5)
    else:
        draw_text(draw, (x + 14, y + 42), shown, font_value, COLORS["ink"])


def draw_capture(draw: ImageDraw.ImageDraw, locale: str, scene: int, local: float) -> None:
    t = TEXT[locale]
    title_font = load_font(34, locale, True)
    body_font = load_font(16, locale)
    x = 326
    draw_text(draw, (x, 108), t["capture"], title_font, COLORS["ink"])
    draw_text(draw, (x, 154), t["capture_hint"], body_font, COLORS["muted"], 720)

    reveal = 1.0
    if scene == 1:
        reveal = local
    elif scene == 0:
        reveal = 0
    focus = scene in (0, 1)

    draw_field(draw, locale, x, 204, t["url"], t["source"], 820, 52, focus=focus, reveal=reveal)
    draw_field(draw, locale, x, 298, t["title"], t["raw_input"], 820, 52, focus=scene == 1, reveal=reveal)
    draw_field(draw, locale, x, 392, t["selection"], t["quote"], 820, 88, focus=scene == 1, multiline=True, reveal=reveal)
    draw_field(draw, locale, x, 520, t["note"], t["note_text"], 820, 74, focus=scene == 1, multiline=True, reveal=reveal)

    button_fill = COLORS["green"] if scene == 2 and local > 0.42 else COLORS["dark"]
    rounded(draw, (x, 632, x + 160, 672), button_fill, None, 10)
    draw_text(draw, (x + 24, 642), t["save"], load_font(15, locale, True), "#FFFFFF")

    if scene == 2 and local > 0.58:
        rounded(draw, (x + 178, 632, x + 470, 672), COLORS["green_soft"], "#86EFAC", 10)
        draw_text(draw, (x + 196, 642), t["saved"], load_font(15, locale, True), COLORS["green"])


def draw_inbox(draw: ImageDraw.ImageDraw, locale: str, scene: int, local: float) -> None:
    t = TEXT[locale]
    title_font = load_font(34, locale, True)
    font = load_font(16, locale)
    bold = load_font(17, locale, True)
    x = 326
    draw_text(draw, (x, 108), t["inbox"], title_font, COLORS["ink"])
    rounded(draw, (x, 176, 1160, 324), COLORS["soft"], COLORS["line"], 12)
    rounded(draw, (x + 20, 198, x + 110, 228), COLORS["blue_soft"], None, 8)
    draw_text(draw, (x + 38, 204), t["new"], load_font(14, locale, True), COLORS["blue"])
    draw_text(draw, (x + 136, 200), t["raw_input"], bold, COLORS["ink"])
    draw_text(draw, (x + 136, 236), t["source"], font, COLORS["muted"], 760)
    draw_text(draw, (x + 136, 270), t["quote"], font, COLORS["ink"], 760)

    rounded(draw, (x, 370, 1160, 608), COLORS["panel"], COLORS["line"], 12)
    draw_text(draw, (x + 28, 404), t["policy_title"], load_font(28, locale, True), COLORS["ink"])
    draw_text(draw, (x + 28, 452), t["policy_body"], load_font(18, locale), COLORS["muted"], 720)
    for idx, label in enumerate(["manual", "batch", "realtime"] if locale == "en" else ["手动", "批处理", "实时"]):
        fill = [COLORS["amber_soft"], COLORS["green_soft"], COLORS["blue_soft"]][idx]
        ink = [COLORS["amber"], COLORS["green"], COLORS["blue"]][idx]
        rounded(draw, (x + 34 + idx * 156, 520, x + 150 + idx * 156, 558), fill, None, 10)
        draw_text(draw, (x + 58 + idx * 156, 529), label, load_font(15, locale, True), ink)


def draw_processing(draw: ImageDraw.ImageDraw, locale: str, scene: int, local: float) -> None:
    t = TEXT[locale]
    font_title = load_font(24, locale, True)
    font = load_font(16, locale)
    x = 344
    y = 172
    cards = [
        (x, y, t["inbox"], t["raw_input"], COLORS["blue_soft"], COLORS["blue"]),
        (x + 270, y + 110, t["agent"], t["classify"], COLORS["amber_soft"], COLORS["amber"]),
        (x + 540, y, t["wiki"], t["wiki_title"], COLORS["green_soft"], COLORS["green"]),
        (x + 540, y + 250, t["task"], t["task_title"], "#FCE7F3", "#BE185D"),
    ]
    for idx, (cx, cy, title, body, fill, ink) in enumerate(cards):
        alpha = min(1.0, max(0.15, local * 1.4 + (0.2 if scene > 5 else 0)))
        rounded(draw, (cx, cy, cx + 220, cy + 120), fill, ink, 14, 2)
        draw_text(draw, (cx + 18, cy + 18), title, font_title, COLORS["ink"])
        draw_text(draw, (cx + 18, cy + 58), body, font, COLORS["muted"], 184, 4)
        if idx > 0:
            draw.ellipse((cx - 22, cy + 50, cx - 10, cy + 62), fill=ink)
        _ = alpha
    draw_arrow(draw, (x + 225, y + 70), (x + 268, y + 160), COLORS["amber"])
    draw_arrow(draw, (x + 492, y + 160), (x + 538, y + 70), COLORS["green"])
    draw_arrow(draw, (x + 492, y + 190), (x + 538, y + 310), "#BE185D")


def draw_wiki(draw: ImageDraw.ImageDraw, locale: str) -> None:
    t = TEXT[locale]
    x = 326
    draw_text(draw, (x, 110), t["wiki"], load_font(34, locale, True), COLORS["ink"])
    rounded(draw, (x, 170, 1160, 612), COLORS["soft"], COLORS["line"], 12)
    draw_text(draw, (x + 34, 206), t["wiki_title"], load_font(30, locale, True), COLORS["ink"])
    draw_text(draw, (x + 34, 268), t["wiki_body"], load_font(18, locale), COLORS["muted"], 760, 8)
    tags = ["readme-demo", "web-capture", "agent-work"] if locale == "en" else ["演示", "网页采集", "智能体工作"]
    for idx, tag in enumerate(tags):
        rounded(draw, (x + 34 + idx * 150, 354, x + 152 + idx * 150, 392), COLORS["green_soft"], None, 10)
        draw_text(draw, (x + 54 + idx * 150, 363), tag, load_font(14, locale, True), COLORS["green"])
    draw.line((x + 34, 438, 1110, 438), fill=COLORS["line"], width=2)
    graph_link = "[[Personal OS]]  ->  [[Reviewable task]]" if locale == "en" else "[[Personal OS]]  ->  [[可复核任务]]"
    draw_text(draw, (x + 34, 472), graph_link, load_font(18, locale, True), COLORS["blue"])


def draw_task(draw: ImageDraw.ImageDraw, locale: str) -> None:
    t = TEXT[locale]
    x = 326
    draw_text(draw, (x, 110), t["task"], load_font(34, locale, True), COLORS["ink"])
    rounded(draw, (x, 170, 1160, 612), COLORS["soft"], COLORS["line"], 12)
    rounded(draw, (x + 32, 204, x + 126, 236), COLORS["amber_soft"], None, 9)
    draw_text(draw, (x + 56, 211), "review" if locale == "en" else "待复核", load_font(14, locale, True), COLORS["amber"])
    draw_text(draw, (x + 34, 262), t["task_title"], load_font(30, locale, True), COLORS["ink"], 760)
    draw_text(draw, (x + 34, 334), t["task_body"], load_font(18, locale), COLORS["muted"], 760, 8)
    for idx, label in enumerate(["Wiki evidence", "Artifact URL", "Human review"] if locale == "en" else ["知识证据", "产物链接", "人工复核"]):
        rounded(draw, (x + 34, 430 + idx * 50, x + 320, 466 + idx * 50), "#FFFFFF", COLORS["line"], 10)
        draw_text(draw, (x + 54, 439 + idx * 50), label, load_font(16, locale, True), COLORS["ink"])


def draw_reminder(draw: ImageDraw.ImageDraw, locale: str) -> None:
    t = TEXT[locale]
    x = 326
    draw_text(draw, (x, 110), t["reminder"], load_font(34, locale, True), COLORS["ink"])
    rounded(draw, (x + 190, 168, x + 650, 622), COLORS["dark"], None, 28)
    rounded(draw, (x + 220, 218, x + 620, 500), "#FFFFFF", None, 18)
    draw_text(draw, (x + 248, 250), "Personal OS", load_font(17, "en", True), COLORS["green"])
    draw_text(draw, (x + 248, 294), t["reminder_body"], load_font(18, locale), COLORS["ink"], 330, 8)
    buttons = ["Open task", "Open Wiki"] if locale == "en" else ["打开任务", "打开知识"]
    for idx, label in enumerate(buttons):
        rounded(draw, (x + 248, 410 + idx * 48, x + 430, 448 + idx * 48), COLORS["blue_soft"], None, 10)
        draw_text(draw, (x + 276, 419 + idx * 48), label, load_font(15, locale, True), COLORS["blue"])


def draw_arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], fill: str) -> None:
    draw.line((*start, *end), fill=fill, width=4)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    size = 12
    points = [
        end,
        (end[0] - size * math.cos(angle - 0.45), end[1] - size * math.sin(angle - 0.45)),
        (end[0] - size * math.cos(angle + 0.45), end[1] - size * math.sin(angle + 0.45)),
    ]
    draw.polygon(points, fill=fill)


def draw_cursor(draw: ImageDraw.ImageDraw, scene: int, local: float) -> None:
    targets = [
        (520, 258), (970, 454), (392, 652), (140, 280), (420, 220),
        (612, 350), (960, 272), (964, 522), (734, 430),
    ]
    start = targets[max(0, scene - 1)]
    end = targets[scene]
    x = interp(start[0], end[0], local)
    y = interp(start[1], end[1], local)
    click = 0.38 < local < 0.58
    if click:
        radius = int(18 + 42 * (local - 0.38) / 0.20)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=COLORS["green"], width=3)
    draw.polygon([(x, y), (x + 18, y + 44), (x + 29, y + 30), (x + 48, y + 30)], fill="#FFFFFF", outline=COLORS["ink"])


def render_frame(locale: str, frame: int) -> Image.Image:
    scene, local = scene_for_frame(frame)
    image = Image.new("RGB", (WIDTH, HEIGHT), COLORS["bg"])
    draw = ImageDraw.Draw(image)
    active = "Capture"
    if scene in (3, 4):
        active = "Inbox"
    elif scene == 6:
        active = "Wiki"
    elif scene == 7:
        active = "Tasks"
    draw_shell(draw, locale, active, scene)
    if scene <= 2:
        draw_capture(draw, locale, scene, local)
    elif scene in (3, 4):
        draw_inbox(draw, locale, scene, local)
    elif scene == 5:
        draw_processing(draw, locale, scene, local)
    elif scene == 6:
        draw_wiki(draw, locale)
    elif scene == 7:
        draw_task(draw, locale)
    else:
        draw_reminder(draw, locale)
    draw_cursor(draw, scene, local)
    return image


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def render_locale(locale: str, keep_frames: bool = False) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    base = TEXT[locale]["file"]
    total_frames = int(len(TEXT[locale]["scenes"]) * SCENE_SECONDS * FPS)
    with tempfile.TemporaryDirectory(prefix=f"readme-demo-{locale}-") as tmp:
        frame_dir = Path(tmp)
        for frame in range(total_frames):
            render_frame(locale, frame).save(frame_dir / f"{frame:04d}.png")

        mp4 = OUT_DIR / f"{base}.mp4"
        gif = OUT_DIR / f"{base}.gif"
        palette = frame_dir / "palette.png"

        run([
            "ffmpeg", "-y", "-framerate", str(FPS), "-i", str(frame_dir / "%04d.png"),
            "-vf", "format=yuv420p", "-movflags", "+faststart", "-pix_fmt", "yuv420p",
            "-c:v", "libx264", "-crf", "20", str(mp4),
        ])
        run([
            "ffmpeg", "-y", "-i", str(mp4), "-vf",
            "fps=12,scale=960:-1:flags=lanczos,palettegen", str(palette),
        ])
        run([
            "ffmpeg", "-y", "-i", str(mp4), "-i", str(palette), "-lavfi",
            "fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5",
            str(gif),
        ])

        if locale == "en":
            shutil.copyfile(mp4, OUT_DIR / "personal-os-wiki-readme-demo.mp4")
            shutil.copyfile(gif, OUT_DIR / "personal-os-wiki-readme-demo.gif")

        poster = OUT_DIR / f"{base}.poster.png"
        render_frame(locale, int(3.4 * FPS)).save(poster)

        if keep_frames:
            saved = OUT_DIR / f"_frames-{locale}"
            if saved.exists():
                shutil.rmtree(saved)
            shutil.copytree(frame_dir, saved)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--locale", choices=["en", "zh-CN", "all"], default="all")
    parser.add_argument("--keep-frames", action="store_true")
    args = parser.parse_args()

    locales = ["en", "zh-CN"] if args.locale == "all" else [args.locale]
    for locale in locales:
        render_locale(locale, args.keep_frames)


if __name__ == "__main__":
    main()
