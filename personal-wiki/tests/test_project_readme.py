from __future__ import annotations

import threading
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from server import ingest_payload  # noqa: E402


def payload(title: str = "Plan") -> dict[str, object]:
    return {
        "frontmatter": {
            "title": title,
            "type": "project",
            "created_by": "hermes:worker",
            "task_id": "task-1",
            "agent_id": "worker-1",
            "project": "2026-05 东京行",
            "source_type": "agent-output",
            "tags": [],
            "created_at": "2026-05-13T10:00:00+08:00",
        },
        "content": "Body",
    }


def test_first_project_note_creates_readme(tmp_path: Path) -> None:
    ingest_payload(payload(), vault_root=tmp_path)

    readme = tmp_path / "30_projects" / "2026-05-东京行" / "README.md"
    assert readme.exists()
    assert "# 2026-05 东京行" in readme.read_text(encoding="utf-8")


def test_second_project_note_does_not_recreate_readme(tmp_path: Path) -> None:
    ingest_payload(payload("Plan A"), vault_root=tmp_path)
    readme = tmp_path / "30_projects" / "2026-05-东京行" / "README.md"
    first_content = readme.read_text(encoding="utf-8")

    ingest_payload(payload("Plan B"), vault_root=tmp_path)

    assert readme.read_text(encoding="utf-8") == first_content


def test_concurrent_project_writes_create_one_readme(tmp_path: Path) -> None:
    threads = [
        threading.Thread(target=ingest_payload, args=(payload(f"Plan {index}"),), kwargs={"vault_root": tmp_path})
        for index in range(2)
    ]

    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    project_dir = tmp_path / "30_projects" / "2026-05-东京行"
    assert (project_dir / "README.md").exists()
    assert len(list(project_dir.glob("README*.md"))) == 1
    assert len(list(project_dir.glob("Plan*.md"))) == 2
