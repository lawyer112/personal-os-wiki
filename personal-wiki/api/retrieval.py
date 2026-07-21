from __future__ import annotations

import hashlib
import math
import re
from typing import Any


HEADING_RE = re.compile(r"(?m)^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*(?:\r?\n|$)")
FENCE_RE = re.compile(r"^[ \t]*(```|~~~)")
QUERY_TOKEN_RE = re.compile(r"[A-Za-z0-9_]+|[\u3400-\u4dbf\u4e00-\u9fff]+", re.UNICODE)
CJK_RUN_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]+")
HAN_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")
LATIN_TOKEN_RE = re.compile(r"[A-Za-z0-9_]+")


def _trim_span(text: str, start: int, end: int) -> tuple[int, int]:
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    return start, end


def _markdown_headings(text: str) -> list[dict[str, Any]]:
    headings: list[dict[str, Any]] = []
    cursor = 0
    in_fence = False
    fence_marker = ""
    for line in text.splitlines(keepends=True):
        fence = FENCE_RE.match(line)
        if fence:
            marker = fence.group(1)
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif marker == fence_marker:
                in_fence = False
                fence_marker = ""
            cursor += len(line)
            continue
        if not in_fence:
            match = HEADING_RE.match(line)
            if match:
                headings.append(
                    {
                        "start": cursor,
                        "level": len(match.group(1)),
                        "label": match.group(2).strip().strip("#").strip(),
                    }
                )
        cursor += len(line)
    return headings


def _heading_sections(text: str) -> list[dict[str, Any]]:
    matches = _markdown_headings(text)
    sections: list[dict[str, Any]] = []
    if not matches:
        start, end = _trim_span(text, 0, len(text))
        if start < end:
            sections.append({"start": start, "end": end, "heading_path": [], "heading_level": 0})
        return sections

    prefix_start, prefix_end = _trim_span(text, 0, int(matches[0]["start"]))
    if prefix_start < prefix_end:
        sections.append(
            {"start": prefix_start, "end": prefix_end, "heading_path": [], "heading_level": 0}
        )

    heading_stack: list[str] = []
    for index, match in enumerate(matches):
        level = int(match["level"])
        label = str(match["label"])
        heading_stack = heading_stack[: max(0, level - 1)]
        heading_stack.append(label)
        section_end = int(matches[index + 1]["start"]) if index + 1 < len(matches) else len(text)
        start, end = _trim_span(text, int(match["start"]), section_end)
        if start < end:
            sections.append(
                {
                    "start": start,
                    "end": end,
                    "heading_path": list(heading_stack),
                    "heading_level": level,
                }
            )
    return sections


def _block_spans(text: str, start: int, end: int) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    block_start: int | None = None
    cursor = start
    in_fence = False
    fence_marker = ""

    for line in text[start:end].splitlines(keepends=True):
        line_start = cursor
        line_end = cursor + len(line)
        stripped = line.strip()
        fence = FENCE_RE.match(line)

        if fence:
            marker = fence.group(1)
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif marker == fence_marker:
                in_fence = False
                fence_marker = ""

        if not stripped and not in_fence:
            if block_start is not None:
                span_start, span_end = _trim_span(text, block_start, line_start)
                if span_start < span_end:
                    spans.append((span_start, span_end))
                block_start = None
        elif block_start is None:
            block_start = line_start
        cursor = line_end

    if block_start is not None:
        span_start, span_end = _trim_span(text, block_start, end)
        if span_start < span_end:
            spans.append((span_start, span_end))
    return spans


def _preferred_cut(text: str, start: int, target: int, end: int, minimum: int) -> int:
    search_start = min(target, start + max(minimum, (target - start) // 2))
    best = -1
    suffix = 0
    for separator in ("\n\n", "\n", "。", "！", "？", "; ", "；", ". ", " "):
        position = text.rfind(separator, search_start, min(target + 1, end))
        if position > best:
            best = position
            suffix = len(separator)
    if best <= start:
        return min(target, end)
    return min(best + suffix, end)


def _split_span(text: str, start: int, end: int, size: int) -> list[tuple[int, int]]:
    chunks: list[tuple[int, int]] = []
    cursor = start
    minimum = max(80, size // 3)
    while end - cursor > size:
        cut = _preferred_cut(text, cursor, cursor + size, end, minimum)
        if cut <= cursor:
            cut = min(cursor + size, end)
        span_start, span_end = _trim_span(text, cursor, cut)
        if span_start < span_end:
            chunks.append((span_start, span_end))
        cursor = cut
        while cursor < end and text[cursor].isspace():
            cursor += 1
    span_start, span_end = _trim_span(text, cursor, end)
    if span_start < span_end:
        chunks.append((span_start, span_end))
    return chunks


def build_structured_chunks(
    text: str,
    *,
    title: str,
    path: str,
    size: int = 900,
) -> list[dict[str, Any]]:
    """Split Markdown on headings and block boundaries while retaining source ranges."""

    if not text.strip():
        return []
    size = max(240, int(size or 900))
    results: list[dict[str, Any]] = []
    section_ids_by_heading: dict[tuple[str, ...], str] = {}

    for section in _heading_sections(text):
        section_start = int(section["start"])
        section_end = int(section["end"])
        heading_path = list(section["heading_path"])
        heading_level = int(section["heading_level"])
        section_seed = f"{path}\0{section_start}\0{'/'.join(heading_path)}"
        section_id = "section:" + hashlib.sha1(section_seed.encode("utf-8")).hexdigest()[:16]
        parent_id = (
            section_ids_by_heading.get(tuple(heading_path[:-1]), "")
            if len(heading_path) > 1
            else ""
        )
        if heading_path:
            section_ids_by_heading[tuple(heading_path)] = section_id
        blocks = _block_spans(text, section_start, section_end) or [(section_start, section_end)]

        spans: list[tuple[int, int]] = []
        current_start: int | None = None
        current_end: int | None = None
        for block_start, block_end in blocks:
            if block_end - block_start > size:
                if current_start is not None and current_end is not None:
                    spans.append((current_start, current_end))
                    current_start = None
                    current_end = None
                spans.extend(_split_span(text, block_start, block_end, size))
                continue
            if current_start is None:
                current_start = block_start
                current_end = block_end
                continue
            if block_end - current_start <= size:
                current_end = block_end
                continue
            spans.append((current_start, int(current_end)))
            current_start = block_start
            current_end = block_end
        if current_start is not None and current_end is not None:
            spans.append((current_start, current_end))

        for start, end in spans:
            raw = text[start:end].strip()
            if not raw:
                continue
            results.append(
                {
                    "text": raw,
                    "section_id": section_id,
                    "parent_id": parent_id,
                    "heading_path": heading_path,
                    "heading_level": heading_level,
                    "start_char": start,
                    "end_char": end,
                }
            )

    for index, chunk in enumerate(results):
        chunk["chunk_index"] = index
        chunk["context_text"] = make_context_text(title, chunk["heading_path"])
    return results


def make_context_text(
    title: str,
    heading_path: list[str] | tuple[str, ...],
    metadata: dict[str, Any] | None = None,
) -> str:
    parts = [str(title or "").strip()]
    heading = " > ".join(str(item).strip() for item in heading_path if str(item).strip())
    if heading:
        parts.append(heading)
    metadata = metadata or {}
    concepts = [str(item).strip() for item in metadata.get("concepts", []) if str(item).strip()]
    tags = [str(item).strip() for item in metadata.get("tags", []) if str(item).strip()]
    source_type = str(metadata.get("source_type") or "").strip()
    if concepts:
        parts.append("概念: " + ", ".join(concepts[:8]))
    if tags:
        parts.append("标签: " + ", ".join(tags[:8]))
    if source_type:
        parts.append("来源: " + source_type)
    return " | ".join(part for part in parts if part)


def cjk_bigrams(text: str) -> list[str]:
    """Return overlapping CJK bigrams for unicode61 substring recall."""

    terms: list[str] = []
    for match in CJK_RUN_RE.finditer(text):
        chars = list(match.group(0))
        if len(chars) == 1:
            terms.append(chars[0])
        else:
            terms.extend(chars[index] + chars[index + 1] for index in range(len(chars) - 1))
    return terms


def fts_index_text(text: str) -> str:
    """Append explicit CJK bigrams while keeping the readable source text."""

    bigrams = cjk_bigrams(text)
    return text if not bigrams else text + "\n" + " ".join(bigrams)


def query_tokens(query: str, limit: int = 32) -> list[str]:
    seen: set[str] = set()
    tokens: list[str] = []
    for match in QUERY_TOKEN_RE.finditer(query):
        token = match.group(0).strip()
        candidates = [token]
        if CJK_RUN_RE.fullmatch(token):
            candidates.extend(cjk_bigrams(token))
        for candidate in candidates:
            normalized = candidate.casefold()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            tokens.append(candidate)
            if len(tokens) >= limit:
                return tokens
    return tokens


def fts_or_query(query: str, limit: int = 32) -> str:
    tokens = query_tokens(query, limit=limit)
    return " OR ".join('"' + token.replace('"', '""') + '"' for token in tokens)


def fts_required_query(query: str, limit: int = 32) -> str:
    """Build a narrow AND query for candidates already known to contain the raw phrase."""

    allowed = {token.casefold() for token in query_tokens(query, limit=limit)}
    used: set[str] = set()
    groups: list[str] = []
    for match in QUERY_TOKEN_RE.finditer(query):
        token = match.group(0).strip()
        normalized = token.casefold()
        original = token if normalized in allowed and normalized not in used else ""
        if original:
            used.add(normalized)
        if CJK_RUN_RE.fullmatch(token) and len(token) > 1:
            bigrams: list[str] = []
            for bigram in cjk_bigrams(token):
                folded_bigram = bigram.casefold()
                if folded_bigram not in allowed or folded_bigram in used:
                    continue
                used.add(folded_bigram)
                bigrams.append(bigram)
            if original and bigrams:
                quoted = '"' + original.replace('"', '""') + '"'
                required_bigrams = " AND ".join(
                    '"' + bigram.replace('"', '""') + '"' for bigram in bigrams
                )
                groups.append(f"({quoted} OR ({required_bigrams}))")
                continue
            if bigrams:
                groups.append(
                    "(" + " AND ".join(
                        '"' + bigram.replace('"', '""') + '"' for bigram in bigrams
                    ) + ")"
                )
                continue
        if original:
            groups.append('"' + original.replace('"', '""') + '"')
    return " AND ".join(groups)


def matched_snippet(text: str, query: str, radius: int = 150) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return ""
    folded = compact.casefold()
    query_folded = query.strip().casefold()
    positions: list[tuple[int, str]] = []
    if query_folded:
        exact = folded.find(query_folded)
        if exact >= 0:
            positions.append((exact, compact[exact : exact + len(query.strip())]))
    if not positions:
        occurrences: list[tuple[int, int, str, str]] = []
        tokens = query_tokens(query)
        per_token_limit = max(1, 256 // max(1, len(tokens)))
        for token in tokens:
            token_folded = token.casefold()
            cursor = 0
            for _ in range(per_token_limit):
                position = folded.find(token_folded, cursor)
                if position < 0:
                    break
                occurrences.append(
                    (
                        position,
                        position + len(token),
                        token_folded,
                        compact[position : position + len(token)],
                    )
                )
                cursor = position + max(1, len(token))
                if len(occurrences) >= 256:
                    break
            if len(occurrences) >= 256:
                break
        occurrences.sort(key=lambda item: (item[0], -len(item[2])))
        best: tuple[tuple[int, int, int, int, int], tuple[int, str]] | None = None
        for start, end, token_folded, matched_text in occurrences:
            window_left = max(0, start - radius)
            window_right = min(len(compact), end + radius)
            window_hits = [
                occurrence
                for occurrence in occurrences
                if occurrence[0] < window_right and occurrence[1] > window_left
            ]
            distinct = {occurrence[2] for occurrence in window_hits}
            distinct_chars = sum(min(len(token), 16) for token in distinct)
            spread = (
                max(occurrence[1] for occurrence in window_hits)
                - min(occurrence[0] for occurrence in window_hits)
                if window_hits
                else 0
            )
            key = (
                len(distinct),
                distinct_chars,
                -spread,
                len(token_folded),
                -start,
            )
            if best is None or key > best[0]:
                best = (key, (start, matched_text))
        if best is not None:
            positions.append(best[1])
    start_at, matched = positions[0] if positions else (0, "")
    left = max(0, start_at - radius)
    right = min(len(compact), start_at + max(len(matched), 1) + radius)
    snippet = compact[left:right]
    if matched:
        local = start_at - left
        snippet = snippet[:local] + "[" + snippet[local : local + len(matched)] + "]" + snippet[local + len(matched) :]
    if left:
        snippet = "…" + snippet
    if right < len(compact):
        snippet += "…"
    return snippet


def estimate_tokens(text: str) -> int:
    han = len(HAN_RE.findall(text))
    latin = sum(max(1, math.ceil(len(token) / 4)) for token in LATIN_TOKEN_RE.findall(text))
    punctuation = len(re.findall(r"[^\s\w\u3400-\u4dbf\u4e00-\u9fff]", text))
    return max(1, han + latin + math.ceil(punctuation / 3)) if text.strip() else 0
