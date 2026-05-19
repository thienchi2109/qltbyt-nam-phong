import json
from pathlib import Path
import subprocess
import sys

from app.embeddings import CountingEmbeddingBackend
from app.perf_harness import create_synthetic_unique_payload
from app.perf_harness import create_unit17_payload
from app.perf_harness import run_deterministic_case
from app.service import SuggestionService


def test_unit17_payload_shape_preserves_unique_names_and_total_devices():
    payload = create_unit17_payload()

    assert len(payload["deviceNames"]) == 504
    assert sum(len(item["deviceIds"]) for item in payload["deviceNames"]) == 1940
    assert len(payload["categories"]) == 291


def test_synthetic_payload_documents_2000_unique_name_risk():
    payload = create_synthetic_unique_payload(unique_name_count=2000, category_count=300)

    assert len(payload["deviceNames"]) == 2000
    assert sum(len(item["deviceIds"]) for item in payload["deviceNames"]) == 2000
    assert len(payload["categories"]) == 300


def test_synthetic_payload_rejects_invalid_counts():
    for kwargs in (
        {"unique_name_count": 0, "category_count": 300},
        {"unique_name_count": 2000, "category_count": 0},
    ):
        try:
            create_synthetic_unique_payload(**kwargs)
        except ValueError as exc:
            assert "must be > 0" in str(exc)
        else:
            raise AssertionError("Expected invalid harness counts to fail")


def test_unit17_shape_embeds_unique_names_not_every_device_id():
    backend = CountingEmbeddingBackend()
    service = SuggestionService(embedding_backend=backend)

    result = service.suggest(create_unit17_payload())

    assert len(result["suggestions"]) == 504
    assert result["metrics"]["deviceCount"] == 1940
    assert result["metrics"]["uniqueDeviceNameCount"] == 504
    assert backend.call_count == 2


def test_deterministic_harness_reports_duration_timings_metrics_and_cache():
    summary = run_deterministic_case("unit17")

    assert summary["case"] == "unit17"
    assert summary["totalDurationMs"] >= 0
    assert summary["timings"]["rankingMs"] >= 0
    assert summary["metrics"]["deviceCount"] == 1940
    assert summary["metrics"]["uniqueDeviceNameCount"] == 504
    assert summary["cache"]["requestHit"] is False


def test_cli_harness_prints_json_summary():
    script = Path(__file__).resolve().parents[1] / "scripts" / "dqss_perf_harness.py"
    completed = subprocess.run(
        [
            sys.executable,
            str(script),
            "--case",
            "unit17",
            "--mode",
            "deterministic",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    summary = json.loads(completed.stdout)
    assert summary["case"] == "unit17"
    assert summary["metrics"]["deviceCount"] == 1940
    assert "rankingMs" in summary["timings"]
