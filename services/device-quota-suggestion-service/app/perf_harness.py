"""Deterministic payload builders for DQSS smoke and performance checks."""

import time
from typing import Dict

from app.embeddings import DeterministicEmbeddingBackend
from app.service import SuggestionService


def create_unit17_payload() -> dict:
    """Return a deterministic payload shaped like the Unit 17 production case."""
    return {
        "requestId": "req-harness-unit17",
        "facilityId": 17,
        "catalogSignature": "catalog-unit17",
        "unassignedSignature": "unassigned-unit17",
        "deviceNames": _device_names(504, 1940),
        "categories": _categories(291),
        "options": {"topK": 3, "minConfidence": 0.10, "minMargin": 0.0},
    }


def create_synthetic_unique_payload(
    unique_name_count: int = 2000,
    category_count: int = 300,
) -> dict:
    """Return a large synthetic payload with configurable unique-name cardinality."""
    _validate_positive_count("unique_name_count", unique_name_count)
    _validate_positive_count("category_count", category_count)
    return {
        "requestId": "req-harness-synthetic-%d" % unique_name_count,
        "facilityId": 17,
        "catalogSignature": "catalog-synthetic-%d" % category_count,
        "unassignedSignature": "unassigned-synthetic-%d" % unique_name_count,
        "deviceNames": _device_names(unique_name_count, unique_name_count),
        "categories": _categories(category_count),
        "options": {"topK": 3, "minConfidence": 0.10, "minMargin": 0.0},
    }


def run_deterministic_case(case_name: str) -> Dict[str, object]:
    """Run a named deterministic harness case and return summary metrics."""
    payload = _payload_for_case(case_name)
    service = SuggestionService(embedding_backend=DeterministicEmbeddingBackend())
    started = time.perf_counter()
    result = service.suggest(payload)
    total_duration_ms = round((time.perf_counter() - started) * 1000, 3)
    return {
        "case": case_name,
        "totalDurationMs": total_duration_ms,
        "timings": result["timings"],
        "metrics": _public_metrics(result["metrics"]),
        "cache": result["cache"],
        "suggestionCount": len(result["suggestions"]),
        "provider": result["provider"],
    }


def _payload_for_case(case_name: str) -> dict:
    if case_name == "unit17":
        return create_unit17_payload()
    if case_name == "synthetic-2000":
        return create_synthetic_unique_payload()
    raise ValueError("Unknown DQSS perf harness case: %s" % case_name)


def _categories(count: int) -> list:
    _validate_positive_count("category_count", count)
    return [
        {
            "id": index + 1,
            "code": "CAT-%03d" % (index + 1),
            "name": "Nhom thiet bi %03d" % (index + 1),
            "classification": None,
        }
        for index in range(count)
    ]


def _device_names(unique_name_count: int, total_device_count: int) -> list:
    _validate_positive_count("unique_name_count", unique_name_count)
    if total_device_count < 0:
        raise ValueError("total_device_count must be >= 0")
    names = [
        {
            "name": "Thiet bi can phan loai %04d" % index,
            "deviceIds": [],
        }
        for index in range(unique_name_count)
    ]
    for device_id in range(1, total_device_count + 1):
        names[(device_id - 1) % unique_name_count]["deviceIds"].append(device_id)
    return names


def _validate_positive_count(name: str, value: int) -> None:
    if value <= 0:
        raise ValueError("%s must be > 0" % name)


def _public_metrics(metrics: dict) -> dict:
    return {
        "deviceNameCount": metrics["deviceNameCount"],
        "uniqueDeviceNameCount": metrics["uniqueDeviceNameCount"],
        "deviceCount": metrics["deviceCount"],
        "categoryCount": metrics["categoryCount"],
    }
