#!/usr/bin/env python3
"""
SwarmVault graph navigation PoC for Personal Wiki.
Maps Personal Wiki's existing graph to SwarmVault CoreGraph format,
then implements query, path, and explain operations.
"""

from __future__ import annotations

import json
import sys
import time
import unittest
from collections import deque
from pathlib import Path
from typing import Any, Callable

# Allow importing from personal-wiki api/
ROOT = Path(__file__).resolve().parents[3] / "personal-wiki"
sys.path.insert(0, str(ROOT / "api"))

from server import build_graph_from_records  # noqa: E402


# ---------------------------------------------------------------------------
# Data models (aligned with SwarmVault CoreGraph)
# ---------------------------------------------------------------------------

class CoreGraphNode:
    def __init__(
        self,
        id: str,
        label: str,
        type: str,
        page_id: str | None = None,
        community_id: str | None = None,
        degree: int = 0,
        confidence: float = 1.0,
        evidence_class: str = "extracted",
        tags: list[str] | None = None,
    ):
        self.id = id
        self.label = label
        self.type = type
        self.page_id = page_id
        self.community_id = community_id
        self.degree = degree
        self.confidence = confidence
        self.evidence_class = evidence_class
        self.tags = tags or []

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "type": self.type,
            "pageId": self.page_id,
            "communityId": self.community_id,
            "degree": self.degree,
            "confidence": self.confidence,
            "evidenceClass": self.evidence_class,
            "tags": self.tags,
        }


class CoreGraphEdge:
    def __init__(
        self,
        id: str,
        source: str,
        target: str,
        relation: str,
        evidence_class: str,
        confidence: float,
    ):
        self.id = id
        self.source = source
        self.target = target
        self.relation = relation
        self.evidence_class = evidence_class
        self.confidence = confidence

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source": self.source,
            "target": self.target,
            "relation": self.relation,
            "evidenceClass": self.evidence_class,
            "confidence": self.confidence,
        }


class CoreGraphPage:
    def __init__(self, id: str, path: str, title: str, node_ids: list[str] | None = None):
        self.id = id
        self.path = path
        self.title = title
        self.node_ids = node_ids or []

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "path": self.path, "title": self.title, "nodeIds": self.node_ids}


class CoreGraph:
    def __init__(
        self,
        nodes: list[CoreGraphNode],
        edges: list[CoreGraphEdge],
        pages: list[CoreGraphPage] | None = None,
    ):
        self.nodes = nodes
        self.edges = edges
        self.pages = pages or []

    def to_dict(self) -> dict[str, Any]:
        return {
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
            "pages": [p.to_dict() for p in self.pages],
        }


class CoreQueryMatch:
    def __init__(self, type: str, id: str, label: str, score: float):
        self.type = type
        self.id = id
        self.label = label
        self.score = score

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "id": self.id, "label": self.label, "score": self.score}


class CoreQueryResult:
    def __init__(
        self,
        question: str,
        traversal: str,
        seed_node_ids: list[str],
        seed_page_ids: list[str],
        visited_node_ids: list[str],
        visited_edge_ids: list[str],
        page_ids: list[str],
        matches: list[CoreQueryMatch],
        summary: str,
    ):
        self.question = question
        self.traversal = traversal
        self.seed_node_ids = seed_node_ids
        self.seed_page_ids = seed_page_ids
        self.visited_node_ids = visited_node_ids
        self.visited_edge_ids = visited_edge_ids
        self.page_ids = page_ids
        self.matches = matches
        self.summary = summary

    def to_dict(self) -> dict[str, Any]:
        return {
            "question": self.question,
            "traversal": self.traversal,
            "seedNodeIds": self.seed_node_ids,
            "seedPageIds": self.seed_page_ids,
            "visitedNodeIds": self.visited_node_ids,
            "visitedEdgeIds": self.visited_edge_ids,
            "pageIds": self.page_ids,
            "matches": [m.to_dict() for m in self.matches],
            "summary": self.summary,
        }


class CorePathResult:
    def __init__(
        self,
        from_node: str,
        to_node: str,
        found: bool,
        node_ids: list[str],
        edge_ids: list[str],
        page_ids: list[str],
        summary: str,
        resolved_from_node_id: str | None = None,
        resolved_to_node_id: str | None = None,
    ):
        self.from_node = from_node
        self.to_node = to_node
        self.found = found
        self.node_ids = node_ids
        self.edge_ids = edge_ids
        self.page_ids = page_ids
        self.summary = summary
        self.resolved_from_node_id = resolved_from_node_id
        self.resolved_to_node_id = resolved_to_node_id

    def to_dict(self) -> dict[str, Any]:
        return {
            "from": self.from_node,
            "to": self.to_node,
            "found": self.found,
            "nodeIds": self.node_ids,
            "edgeIds": self.edge_ids,
            "pageIds": self.page_ids,
            "summary": self.summary,
            "resolvedFromNodeId": self.resolved_from_node_id,
            "resolvedToNodeId": self.resolved_to_node_id,
        }


class CoreExplainNeighbor:
    def __init__(
        self,
        node_id: str,
        label: str,
        type: str,
        relation: str,
        direction: str,
        confidence: float,
        evidence_class: str,
        page_id: str | None = None,
    ):
        self.node_id = node_id
        self.label = label
        self.type = type
        self.relation = relation
        self.direction = direction
        self.confidence = confidence
        self.evidence_class = evidence_class
        self.page_id = page_id

    def to_dict(self) -> dict[str, Any]:
        return {
            "nodeId": self.node_id,
            "label": self.label,
            "type": self.type,
            "relation": self.relation,
            "direction": self.direction,
            "confidence": self.confidence,
            "evidenceClass": self.evidence_class,
            "pageId": self.page_id,
        }


class CoreExplainResult:
    def __init__(
        self,
        target: str,
        node: CoreGraphNode,
        neighbors: list[CoreExplainNeighbor],
        summary: str,
        page: CoreGraphPage | None = None,
    ):
        self.target = target
        self.node = node
        self.neighbors = neighbors
        self.summary = summary
        self.page = page

    def to_dict(self) -> dict[str, Any]:
        return {
            "target": self.target,
            "node": self.node.to_dict(),
            "neighbors": [n.to_dict() for n in self.neighbors],
            "summary": self.summary,
            "page": self.page.to_dict() if self.page else None,
        }


# ---------------------------------------------------------------------------
# Mapping: Personal Wiki graph -> CoreGraph
# ---------------------------------------------------------------------------

def map_personal_wiki_to_core_graph(pw_graph: dict[str, Any]) -> CoreGraph:
    """Map Personal Wiki graph (nodes/links) to SwarmVault CoreGraph."""
    nodes: list[CoreGraphNode] = []
    pages: list[CoreGraphPage] = []
    node_by_id: dict[str, CoreGraphNode] = {}

    for n in pw_graph.get("nodes", []):
        kind = n.get("kind", "note")
        confidence = 1.0 if kind == "note" else 0.8 if kind == "concept" else 0.6
        evidence_class = "extracted" if kind in ("note", "concept") else "inferred"
        node = CoreGraphNode(
            id=n["id"],
            label=n.get("label", n["id"]),
            type=kind,
            page_id=n["id"] if kind == "note" else None,
            confidence=confidence,
            evidence_class=evidence_class,
            tags=list(n.get("tags", [])),
        )
        nodes.append(node)
        node_by_id[node.id] = node
        if kind == "note":
            pages.append(CoreGraphPage(id=n["id"], path=n.get("path", n["id"]), title=n.get("title", n["id"]), node_ids=[n["id"]]))

    # Compute degrees
    for edge in pw_graph.get("links", []):
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src in node_by_id:
            node_by_id[src].degree += 1
        if tgt in node_by_id:
            node_by_id[tgt].degree += 1

    edges: list[CoreGraphEdge] = []
    seen = set()
    for link in pw_graph.get("links", []):
        src = link["source"]
        tgt = link["target"]
        rel = link.get("type", "related")
        key = (src, tgt, rel)
        if src == tgt or key in seen:
            continue
        seen.add(key)
        confidence = link.get("score", 0.5)
        evidence = "extracted" if rel == "wikilink" else "inferred" if rel == "related" else "extracted"
        edges.append(
            CoreGraphEdge(
                id=f"{src}--{rel}--{tgt}",
                source=src,
                target=tgt,
                relation=rel,
                evidence_class=evidence,
                confidence=confidence,
            )
        )

    return CoreGraph(nodes=nodes, edges=edges, pages=pages)


# ---------------------------------------------------------------------------
# Graph query core (Python port of SwarmVault graph-query-core.ts)
# ---------------------------------------------------------------------------

def normalize_target(value: str) -> str:
    return (
        value.replace(r"\s+", " ")
        .strip()
        .lower()
    )


def score_match(query: str, candidate: str) -> float:
    q = normalize_target(query)
    c = normalize_target(candidate)
    if not q or not c:
        return 0.0
    if c == q:
        return 100.0
    if c.startswith(q):
        return 80.0
    if q in c:
        return 60.0
    q_tokens = q.split()
    c_tokens = set(c.split())
    overlap = sum(1 for t in q_tokens if t in c_tokens)
    return overlap * 10 if overlap else 0.0


def resolve_core_node(graph: CoreGraph, target: str) -> CoreGraphNode | None:
    by_id = {n.id: n for n in graph.nodes}
    if target in by_id:
        return by_id[target]
    normalized = normalize_target(target)
    label_matches = [n for n in graph.nodes if normalize_target(n.label) == normalized or normalize_target(n.id) == normalized]
    if label_matches:
        return sorted(label_matches, key=lambda n: (-n.degree, n.label))[0]
    # fuzzy page fallback
    pages_by_id = {p.id: p for p in graph.pages}
    page_hits = sorted(
        [(p, max(score_match(target, p.title), score_match(target, p.path))) for p in graph.pages],
        key=lambda x: (-x[1], x[0].title),
    )
    page_hits = [x for x in page_hits if x[1] > 0]
    if page_hits:
        page = page_hits[0][0]
        primary = next((n for n in graph.nodes if n.page_id == page.id), None)
        if primary:
            return primary
    fuzzy = sorted(
        [(n, max(score_match(target, n.label), score_match(target, n.id))) for n in graph.nodes],
        key=lambda x: (-x[1], x[0].label),
    )
    fuzzy = [x for x in fuzzy if x[1] > 0]
    return fuzzy[0][0] if fuzzy else None


class EdgeNeighbor:
    def __init__(self, edge: CoreGraphEdge, node_id: str, direction: str):
        self.edge = edge
        self.node_id = node_id
        self.direction = direction


def build_adjacency(graph: CoreGraph) -> dict[str, list[EdgeNeighbor]]:
    adjacency: dict[str, list[EdgeNeighbor]] = {}
    for edge in graph.edges:
        adjacency.setdefault(edge.source, []).append(EdgeNeighbor(edge, edge.target, "outgoing"))
        adjacency.setdefault(edge.target, []).append(EdgeNeighbor(edge, edge.source, "incoming"))
    for key in adjacency:
        adjacency[key].sort(
            key=lambda item: (-item.edge.confidence, item.edge.relation),
        )
    return adjacency


def unique_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        if not v or v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out


def run_core_graph_query(
    graph: CoreGraph,
    question: str,
    *,
    traversal: str = "bfs",
    budget: int = 12,
) -> CoreQueryResult:
    traversal = traversal if traversal in ("bfs", "dfs") else "bfs"
    budget = max(3, min(budget, 50))

    # Match nodes, pages
    node_matches = [
        CoreQueryMatch("node", n.id, n.label, max(score_match(question, n.label), score_match(question, n.id)))
        for n in graph.nodes
    ]
    node_matches = sorted([m for m in node_matches if m.score > 0], key=lambda m: (-m.score, m.label))[:12]

    page_matches = [
        CoreQueryMatch("page", p.id, p.title, max(score_match(question, p.title), score_match(question, p.path)))
        for p in graph.pages
    ]
    page_matches = sorted([m for m in page_matches if m.score > 0], key=lambda m: (-m.score, m.label))[:12]

    matches = sorted(
        unique_strings([m.id for m in page_matches + node_matches]),
        key=lambda m_id: next((m.score for m in page_matches + node_matches if m.id == m_id), 0),
        reverse=True,
    )
    matches_obj = [next(m for m in page_matches + node_matches if m.id == m_id) for m_id in matches]

    pages_by_id = {p.id: p for p in graph.pages}
    nodes_by_page_id: dict[str, list[str]] = {}
    for n in graph.nodes:
        if n.page_id:
            nodes_by_page_id.setdefault(n.page_id, []).append(n.id)

    seeds = unique_strings(
        [n_id for p_m in page_matches for n_id in nodes_by_page_id.get(p_m.id, [])]
        + [m.id for m in node_matches]
    )

    adjacency = build_adjacency(graph)
    visited_node_ids: list[str] = []
    visited_edge_ids: set[str] = set()
    seen = set()
    frontier = list(seeds)

    while frontier and len(visited_node_ids) < budget:
        current = frontier.pop() if traversal == "dfs" else frontier.pop(0)
        if not current or current in seen:
            continue
        seen.add(current)
        visited_node_ids.append(current)
        for neighbor in adjacency.get(current, []):
            visited_edge_ids.add(neighbor.edge.id)
            if neighbor.node_id not in seen:
                frontier.append(neighbor.node_id)
            if len(visited_node_ids) + len(frontier) >= budget * 2:
                break

    node_by_id = {n.id: n for n in graph.nodes}
    page_ids = unique_strings(
        [m.id for m in page_matches]
        + [node_by_id[n_id].page_id for n_id in visited_node_ids if node_by_id.get(n_id) and node_by_id[n_id].page_id]
    )

    summary_lines = [
        f"Top matches: {', '.join(f'{m.label} ({m.type}, score {m.score})' for m in matches_obj[:8]) or 'none'}",
        f"Seeds: {', '.join(seeds[:15]) or 'none'}",
        f"Visited nodes: {len(visited_node_ids)}",
        f"Visited edges: {len(visited_edge_ids)}",
        f"Pages: {', '.join(page_ids) or 'none'}",
    ]

    return CoreQueryResult(
        question=question,
        traversal=traversal,
        seed_node_ids=seeds,
        seed_page_ids=[m.id for m in page_matches],
        visited_node_ids=visited_node_ids,
        visited_edge_ids=list(visited_edge_ids),
        page_ids=page_ids,
        matches=matches_obj,
        summary="\n".join(summary_lines),
    )


def run_core_graph_path(graph: CoreGraph, from_target: str, to_target: str) -> CorePathResult:
    start = resolve_core_node(graph, from_target)
    end = resolve_core_node(graph, to_target)
    if not start or not end:
        return CorePathResult(
            from_node=from_target,
            to_node=to_target,
            found=False,
            node_ids=[],
            edge_ids=[],
            page_ids=[],
            summary="Could not resolve one or both graph targets.",
            resolved_from_node_id=start.id if start else None,
            resolved_to_node_id=end.id if end else None,
        )

    adjacency = build_adjacency(graph)
    queue = deque([start.id])
    visited = {start.id}
    previous: dict[str, tuple[str, str]] = {}

    while queue:
        current = queue.popleft()
        if current == end.id:
            break
        for neighbor in adjacency.get(current, []):
            if neighbor.node_id in visited:
                continue
            visited.add(neighbor.node_id)
            previous[neighbor.node_id] = (current, neighbor.edge.id)
            queue.append(neighbor.node_id)

    if end.id not in visited:
        return CorePathResult(
            from_node=from_target,
            to_node=to_target,
            found=False,
            node_ids=[],
            edge_ids=[],
            page_ids=[],
            summary=f"No path found between {start.label} and {end.label}.",
            resolved_from_node_id=start.id,
            resolved_to_node_id=end.id,
        )

    node_ids: list[str] = []
    edge_ids: list[str] = []
    current = end.id
    while current != start.id:
        node_ids.append(current)
        prev = previous.get(current)
        if not prev:
            break
        edge_ids.append(prev[1])
        current = prev[0]
    node_ids.append(start.id)
    node_ids.reverse()
    edge_ids.reverse()

    node_by_id = {n.id: n for n in graph.nodes}
    page_ids = unique_strings([node_by_id[n_id].page_id for n_id in node_ids if node_by_id.get(n_id) and node_by_id[n_id].page_id])

    return CorePathResult(
        from_node=from_target,
        to_node=to_target,
        found=True,
        node_ids=node_ids,
        edge_ids=edge_ids,
        page_ids=page_ids,
        summary=" -> ".join(node_by_id[n_id].label if node_by_id.get(n_id) else n_id for n_id in node_ids),
        resolved_from_node_id=start.id,
        resolved_to_node_id=end.id,
    )


def run_core_graph_explain(graph: CoreGraph, target: str) -> CoreExplainResult | None:
    node = resolve_core_node(graph, target)
    if not node:
        return None

    adjacency = build_adjacency(graph)
    node_by_id = {n.id: n for n in graph.nodes}
    neighbors: list[CoreExplainNeighbor] = []
    for neighbor in adjacency.get(node.id, []):
        target_node = node_by_id.get(neighbor.node_id)
        if not target_node:
            continue
        neighbors.append(
            CoreExplainNeighbor(
                node_id=target_node.id,
                label=target_node.label,
                type=target_node.type,
                relation=neighbor.edge.relation,
                direction=neighbor.direction,
                confidence=neighbor.edge.confidence,
                evidence_class=neighbor.edge.evidence_class,
                page_id=target_node.page_id,
            )
        )
    neighbors.sort(key=lambda n: (-n.confidence, n.label))

    pages_by_id = {p.id: p for p in graph.pages}
    page = pages_by_id.get(node.page_id) if node.page_id else None

    summary_lines = [
        f"Node: {node.label}",
        f"Type: {node.type}",
        f"Neighbors: {len(neighbors)}",
        f"Page: {page.path if page else 'none'}",
    ]

    return CoreExplainResult(
        target=target,
        node=node,
        neighbors=neighbors,
        summary="\n".join(summary_lines),
        page=page,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def note_record(
    title: str,
    path: str,
    *,
    concepts: list[str] | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    concepts = concepts or []
    body_links = "\n".join(f"[[{concept}]]" for concept in concepts)
    return {
        "title": title,
        "path": path,
        "body": f"# {title}\n\n{body_links}",
        "tags": tags or [],
        "concepts": concepts,
        "source_type": "manual",
    }


class GraphNavigationTests(unittest.TestCase):
    def _build_graph(self, records: list[dict[str, Any]]) -> CoreGraph:
        pw_graph = build_graph_from_records(records)
        return map_personal_wiki_to_core_graph(pw_graph)

    def test_map_personal_wiki_to_core_graph(self) -> None:
        records = [
            note_record("Browser capture", "vault/20_notes/capture.md", concepts=["Personal OS", "Web Capture"], tags=["capture"]),
            note_record("Extension intake", "vault/20_notes/extension.md", concepts=["Personal OS", "Web Capture"], tags=["capture"]),
        ]
        graph = self._build_graph(records)
        self.assertTrue(any(n.type == "note" for n in graph.nodes))
        self.assertTrue(any(e.relation == "wikilink" for e in graph.edges))
        self.assertTrue(any(e.relation == "tag" for e in graph.edges))
        # Check that note nodes have page_id
        note_nodes = [n for n in graph.nodes if n.type == "note"]
        self.assertTrue(all(n.page_id is not None for n in note_nodes))

    def test_run_core_graph_query_bfs(self) -> None:
        records = [
            note_record("Browser capture", "vault/20_notes/capture.md", concepts=["Personal OS", "Web Capture"], tags=["capture"]),
            note_record("Extension intake", "vault/20_notes/extension.md", concepts=["Personal OS", "Web Capture"], tags=["capture"]),
            note_record("Release notes", "vault/20_notes/release.md", concepts=["Release"], tags=["release"]),
        ]
        graph = self._build_graph(records)
        result = run_core_graph_query(graph, "capture", traversal="bfs", budget=10)
        self.assertIn("capture", result.summary.lower())
        self.assertGreater(len(result.visited_node_ids), 0)
        self.assertGreater(len(result.matches), 0)

    def test_run_core_graph_query_dfs(self) -> None:
        records = [
            note_record("A", "a.md", concepts=["X"]),
            note_record("B", "b.md", concepts=["X", "Y"]),
            note_record("C", "c.md", concepts=["Y"]),
        ]
        graph = self._build_graph(records)
        result = run_core_graph_query(graph, "A", traversal="dfs", budget=10)
        self.assertEqual(result.traversal, "dfs")
        self.assertIn("A", [m.label for m in result.matches])

    def test_run_core_graph_path_found(self) -> None:
        records = [
            note_record("Browser capture", "vault/20_notes/capture.md", concepts=["Personal OS", "Web Capture"], tags=["capture"]),
            note_record("Extension intake", "vault/20_notes/extension.md", concepts=["Personal OS", "Web Capture"], tags=["capture"]),
        ]
        graph = self._build_graph(records)
        result = run_core_graph_path(graph, "Browser capture", "Extension intake")
        self.assertTrue(result.found)
        self.assertGreater(len(result.node_ids), 1)
        self.assertIn("Browser capture", result.summary)
        self.assertIn("Extension intake", result.summary)

    def test_run_core_graph_path_not_found(self) -> None:
        records = [
            note_record("A", "a.md", concepts=["X"]),
            note_record("B", "b.md", concepts=["Y"]),
        ]
        graph = self._build_graph(records)
        result = run_core_graph_path(graph, "A", "B")
        # A and B are disconnected (no shared concepts/tags above threshold)
        self.assertFalse(result.found)

    def test_run_core_graph_explain(self) -> None:
        records = [
            note_record("Browser capture", "vault/20_notes/capture.md", concepts=["Personal OS", "Web Capture"], tags=["capture"]),
            note_record("Extension intake", "vault/20_notes/extension.md", concepts=["Personal OS", "Web Capture"], tags=["capture"]),
        ]
        graph = self._build_graph(records)
        result = run_core_graph_explain(graph, "Browser capture")
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.node.label, "Browser capture")
        self.assertGreaterEqual(len(result.neighbors), 1)

    def test_resolve_core_node_fuzzy(self) -> None:
        records = [
            note_record("Exact Match", "exact.md", concepts=["Test"]),
        ]
        graph = self._build_graph(records)
        node = resolve_core_node(graph, "exact")
        self.assertIsNotNone(node)
        assert node is not None
        self.assertEqual(node.label, "Exact Match")

    def test_performance_on_larger_graph(self) -> None:
        records = [
            note_record(f"Note {i}", f"vault/20_notes/note-{i}.md", concepts=[f"Concept {i % 10}"], tags=[f"tag-{i % 5}"])
            for i in range(100)
        ]
        graph = self._build_graph(records)
        start = time.perf_counter()
        for _ in range(50):
            run_core_graph_query(graph, "Note 5", traversal="bfs", budget=20)
            run_core_graph_path(graph, "Note 1", "Note 2")
        elapsed = time.perf_counter() - start
        avg_ms = (elapsed / 150) * 1000
        self.assertLess(avg_ms, 10, f"Average query too slow: {avg_ms:.2f}ms")


if __name__ == "__main__":
    unittest.main(verbosity=2)
