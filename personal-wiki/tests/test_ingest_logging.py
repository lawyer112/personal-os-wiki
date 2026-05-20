from __future__ import annotations

import json
import logging
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from test_ingest_api import TOKEN, call_ingest, payload  # noqa: E402


def log_records(caplog):
    return [json.loads(record.message) for record in caplog.records if record.name == "personal_wiki.ingest"]


def test_logs_success_record(tmp_path: Path, caplog) -> None:
    caplog.set_level(logging.INFO, logger="personal_wiki.ingest")

    call_ingest(tmp_path, payload())

    records = log_records(caplog)
    assert records[-1]["event"] == "ingest"
    assert records[-1]["outcome"] == "accepted"
    assert records[-1]["task_id"] == "task-1"
    assert records[-1]["created_by"] == "hermes:worker"
    assert records[-1]["type"] == "project"
    assert records[-1]["path"].endswith("东京交通整理.md")
    assert "duration_ms" in records[-1]


def test_logs_failure_record(tmp_path: Path, caplog) -> None:
    caplog.set_level(logging.INFO, logger="personal_wiki.ingest")

    call_ingest(tmp_path, payload(), token="wrong-token")

    records = log_records(caplog)
    assert records[-1]["outcome"] == "rejected"
    assert records[-1]["reason"] == "missing-or-invalid-token"
    assert records[-1]["task_id"] is None
    assert records[-1]["path"] is None
