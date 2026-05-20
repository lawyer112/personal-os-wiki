from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from frontmatter import IngestError  # noqa: E402
from locks import project_lock  # noqa: E402


def test_project_lock_timeout_when_already_held(tmp_path: Path) -> None:
    with project_lock(tmp_path, "demo", timeout=1):
        with pytest.raises(IngestError) as error:
            with project_lock(tmp_path, "demo", timeout=0.01):
                pass

    assert error.value.status_code == 503
    assert error.value.code == "lock-timeout"
    resource = Path(error.value.details["resource"]).resolve()
    assert resource.relative_to(tmp_path.resolve()).as_posix() == "30_projects/demo/.lock"
