#!/usr/bin/env python3
"""独立 Wiki 的完整中文站点；知识写入继续使用原有版本保护接口。"""
from __future__ import annotations

import hashlib
import html
import json
import math
import os
import re
import secrets
from http import HTTPStatus
from pathlib import Path
from urllib.parse import parse_qs, quote, urlencode, urlparse

import server as wiki
import workspace_server as knowledge

ASSETS = Path(__file__).parent / "static"
PAGES = {"/", "/notes", "/note", "/graph", "/tags", "/concepts", "/manual", "/edit"}
LABELS = {"draft": "草稿", "published": "已发布", "deprecated": "已停用", "verified": "已核验", "inferred": "推断", "speculative": "待证实", "internal": "内部资料", "private": "私密资料", "public": "可公开资料", "manual": "手动整理", "telegram": "消息采集", "link": "网页链接", "file": "文件资料", "text": "文字输入", "voice-transcript": "语音转写", "web": "网页采集", "inbox": "待整理资料", "wikilink": "显式引用", "related": "算法关联", "tag": "共同标签"}
NAV = [("/", "知识总览", "grid"), ("/notes", "全部笔记", "book"), ("/graph", "知识图谱", "orbit"), ("/tags", "标签索引", "tag"), ("/concepts", "概念索引", "spark"), ("/manual", "使用与接入", "guide")]
ICONS = {"grid": '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>', "book": '<path d="M12 5C8 2 5 3 3 4v15c3-2 6-1 9 1 3-2 6-3 9-1V4c-2-1-5-2-9 1Zm0 0v15"/>', "orbit": '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-35 12 12)"/><path d="M8 2C3 8 11 23 16 22"/>', "tag": '<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7" cy="7" r="1"/>', "spark": '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>', "guide": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h5"/>', "search": '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>', "arrow": '<path d="M4 12h16m-6-6 6 6-6 6"/>', "plus": '<path d="M12 4v16M4 12h16"/>', "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>', "pause": '<path d="M8 5v14M16 5v14"/>', "menu": '<path d="M4 6h16M4 12h16M4 18h16"/>', "close": '<path d="m5 5 14 14M5 19 19 5"/>', "edit": '<path d="m4 16 12-12 4 4L8 20H4v-4Zm10-10 4 4"/>', "link": '<path d="m9 15 6-6M8 17l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0m2-2 2-2a4 4 0 0 1 5 5l-5 5a4 4 0 0 1-5 0"/>', "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>', "shield": '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>'}


def e(value: object) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def icon(name: str) -> str:
    return f'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS.get(name, ICONS["book"])}</svg>'


def label(value: object, fallback: str = "未标注") -> str:
    text = str(value or "")
    return LABELS.get(text, text or fallback)


def url(route: str, **params: object) -> str:
    clean = {key: str(value) for key, value in params.items() if value not in (None, "")}
    return route + ("?" + urlencode(clean) if clean else "")


def local_next(value: str) -> str:
    return value if value.startswith("/") and not value.startswith("//") and not re.search(r"[\x00-\x20\\]", value) and urlparse(value).path != "/auth/read" else "/"


def safe_href(value: str) -> str:
    if not value or re.search(r"[\x00-\x20\\]", value) or value.startswith("//"):
        return ""
    try:
        parsed = urlparse(value)
        if parsed.scheme in {"http", "https", "mailto"}:
            return value
        if not parsed.scheme and not parsed.netloc and (value.startswith("/") or value.startswith("#")):
            return value
    except ValueError:
        pass
    return ""


def os_url() -> str:
    value = os.environ.get("WIKI_OS_URL", "").strip()
    try:
        parsed = urlparse(value)
        return value.rstrip("/") if parsed.scheme in {"https", "http"} and parsed.netloc and not parsed.username and not parsed.password and not parsed.query and not parsed.fragment and safe_href(value) else ""
    except ValueError:
        return ""


def badge(value: object) -> str:
    return f'<span class="badge">{e(label(value))}</span>'


def data_script(key: str, value: object) -> str:
    return f'<script type="application/json" id="{key}">{wiki.json_for_script(value)}</script>'


def empty(title: str, text: str) -> str:
    return f'<div class="empty">{icon("spark")}<h3>{e(title)}</h3><p>{e(text)}</p><a href="/notes" class="text-link">浏览全部笔记 {icon("arrow")}</a></div>'


def shell(title: str, body: str, active: str = "/", login: bool = False) -> bytes:
    version = hashlib.sha256((ASSETS / "wiki.css").read_bytes() + (ASSETS / "wiki.js").read_bytes()).hexdigest()[:12]
    links = "".join(f'<a class="nav-link{" active" if active == href else ""}" href="{href}" {"aria-current=page" if active == href else ""}>{icon(symbol)}<span>{text}</span><span class="nav-arrow">↗</span></a>' for href, text, symbol in NAV)
    work = f'<a class="work-link" href="{e(os_url())}">{icon("grid")} 前往工作台 {icon("arrow")}</a>' if os_url() else '<p class="sidebar-note">知识服务独立运行<br>任务与认领由工作台管理</p>'
    brand = '<a class="brand" href="/" aria-label="知行知识库首页"><span class="brand-mark">◇<i></i></span><span><b>知行 <small>知识库</small></b><em>你的知识，自成宇宙。</em></span></a>'
    controls = f'<div class="appearance"><button type="button" class="icon-button" data-theme-switch aria-label="切换深浅主题" title="切换深浅主题">{icon("sun")}</button><button type="button" class="motion-button" data-motion-switch aria-pressed="false">{icon("pause")}<span>暂停动效</span></button></div>'
    if login:
        frame = f'<main id="main" class="auth-root">{body}</main><div class="auth-appearance">{controls}</div>'
    else:
        frame = f'''<a href="#main" class="skip">跳到主要内容</a><button class="scrim" data-close-menu hidden aria-label="关闭导航"></button>
<aside class="sidebar" id="sidebar" aria-label="知识库导航">{brand}<div class="space-card">{icon("orbit")}<div>个人知识空间<small>长期积累 · 本地优先</small></div></div><p class="nav-label">知识与关联 <span></span></p><nav>{links}</nav><div class="sidebar-bottom">{work}<div class="sidebar-caption">从一条笔记，<br>到一片知识星空。</div><a href="/auth/read">更换访问凭证 ↗</a></div></aside>
<div class="main-shell"><header class="topbar"><button class="icon-button mobile-toggle" type="button" data-menu aria-expanded="false" aria-controls="sidebar" aria-label="展开导航">{icon("menu")}</button><div class="breadcrumb">个人知识空间 <span>/</span> <strong>{e(title)}</strong></div><form action="/notes" class="global-search" role="search">{icon("search")}<input name="q" type="search" placeholder="搜索知识与关联…" aria-label="全局搜索知识" autocomplete="off"><kbd>Ctrl K</kbd></form>{controls}<a class="button primary top-create" href="/edit">{icon("plus")} 新建笔记</a></header><main id="main" tabindex="-1">{body}</main><footer><span>知行知识库 <i>·</i> 知识是可以复用的积累。</span><span>独立 Wiki 服务 · 原始内容留在本地</span></footer></div>'''
    return f'''<!doctype html><html lang="zh-CN" data-theme="ink"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>{e(title)} · 知行知识库</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/assets/wiki.css?v={version}"><script src="/assets/wiki.js?v={version}"></script></head><body>{frame}<div id="toast" role="status" aria-live="polite"></div></body></html>'''.encode("utf-8")


def heading(title: str, subtitle: str, number: str, action: str = "") -> str:
    return f'<header class="page-heading"><div><p class="eyebrow"><span>{number}</span> 知识 · 关联 · 生长</p><h1>{e(title)}</h1><p>{e(subtitle)}</p></div>{action}</header>'


def inline(text: str, lookup: dict[str, str] | None = None) -> str:
    # 先识别代码与链接，再转义普通文本；禁止原生 HTML 和可执行 URL。
    pattern = r'(`[^`]+`|\[\[[^\]]+\]\]|!?\[[^\]]+\]\([^)]+\))'
    parts = []
    for token in re.split(pattern, text):
        if token.startswith("`") and token.endswith("`"):
            parts.append(f'<code>{e(token[1:-1])}</code>')
        elif token.startswith("[[") and token.endswith("]]"):
            target, _, display = token[2:-2].partition("|")
            target = target.split("#")[0].strip()
            note = (lookup or {}).get(target)
            parts.append(f'<a class="wikilink" href="{e(url("/note", path=note) if note else url("/notes", concept=target))}">{e(display or target)}</a>')
        elif re.fullmatch(r'!?\[[^\]]+\]\([^)]+\)', token):
            match = re.fullmatch(r'!?\[([^\]]+)\]\(([^)]+)\)', token)
            href = safe_href(match[2])
            # 外部图片只生成来源链接，不让受保护的知识页自动向第三方发请求。
            parts.append(f'<a href="{e(href)}" rel="noreferrer noopener">{e(match[1])}</a>' if href else e(match[1]))
        else:
            value = e(token)
            value = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', value)
            value = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', value)
            parts.append(value)
    return "".join(parts)


def markdown(body: str, lookup: dict[str, str] | None = None) -> tuple[str, str]:
    lines = body.replace("\r\n", "\n").splitlines()
    output, toc, paragraph = [], [], []
    index, serial = 0, 0
    def flush():
        if paragraph:
            output.append("<p>" + inline("\n".join(paragraph), lookup) + "</p>")
            paragraph.clear()
    while index < len(lines):
        line = lines[index]
        if line.startswith("```") or line.startswith("~~~"):
            flush(); fence = line[:3]; language = line[3:].strip(); block = []; index += 1
            while index < len(lines) and not lines[index].startswith(fence):
                block.append(lines[index]); index += 1
            output.append(f'<div class="code-block"><div><span>{e(language or "代码")}</span><button type="button" data-copy-code>复制</button></div><pre><code>{e(chr(10).join(block))}</code></pre></div>')
        elif re.match(r'^#{1,6}\s', line):
            flush(); match = re.match(r'^(#{1,6})\s+(.+)$', line); serial += 1
            level = len(match[1]); anchor = f"section-{serial}"
            output.append(f'<h{level} id="{anchor}">{inline(match[2], lookup)}</h{level}>')
            if level <= 3:
                toc.append(f'<a href="#{anchor}" class="toc-depth-{level}">{e(match[2])}</a>')
        elif index + 1 < len(lines) and "|" in line and re.fullmatch(r'\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*', lines[index + 1]):
            flush(); columns = [x.strip() for x in line.strip().strip("|").split("|")]
            table = ['<div class="table-scroll" tabindex="0" role="region" aria-label="内容表格"><table><thead><tr>' + ''.join(f'<th>{inline(c, lookup)}</th>' for c in columns) + '</tr></thead><tbody>']; index += 2
            while index < len(lines) and "|" in lines[index] and lines[index].strip():
                cells = lines[index].strip().strip("|").split("|")
                table.append('<tr>' + ''.join(f'<td>{inline(c.strip(), lookup)}</td>' for c in cells) + '</tr>'); index += 1
            table.append('</tbody></table></div>'); output.append(''.join(table)); index -= 1
        elif re.match(r'^\s*(?:[-*+] |\d+[.)] )', line):
            flush(); ordered = bool(re.match(r'^\s*\d+[.)] ', line)); tag = "ol" if ordered else "ul"; items = []
            while index < len(lines) and re.match(r'^\s*(?:[-*+] |\d+[.)] )', lines[index]) and bool(re.match(r'^\s*\d+[.)] ', lines[index])) == ordered:
                value = re.sub(r'^\s*(?:[-*+] |\d+[.)] )', '', lines[index]); check = re.match(r'^\[([ xX])\]\s*(.*)', value)
                if check:
                    value = f'<span class="check-symbol" aria-label="{"已完成" if check[1].lower() == "x" else "未完成"}">{"✓" if check[1].lower() == "x" else "□"}</span>' + inline(check[2], lookup)
                else:
                    value = inline(value, lookup)
                items.append(f'<li>{value}</li>'); index += 1
            output.append(f'<{tag}>' + ''.join(items) + f'</{tag}>'); index -= 1
        elif line.startswith(">"):
            flush(); block = []
            while index < len(lines) and lines[index].startswith(">"):
                block.append(lines[index].lstrip("> ")); index += 1
            output.append('<blockquote>' + inline('\n'.join(block), lookup) + '</blockquote>'); index -= 1
        elif re.fullmatch(r'\s*(---+|\*\*\*+)\s*', line):
            flush(); output.append('<hr>')
        elif not line.strip():
            flush()
        else:
            paragraph.append(line)
        index += 1
    flush()
    return ''.join(output) or empty("正文尚未整理", "可先记录来源，再逐步补充结论。"), ''.join(toc)


def note_link(path: str, revision: str = "") -> str:
    return url("/note", path=path, revision=revision)


def note_card(note: dict, index: int = 0) -> str:
    tags = ''.join(f'<span>{e(tag)}</span>' for tag in note.get("tags", [])[:3])
    return f'''<a class="note-card" href="{e(note_link(note["path"]))}"><div class="card-top"><span class="card-number">{index + 1:02d}</span>{badge(note.get("status") or "draft")}</div><h3>{e(note["title"])}</h3><p>{e(note.get("excerpt") or "等待整理正文与来源。")}</p><div class="card-tags">{tags}</div><div class="card-bottom"><span>{e(label(note.get("source_type"), "知识页面"))} <i>·</i> {e(str(note.get("created") or note.get("updated") or "未记录日期")[:10])}</span>{icon("arrow")}</div></a>'''


def cover_art() -> str:
    # 静态参数化线稿仅作概念主视觉；真实关系只出现在知识图谱页。
    paths = []
    for i in range(26):
        shift = i * 3.7
        paths.append(f'<path d="M{72+shift:.1f} {264-shift*.11:.1f} C {58+shift*.7:.1f} {76-shift*.15:.1f}, {230+shift:.1f} {18+shift*.5:.1f}, {363+shift*.6:.1f} {162+shift*.55:.1f} S {154+shift:.1f} {420-shift:.1f}, {72+shift:.1f} {264-shift*.11:.1f}"/>')
    return f'<div class="atlas-art" aria-hidden="true"><div class="art-halo"></div><svg class="contour" viewBox="0 0 550 400"><g class="art-lines">{"".join(paths)}</g><circle class="orbit" cx="271" cy="204" r="167"/><g class="orbiter"><circle cx="270" cy="37" r="4"/></g><path class="art-axis" d="M40 200h45m390 0h40M270 11v25m0 326v25"/><text x="270" y="196" text-anchor="middle">知 · 藏</text><text class="art-caption" x="270" y="220" text-anchor="middle">让碎片有归处，让知识有来路</text></svg><span class="art-note">知识生长 · 概念线稿</span></div>'


def render_home() -> bytes:
    index = wiki.load_note_index(); notes = index.get("notes", []); graph = wiki.load_graph()
    count = len(notes); links = len(graph.get("links", [])); tags = index.get("tags", []); concepts = index.get("concepts", [])
    art = cover_art()
    hero = f'''<section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="rule"></span> 个人知识收藏与关联</p><h2>收藏有序，<br><em>所知成林。</em></h2><p>把灵感、阅读和实践留存下来。<br>从一条笔记出发，找到下一条线索。</p><div class="actions"><a class="button primary" href="/notes">打开知识收藏 {icon("arrow")}</a><a class="text-link" href="/graph">探索关联星图 ↗</a></div></div>{art}<div class="hero-foot"><span>01 收集碎片</span><i></i><span>02 沉淀知识</span><i></i><span>03 建立关联</span><small>独立知识服务 / PERSONAL WIKI</small></div></section>'''
    metrics = '<div class="metrics">' + ''.join(f'<a href="{href}"><span>{name} {icon("arrow")}</span><strong>{value:02d}</strong><small>{caption}</small></a>' for name, value, caption, href in [("知识笔记", count, "已收录的可检索内容", "/notes"), ("知识概念", len(concepts), "笔记中出现的概念引用", "/concepts"), ("整理标签", len(tags), "从不同角度组织知识", "/tags"), ("关系连线", links, "显式引用、标签与算法关联", "/graph")]) + '</div>'
    cards = ''.join(note_card(n, i) for i, n in enumerate(notes[:6])) or empty("从第一条笔记开始", "新建一篇笔记，或让智能体通过知识接口收集资料。")
    facets = ''.join(f'<a class="facet-row" href="{e(url("/notes", tag=t["name"]))}"><span># {e(t["name"])}</span><small>{t["count"]} 篇</small>{icon("arrow")}</a>' for t in tags[:7])
    body = heading("知识总览", "在这里收藏、整理、连接你的长期知识。", "01") + hero + metrics + f'<div class="home-columns"><section><div class="section-head"><div><span class="eyebrow">最近收录</span><h2>沿着知识，继续生长。</h2></div><a class="text-link" href="/notes">全部笔记 ↗</a></div><div class="note-grid">{cards}</div></section><aside class="home-aside"><section class="panel"><div class="section-head"><h3>常用标签</h3>{icon("tag")}</div>{facets or "<p class=muted>为笔记添加标签后显示。</p>"}<a class="text-link more" href="/tags">完整标签索引 ↗</a></section><section class="quote-panel"><span>知 / 识 / 生 / 长</span><blockquote>不是存得更多，<br>而是让所知<br><em>彼此相连。</em></blockquote><a class="text-link" href="/graph">进入知识图谱 {icon("arrow")}</a></section></aside></div>'
    return shell("知识总览", body)


def render_notes(query: dict) -> bytes:
    get = lambda key: query.get(key, [""])[0].strip()[:200]
    rows = wiki.filtered_notes(get("q"), get("tag"), get("concept"), get("source_type"))
    status = get("status")
    if status:
        rows = [n for n in rows if (n.get("status") or "draft") == status]
    page = wiki.parse_positive_int(get("page") or "1", 1); pages = max(1, math.ceil(len(rows) / 18)); page = min(page, pages)
    index = wiki.load_note_index(); opts = '<option value="">全部来源</option>' + ''.join(f'<option value="{e(i["name"])}" {"selected" if get("source_type") == i["name"] else ""}>{e(label(i["name"]))}</option>' for i in index.get("source_types", []))
    hidden = ''.join(f'<input type="hidden" name="{key}" value="{e(get(key))}">' for key in ("tag", "concept") if get(key))
    filters = f'<form action="/notes" class="filters"><div class="search-field">{icon("search")}<input name="q" value="{e(get("q"))}" type="search" placeholder="搜索标题、正文与标签…" aria-label="搜索笔记"></div><select name="source_type" aria-label="来源类型">{opts}</select><select name="status" aria-label="发布状态"><option value="">全部状态</option>' + ''.join(f'<option value="{v}" {"selected" if status == v else ""}>{label(v)}</option>' for v in ("draft", "published", "deprecated")) + f'</select>{hidden}<button class="button" type="submit">筛选</button><a href="/notes" class="text-link">重置</a></form>'
    context = " · ".join(f'{label(k, k)}：{get(k)}' for k in ("tag", "concept") if get(k)).replace("concept：", "概念：").replace("共同标签：", "标签：")
    pager = '<nav class="pagination" aria-label="笔记分页">'
    params = {k: get(k) for k in ("q", "tag", "concept", "source_type", "status")}
    pager += f'<span>共 {len(rows)} 篇 · 第 {page} / {pages} 页</span><div>'
    if page > 1: pager += f'<a class="button" href="{e(url("/notes", **params, page=page-1))}">上一页</a>'
    if page < pages: pager += f'<a class="button" href="{e(url("/notes", **params, page=page+1))}">下一页</a>'
    pager += '</div></nav>'
    cards = ''.join(note_card(n, (page - 1) * 18 + i) for i, n in enumerate(rows[(page-1)*18:page*18]))
    return shell("全部笔记", heading("全部笔记", "不让收藏落灰。通过正文、来源、标签与概念找到所需内容。", "02", '<a class="button primary" href="/edit">＋ 新建笔记</a>') + filters + f'<div class="result-bar"><span>{len(rows)} 篇知识 {e(context)}</span><div class="view-switch"><button type="button" data-view="cards" aria-pressed="true">卡片</button><button type="button" data-view="list" aria-pressed="false">列表</button></div></div><div class="note-grid collection" id="note-collection">{cards or empty("没有找到匹配内容", "尝试更短的关键词，或清除筛选条件。")}</div>{pager}', "/notes")


def render_facets(kind: str, query: dict) -> bytes:
    name = "标签索引" if kind == "tags" else "概念索引"; param = "tag" if kind == "tags" else "concept"
    rows = wiki.load_note_index().get(kind, []); q = query.get("q", [""])[0].strip()[:200]
    rows = [n for n in rows if q.casefold() in n["name"].casefold()]
    page = min(wiki.parse_positive_int(query.get("page", ["1"])[0], 1), max(1, math.ceil(len(rows)/60)))
    maximum = max([n["count"] for n in rows] or [1]); tiles = []
    for i, item in enumerate(rows[(page-1)*60:page*60]):
        tiles.append(f'<a class="facet-tile" href="{e(url("/notes", **{param: item["name"]}))}"><span class="facet-symbol">{icon("tag" if kind == "tags" else "spark")}</span><span class="facet-number">{(page-1)*60+i+1:02d}</span><h2>{e(item["name"])}</h2><p>{item["count"]} 篇笔记引用 {icon("arrow")}</p><meter min="0" max="{maximum}" value="{item["count"]}">{item["count"]}</meter></a>')
    subtitle = "按主题整理知识，让每个关键词都成为入口。" if kind == "tags" else "概念来自笔记中的双链引用；出现频次不代表内容已被验证。"
    pager = ''.join(f'<a class="button" href="{e(url("/"+kind, q=q, page=p))}">{text}</a>' for p, text in [(page-1, "上一页"), (page+1, "下一页")] if 1 <= p <= math.ceil(len(rows)/60))
    body = heading(name, subtitle, "04" if kind == "tags" else "05") + f'<form class="filters" action="/{kind}"><div class="search-field">{icon("search")}<input name="q" value="{e(q)}" type="search" aria-label="搜索{name}" placeholder="查找{name}…"></div><button class="button">搜索</button></form><div class="result-bar">共 {len(rows)} 个{name[:2]} · 按引用篇数排序</div><div class="facet-grid">{"".join(tiles) or empty("还没有匹配项", "在笔记中添加标签或使用双方括号建立概念引用。")}</div><nav class="pagination" aria-label="索引分页"><span>第 {page} 页</span><div>{pager}</div></nav>'
    return shell(name, body, "/" + kind)


def render_note(query: dict) -> bytes:
    relative = query.get("path", [""])[0]; revision = query.get("revision", [""])[0]
    with knowledge.vault_lock():
        note = knowledge.read_managed_note(relative, revision)
    fm = note["frontmatter"]; content, toc = markdown(note["content"], wiki.build_note_lookup(wiki.load_note_index()))
    graph = wiki.load_graph(); nodes = {n["id"]: n for n in graph.get("nodes", [])}; backlinks, related = [], []
    for link in graph.get("links", []):
        src, target = link.get("source"), link.get("target")
        if target == relative and link.get("type") == "wikilink" and src in nodes:
            backlinks.append(nodes[src])
        elif relative in (src, target):
            other = nodes.get(target if src == relative else src)
            if other and other.get("kind") == "note": related.append(other)
    backlinks = list({n["id"]: n for n in backlinks}.values())
    related = list({n["id"]: n for n in related}.values())[:8]
    def related_links(items: list) -> str:
        return ''.join(f'<a class="related-link" href="{e(note_link(n["path"]))}">{icon("link")}<span>{e(n["label"])}</span>↗</a>' for n in items) or '<p class="muted small">暂未发现关联笔记。</p>'
    tags = ''.join(f'<a class="tag" href="{e(url("/notes", tag=t))}"># {e(t)}</a>' for t in wiki.normalize_tags(fm.get("tags", [])))
    history = ''.join(f'<a class="history-row" href="{e(note_link(relative, h["revision"]))}"><span>{e(h["savedAt"][:19].replace("T", " "))} UTC</span><code>{h["revision"][:10]}</code></a>' for h in note.get("history", [])) or '<p class="muted small">该笔记尚未通过版本接口保存快照。</p>'
    source = str(fm.get("source_url") or ""); source_html = f'<a href="{e(safe_href(source))}" rel="noreferrer noopener">{e(source)}</a>' if safe_href(source) else e(source or "尚未记录来源")
    warning = '<div class="notice">正在阅读历史快照，不是当前最新版。<a href="' + e(note_link(relative)) + '">切回当前版本 ↗</a></div>' if note["historical"] else ''
    due = wiki.note_sort_value(fm.get("valid_until", ""))
    if due and due < wiki.now_utc().timestamp(): warning += '<div class="notice">复核期限已过。请确认内容仍然适用，再将其作为执行依据。</div>'
    edit = f'<a class="button" href="{e(url("/edit", path=relative))}">{icon("edit")} 编辑当前版本</a>' if not note["historical"] else ''
    body = f'''<div class="reader-breadcrumb"><a href="/notes">全部笔记</a><span>/</span><span>{e(fm.get("book") or "知识收藏")}</span><div class="actions">{edit}<button class="button" type="button" data-copy-link>复制版本链接</button><a class="button" href="{e(url("/graph", focus=relative))}">关系图谱 ↗</a></div></div>{warning}
<div class="reader-layout"><aside class="reader-toc"><span class="eyebrow">本页目录</span><nav>{toc or '<span class="muted">本页没有章节标题。</span>'}</nav><a class="text-link" href="#note-source">来源与版本</a></aside><article class="reader-article"><div class="article-category">{icon("book")} {e(fm.get("space") or "个人知识空间")} <span>/</span> {e(fm.get("chapter") or "知识笔记")}</div><h1>{e(note["title"])}</h1><div class="article-meta"><span>{e(fm.get("owner") or "维护人待指定")}</span><i>·</i><time>{e(str(fm.get("updated") or fm.get("created") or "未记录日期")[:10])}</time>{badge(fm.get("status") or "draft")}{badge(fm.get("confidence") or "speculative")}</div><div class="article-tags">{tags}</div><div class="reading-line"></div><div class="markdown">{content}</div><section class="article-source" id="note-source"><span class="eyebrow">知识的来路</span><h2>来源与版本</h2><p>{source_html}</p><details><summary>技术标识与完整版本</summary><dl><dt>笔记路径</dt><dd><code>{e(relative)}</code></dd><dt>稳定编号</dt><dd><code>{e(note["id"])}</code></dd><dt>内容版本</dt><dd><code>{note["revision"]}</code></dd><dt>资料级别</dt><dd>{e(label(fm.get("sensitivity"), "未标注"))}（内容标注，不等于访问隔离）</dd></dl></details></section></article><aside class="reader-related"><section><span class="eyebrow">反向链接</span><h3>{len(backlinks)} 篇笔记引用此页</h3>{related_links(backlinks[:15])}</section><section><span class="eyebrow">继续探索</span><h3>关联笔记</h3>{related_links(related)}<small class="muted">关联基于当前索引，不重建历史关系。</small></section><details open><summary>版本记录</summary>{history}</details></aside></div>{data_script("note-meta", {"path": relative, "revision": note["revision"]})}'''
    return shell(note["title"], body, "/notes")


def render_graph(query: dict) -> bytes:
    graph = wiki.load_graph(); focus = query.get("focus", [""])[0]
    payload = {"nodes": [{k: n.get(k) for k in ("id", "label", "kind", "path", "weight")} for n in graph.get("nodes", [])], "links": [{"source": link.get("source"), "target": link.get("target"), "kind": link.get("type"), "score": link.get("score", 0)} for link in graph.get("links", [])], "focus": focus}
    body = heading("知识图谱", "看见笔记之间的线索。节点与连线来自当前知识库，不是装饰数据。", "03") + '''<section class="graph-workspace"><div class="graph-toolbar"><div class="search-field">''' + icon("search") + '''<input id="graph-search" type="search" placeholder="定位笔记、标签或概念…" aria-label="定位图谱节点"></div><label>关联范围<select id="graph-kind"><option value="all">全部类型</option><option value="note">仅笔记</option><option value="concept">笔记与概念</option><option value="tag">笔记与标签</option></select></label><label>算法关联<select id="graph-strength"><option value="0">全部强度</option><option value="0.5">≥ 0.5</option><option value="0.7">≥ 0.7</option></select></label><button class="button" id="graph-reset">重置视图</button></div><div class="graph-content"><div class="graph-canvas"><svg id="knowledge-graph" viewBox="0 0 1100 680" role="group" aria-label="可交互知识图谱"></svg><div class="graph-watermark">知 识 星 图<small>从关联出发，读懂全局。</small></div><div class="graph-zoom"><button aria-label="放大图谱" data-zoom="1.2">＋</button><button aria-label="缩小图谱" data-zoom="0.8">−</button></div><div class="graph-legend"><span class="legend-note">笔记</span><span class="legend-concept">概念</span><span class="legend-tag">标签</span></div><p id="graph-status" class="graph-status" role="status"></p></div><aside class="graph-inspector"><span class="eyebrow">关联观察</span><h2 id="graph-title">选择一颗知识节点</h2><p id="graph-description">单击节点查看关联，再打开笔记；拖动画布平移，用按钮缩放。键盘可聚焦节点并回车选择。</p><a id="graph-open" class="button primary" hidden>打开相关内容 ↗</a><div id="graph-relations"></div><div class="graph-explain"><h3>关系的含义</h3><p>显式引用来自双方括号链接。算法关联是文本相似度线索，不代表事实已核验。标签只说明分类关系。</p></div></aside></div></section>''' + data_script("graph-data", payload)
    return shell("知识图谱", body, "/graph")


def render_editor(query: dict) -> bytes:
    relative = query.get("path", [""])[0]
    if relative:
        with knowledge.vault_lock(): note = knowledge.read_managed_note(relative)
    else:
        note = {"title": "", "content": "## 核心结论\n\n\n## 依据与来源\n\n\n## 操作步骤\n\n1. \n\n## 验收标准\n\n- [ ] \n\n## 相关概念\n\n", "frontmatter": {}, "path": "", "revision": ""}
    fm = note["frontmatter"]
    def field(name: str, title: str, default: str = "", kind: str = "text") -> str:
        return f'<label>{title}<input name="{name}" type="{kind}" value="{e(fm.get(name) or default)}" maxlength="{500 if name == "source_url" else 160}"></label>'
    def select(name: str, title: str, values: tuple, default: str) -> str:
        return f'<label>{title}<select name="{name}">' + ''.join(f'<option value="{v}" {"selected" if fm.get(name, default) == v else ""}>{label(v)}</option>' for v in values) + '</select></label>'
    body = heading("编辑知识" if relative else "新建笔记", "让结论、依据与操作步骤清楚地留存。保存会检查版本，保留历史快照。", "写") + f'''<form id="note-editor" class="editor-layout" autocomplete="off"><section class="editor-paper"><label class="editor-title-label">笔记标题<input name="title" required maxlength="200" value="{e(note["title"])}" placeholder="给这份知识一个清晰的名字"></label><div class="editor-tools"><span>Markdown 正文 · 支持 [[概念链接]]</span><button type="button" class="text-link" data-insert="heading">插入标题</button><button type="button" class="text-link" data-insert="link">插入双链</button><button type="button" class="text-link" data-insert="list">插入步骤</button></div><label class="sr-only" for="editor-content">笔记正文</label><textarea id="editor-content" name="content" required maxlength="200000" spellcheck="false">{e(note["content"])}</textarea><div class="editor-foot"><span id="character-count"></span><span>未保存内容仅保留在当前页面</span></div></section><aside class="editor-meta"><div class="panel"><h2>整理与发布</h2>{field("space", "知识空间", "个人知识空间")}{field("book", "所属手册", "知识收藏")}{field("chapter", "章节", "日常整理")}{field("owner", "维护人")}{select("status", "发布状态", ("draft", "published", "deprecated"), "draft")}{select("confidence", "可信程度", ("speculative", "inferred", "verified"), "speculative")}{select("sensitivity", "资料级别", ("internal", "private", "public"), "internal")}{field("valid_until", "复核到期日期", "", "date")}<label>标签<input name="tags" value="{e(', '.join(wiki.normalize_tags(fm.get('tags', []))))}" placeholder="用逗号分隔" maxlength="2400"></label>{field("source_url", "来源地址")}<div class="editor-auth">{icon("shield")}<strong>写入权限验证</strong><p>读取会话不能写入。凭证仅用于本次请求，不保存到本机。</p><label>知识写入凭证<input name="writeToken" type="password" required autocomplete="off" maxlength="500" placeholder="输入知识服务的写入凭证"></label></div><div class="notice small">“已核验”和资料级别为人工标注，不代替事实检查或账号权限。</div><p id="save-status" role="status" aria-live="polite"></p><button class="button primary full" type="submit">{icon("edit")} 保存笔记与版本</button><a class="text-link more" href="{e(note_link(relative) if relative else '/notes')}">取消并返回</a></div></aside></form>''' + data_script("editor-data", {"path": note["path"], "revision": note["revision"], "requestId": secrets.token_hex(16)})
    return shell("编辑知识" if relative else "新建笔记", body, "/notes")


def render_manual() -> bytes:
    raw = wiki.MANUAL_PATH.read_text(encoding="utf-8-sig")
    content, toc = markdown(raw)
    return shell("使用与接入", heading("使用与接入", "从手动整理到智能体调用，一份与当前服务对应的使用说明。", "06", '<a class="button" href="/docs/USAGE.md">读取原始 Markdown ↗</a>') + f'<div class="reader-layout manual-layout"><aside class="reader-toc"><span class="eyebrow">使用目录</span><nav>{toc}</nav></aside><article class="reader-article markdown">{content}</article></div>', "/manual")


def render_login(next_url: str = "/", error: str = "") -> bytes:
    alert = f'<p class="notice" role="alert">{e(error)}</p>' if error else ''
    body = f'<div class="auth-art"><a class="auth-brand" href="/">◇ 知行 · 知识库</a><div><p class="eyebrow">你的知识，自成宇宙。</p><h1>有所知，<br><em>亦有所藏。</em></h1><p>留住每一次思考的来路，<br>在需要时，重新找到它。</p></div>{cover_art()}<small>独立知识服务 · 本地优先</small></div><section class="auth-form"><span class="eyebrow">进入个人知识空间</span><h2>知识库访问验证</h2><p>使用知识库的读取凭证。<br>工作台凭证与知识库凭证相互独立。</p>{alert}<form method="post" action="/auth/read"><input type="hidden" name="next" value="{e(local_next(next_url))}"><label>读取凭证<input name="token" type="password" autocomplete="current-password" required maxlength="500" placeholder="请输入读取凭证"></label><button class="button primary full" type="submit">进入知识库 {icon("arrow")}</button></form><div class="auth-note">{icon("shield")}凭证通过请求正文发送，不写入页面地址。</div></section>'
    return shell("知识库访问验证", body, login=True)


class Handler(knowledge.Handler):
    """只替换 HTML 交互层；所有业务写入仍由原有受管接口处理。"""
    def html(self, status: HTTPStatus, payload: bytes) -> None:
        self.send_response(status.value)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'")
        self.end_headers(); self.wfile.write(payload)

    def do_GET(self) -> None:
        parsed = urlparse(self.path); route = parsed.path; query = parse_qs(parsed.query)
        if route.startswith("/assets/"):
            names = {"/assets/wiki.css": ("wiki.css", "text/css; charset=utf-8"), "/assets/wiki.js": ("wiki.js", "text/javascript; charset=utf-8")}
            if route not in names:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"}); return
            filename, content_type = names[route]; data = (ASSETS / filename).read_bytes()
            self.send_response(200); self.send_header("Content-Type", content_type); self.send_header("Content-Length", str(len(data))); self.send_header("Cache-Control", "public, max-age=3600"); self.send_header("X-Content-Type-Options", "nosniff"); self.end_headers(); self.wfile.write(data); return
        if route == "/auth/read":
            self.html(HTTPStatus.OK, render_login(query.get("next", ["/"])[0])); return
        if route.startswith("/api/") or route == "/docs/USAGE.md":
            super().do_GET(); return
        # 未登录的页面访问保留原路径，跳转到中文凭证页。
        if not self.authorized_read(wiki.REQUIRE_PAGE_READ_AUTH):
            self.send_response(302); self.send_header("Location", url("/auth/read", next=local_next(self.path))); self.send_header("Cache-Control", "no-store"); self.send_header("Content-Length", "0"); self.end_headers(); return
        try:
            handlers = {"/": lambda: render_home(), "/notes": lambda: render_notes(query), "/note": lambda: render_note(query), "/graph": lambda: render_graph(query), "/tags": lambda: render_facets("tags", query), "/concepts": lambda: render_facets("concepts", query), "/edit": lambda: render_editor(query), "/manual": lambda: render_manual()}
            if route not in handlers: raise FileNotFoundError()
            self.html(HTTPStatus.OK, handlers[route]())
        except FileNotFoundError:
            self.html(HTTPStatus.NOT_FOUND, shell("内容未找到", heading("这条线索暂时不在这里。", "笔记可能已移动，或指定的历史版本不存在。不会用其他版本替代。", "404") + empty("回到知识库继续查找", "从目录或关键词重新找到所需内容。")))
        except (ValueError, UnicodeError):
            self.html(HTTPStatus.BAD_REQUEST, shell("无法读取内容", heading("地址或内容格式不正确", "请检查笔记路径和版本编号。", "400") + empty("无法打开这份内容", "返回目录查找，或联系维护人检查知识文件。")))
        except Exception:
            wiki.traceback.print_exc()
            self.html(HTTPStatus.INTERNAL_SERVER_ERROR, shell("知识服务暂不可用", empty("暂时无法读取知识", "请稍后重试，或联系维护人检查服务日志。")))

    def do_POST(self) -> None:
        # 表单登录失败同样使用中文 HTML，而不是暴露原始 JSON 错误。
        if urlparse(self.path).path != "/auth/read":
            super().do_POST(); return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if self.headers.get("Transfer-Encoding") or not 0 < length <= 8192:
                raise ValueError()
            form = self.read_form(); target = local_next(form.get("next", ["/"])[0]); token = form.get("token", [""])[0]
            allowed = self.read_auth_tokens()
            if not allowed:
                self.html(HTTPStatus.SERVICE_UNAVAILABLE, render_login(target, "此服务尚未配置读取凭证，请联系维护人。")); return
            if not self.token_allowed(token, allowed):
                self.html(HTTPStatus.UNAUTHORIZED, render_login(target, "读取凭证不正确，请重新输入。")); return
            self.send_response(303); self.send_header("Location", target); self.send_header("Set-Cookie", self.read_cookie_header(token)); self.send_header("Cache-Control", "no-store"); self.send_header("Content-Length", "0"); self.end_headers()
        except (ValueError, UnicodeError):
            self.html(HTTPStatus.BAD_REQUEST, render_login("/", "登录请求格式不正确，请重新输入。"))


def main() -> None:
    wiki.ensure_dirs()
    if not wiki.GRAPH_PATH.exists() or not wiki.NOTE_INDEX_PATH.exists(): wiki.refresh_public_indexes()
    server = wiki.ThreadingHTTPServer((wiki.HOST, wiki.PORT), Handler)
    print(f"知行独立知识库已启动，端口 {wiki.PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
