#!/usr/bin/env python3
"""B0 baseline: Personal OS agent/context memory recall on live host."""
from __future__ import annotations

import json
import re
import statistics
import time
import urllib.error
import os
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BASE = os.environ.get("PERSONAL_OS_BASE_URL", "http://localhost:3100")
OUT = Path(__file__).resolve().parents[1] / "docs" / "eval_b0_memory_baseline_2026-07-21.json"

QUERIES: list[tuple[str, str]] = [
    ("exact", "Hermes Agent"),
    ("exact", "MCP"),
    ("exact", "wechat-publish-template"),
    ("exact", "MultiPost"),
    ("exact", "Personal OS"),
    ("zh", "公众号"),
    ("zh", "内容矩阵"),
    ("zh", "文章转视频"),
    ("zh", "小红书"),
    ("zh", "视频号"),
    ("zh", "变现"),
    ("zh", "Skill"),
    ("concept", "长期记忆"),
    ("concept", "知识库检索"),
    ("concept", "Agent 任务认领"),
    ("concept", "如何部署 Personal Wiki"),
    ("concept", "图谱关系"),
    ("concept", "RAG 记忆"),
    ("ops", "WIKI_READ_TOKEN"),
    ("ops", "3422"),
    ("ops", "docker compose"),
    ("ops", "FTS chunk"),
    ("noise", "今天天气怎么样"),
    ("noise", "完全不存在的专有名词XYZQWERTY999"),
    ("multi", "Personal OS 和 Wiki 的边界是什么"),
    ("multi", "X likes 知识流水线"),
    ("multi", "Obsidian 导入导出"),
    ("multi", "任务复核 review"),
]


def get(url: str) -> tuple[int | None, str, float]:
    req = urllib.request.Request(url)
    read_token = os.environ.get("PERSONAL_OS_READ_TOKEN", "")
    if read_token:
        req.add_header("Authorization", f"Bearer {read_token}")
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8", "replace")
            return resp.status, body, (time.perf_counter() - t0) * 1000
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        return exc.code, body, (time.perf_counter() - t0) * 1000
    except Exception as exc:  # noqa: BLE001
        return None, str(exc), (time.perf_counter() - t0) * 1000


def est_tokens(text: str) -> int:
    if not text:
        return 0
    cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
    other = len(text) - cjk
    return int(cjk * 1.0 + other * 0.3)


def pick_text(obj: dict[str, Any], keys: list[str]) -> str:
    for key in keys:
        val = obj.get(key)
        if isinstance(val, str) and val.strip():
            return val
    return ""


def analyze_candidate(c: dict[str, Any]) -> dict[str, Any]:
    excerpt = c.get("excerpt") if isinstance(c.get("excerpt"), str) else ""
    snippet = pick_text(c, ["hit_snippet", "snippet"])
    summary = c.get("summary") if isinstance(c.get("summary"), str) else ""
    text = snippet or excerpt or summary
    tags = c.get("tags") if isinstance(c.get("tags"), list) else []
    concepts = c.get("concepts") if isinstance(c.get("concepts"), list) else []
    return {
        "title": c.get("title") or "",
        "path": c.get("path") or "",
        "score": c.get("score"),
        "source_type": c.get("source_type"),
        "status": c.get("status") or "",
        "quality_status": c.get("quality_status") or "",
        "tags_n": len(tags),
        "concepts_n": len(concepts),
        "excerpt_len": len(excerpt or ""),
        "snippet_len": len(snippet or ""),
        "summary_len": len(summary or ""),
        "evidence_len": len(text),
        "evidence_tokens": est_tokens(text),
        "matched": c.get("matchedQueries") or [],
        "evidence_preview": text[:180].replace("\n", " "),
        "tags": tags[:12],
        "concepts": concepts[:8],
    }


def analyze_memory_items(items: list[Any]) -> dict[str, Any]:
    if not isinstance(items, list):
        return {"n": 0, "tokens": 0, "chars": 0, "kinds": {}, "samples": []}
    kinds: dict[str, int] = {}
    total_chars = 0
    samples = []
    for item in items:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or item.get("type") or "unknown")
        kinds[kind] = kinds.get(kind, 0) + 1
        text = pick_text(item, ["text", "content", "body", "excerpt", "summary"])
        total_chars += len(text)
        if len(samples) < 3:
            samples.append(
                {
                    "kind": kind,
                    "score": item.get("score"),
                    "len": len(text),
                    "preview": text[:160].replace("\n", " "),
                    "source": item.get("source") or item.get("path") or item.get("title"),
                }
            )
    return {
        "n": len(items),
        "tokens": est_tokens("x" * total_chars) if total_chars else 0,
        "chars": total_chars,
        "kinds": kinds,
        "samples": samples,
    }


def mean(xs: list[float]) -> float:
    return float(statistics.mean(xs)) if xs else 0.0


def main() -> int:
    results: list[dict[str, Any]] = []
    for cat, query in QUERIES:
        url = f"{BASE}/api/agent/context?{urllib.parse.urlencode({'q': query})}"
        status, body, ms = get(url)
        row: dict[str, Any] = {
            "cat": cat,
            "q": query,
            "http": status,
            "latency_ms": round(ms, 1),
        }
        if status != 200:
            row["error"] = body[:300]
            results.append(row)
            print(f"ERR {cat} {query!r}: {status}")
            continue

        data = json.loads(body)
        ctx = data.get("context") or {}
        wiki = ctx.get("wiki") or {}
        cands = wiki.get("candidates") if isinstance(wiki.get("candidates"), list) else []
        analyzed = [analyze_candidate(c) for c in cands if isinstance(c, dict)]
        mem = analyze_memory_items(ctx.get("memoryItems") or [])
        evidence = ctx.get("evidence")
        budget = ctx.get("budget") or ctx.get("tokenBudget") or {}
        tiers = ctx.get("tiers")
        ql = query.lower()
        title_hit = sum(1 for a in analyzed if ql in (a["title"] or "").lower())
        any_hit = sum(
            1
            for a in analyzed
            if ql in (a["title"] or "").lower() or ql in (a["evidence_preview"] or "").lower()
        )
        thin = sum(1 for a in analyzed if a["evidence_len"] < 80)
        empty_ev = sum(1 for a in analyzed if a["evidence_len"] == 0)
        auto_status = sum(1 for a in analyzed if a.get("status") == "auto")
        blank_status = sum(1 for a in analyzed if not a.get("status"))
        no_concepts = sum(1 for a in analyzed if a["concepts_n"] == 0)
        total_ev_tokens = sum(a["evidence_tokens"] for a in analyzed)
        total_ev_chars = sum(a["evidence_len"] for a in analyzed)

        row.update(
            {
                "wiki_status": wiki.get("status"),
                "n_cand": len(analyzed),
                "searched": ctx.get("searchQueries")
                or (ctx.get("queryPlan") or {}).get("searchedQueries"),
                "total_evidence_tokens": total_ev_tokens,
                "total_evidence_chars": total_ev_chars,
                "thin_n": thin,
                "empty_ev_n": empty_ev,
                "auto_status_n": auto_status,
                "blank_status_n": blank_status,
                "no_concepts_n": no_concepts,
                "title_keyword_hits": title_hit,
                "any_keyword_hits": any_hit,
                "avg_score": round(mean([float(a["score"] or 0) for a in analyzed]), 1),
                "top": analyzed[:3],
                "memory": mem,
                "budget": budget,
                "tiers_present": bool(tiers),
                "evidence_present": evidence is not None,
                "evidence_type": type(evidence).__name__ if evidence is not None else None,
                "evidence_n": len(evidence)
                if isinstance(evidence, list)
                else (1 if evidence else 0),
                "policy": ctx.get("policy"),
                "debug_keys": sorted((ctx.get("debug") or {}).keys())
                if isinstance(ctx.get("debug"), dict)
                else None,
                "ctx_keys": sorted(ctx.keys()),
            }
        )
        results.append(row)
        print(
            f"OK {cat:7} q={query!r:28} n={len(analyzed):2} "
            f"tok={total_ev_tokens:4} thin={thin} empty={empty_ev} "
            f"titleHit={title_hit}/{len(analyzed)} mem={mem['n']} "
            f"ms={ms:.0f} wiki={wiki.get('status')}"
        )

    ok = [r for r in results if r.get("http") == 200]
    summary: dict[str, Any] = {
        "base": BASE,
        "query_count": len(ok),
        "latency_ms_p50": statistics.median([r["latency_ms"] for r in ok]) if ok else None,
        "latency_ms_p95": sorted([r["latency_ms"] for r in ok])[max(0, int(len(ok) * 0.95) - 1)]
        if ok
        else None,
        "mean_candidates": round(mean([float(r["n_cand"]) for r in ok]), 2),
        "mean_evidence_tokens": round(mean([float(r["total_evidence_tokens"]) for r in ok]), 1),
        "mean_thin_ratio": round(
            mean([r["thin_n"] / max(r["n_cand"], 1) for r in ok]), 3
        ),
        "mean_empty_evidence_ratio": round(
            mean([r["empty_ev_n"] / max(r["n_cand"], 1) for r in ok]), 3
        ),
        "mean_auto_or_blank_status_ratio": round(
            mean(
                [
                    (r["auto_status_n"] + r["blank_status_n"]) / max(r["n_cand"], 1)
                    for r in ok
                ]
            ),
            3,
        ),
        "mean_no_concepts_ratio": round(
            mean([r["no_concepts_n"] / max(r["n_cand"], 1) for r in ok]), 3
        ),
        "mean_title_keyword_hit_rate": round(
            mean([r["title_keyword_hits"] / max(r["n_cand"], 1) for r in ok]), 3
        ),
        "mean_memory_items": round(mean([float(r["memory"]["n"]) for r in ok]), 2),
        "by_cat": {},
        "noise": [],
    }
    for cat in sorted({r["cat"] for r in ok}):
        sub = [r for r in ok if r["cat"] == cat]
        summary["by_cat"][cat] = {
            "nq": len(sub),
            "mean_cand": round(mean([float(r["n_cand"]) for r in sub]), 1),
            "mean_tok": round(mean([float(r["total_evidence_tokens"]) for r in sub]), 0),
            "mean_title_hit_rate": round(
                mean([r["title_keyword_hits"] / max(r["n_cand"], 1) for r in sub]), 2
            ),
            "p50_ms": statistics.median([r["latency_ms"] for r in sub]),
            "zero_result_n": sum(1 for r in sub if r["n_cand"] == 0),
        }
    for r in ok:
        if r["cat"] == "noise":
            summary["noise"].append(
                {
                    "q": r["q"],
                    "n_cand": r["n_cand"],
                    "tok": r["total_evidence_tokens"],
                    "top": [t["title"][:60] for t in r.get("top", [])],
                }
            )

    print("\n===== AGGREGATE =====")
    for key, val in summary.items():
        if key in {"by_cat", "noise"}:
            continue
        print(f"{key}: {val}")
    print("by_cat:")
    for cat, val in summary["by_cat"].items():
        print(f"  {cat}: {val}")
    print("noise:", summary["noise"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"summary": summary, "results": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("wrote", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())