import json
import logging

from app.embeddings import DeterministicEmbeddingBackend
from app.embeddings import FailingEmbeddingBackend
from app.service import SuggestionService


def payload():
    return {
        "requestId": "req-instrumentation",
        "facilityId": 17,
        "catalogSignature": "catalog-instrumentation",
        "unassignedSignature": "unassigned-instrumentation",
        "deviceNames": [
            {"name": "SECRET_DEVICE_SENTINEL", "deviceIds": [1, 2]},
        ],
        "categories": [
            {
                "id": 291,
                "code": "CAT-291",
                "name": "SECRET_CATEGORY_SENTINEL",
                "classification": None,
            },
        ],
        "options": {"topK": 1},
    }


def parsed_dqss_events(caplog):
    events = []
    for record in caplog.records:
        if record.name == "dqss.suggest":
            events.append(json.loads(record.getMessage()))
    return events


def test_success_logs_sanitized_phase_timings_and_counts(caplog):
    caplog.set_level(logging.INFO, logger="dqss.suggest")
    service = SuggestionService(embedding_backend=DeterministicEmbeddingBackend())

    service.suggest(payload())

    events = parsed_dqss_events(caplog)
    assert len(events) == 1
    event = events[0]
    assert event["event"] == "dqss.suggest.completed"
    assert event["requestId"] == "req-instrumentation"
    assert event["facilityId"] == 17
    assert event["provider"] == {
        "name": "vm-local",
        "version": "0.1.0",
        "model": "deterministic-test-embedding",
    }
    assert event["metrics"] == {
        "deviceNameCount": 1,
        "uniqueDeviceNameCount": 1,
        "deviceCount": 2,
        "categoryCount": 1,
    }
    assert event["cache"]["requestHit"] is False
    assert event["cache"]["categoryEmbeddingHit"] is False
    assert event["cache"]["deviceEmbeddingHits"] == 0
    assert event["cache"]["deviceEmbeddingMisses"] == 1
    for key in (
        "validationMs",
        "categoryEmbeddingMs",
        "deviceEmbeddingMs",
        "rankingMs",
        "serializationMs",
        "totalMs",
    ):
        assert event["timings"][key] >= 0

    raw_logs = "\n".join(record.getMessage() for record in caplog.records)
    assert "SECRET_DEVICE_SENTINEL" not in raw_logs
    assert "SECRET_CATEGORY_SENTINEL" not in raw_logs


def test_failure_logs_sanitized_failure_reason_without_payload_names(caplog):
    caplog.set_level(logging.INFO, logger="dqss.suggest")
    service = SuggestionService(embedding_backend=FailingEmbeddingBackend())

    try:
        service.suggest(payload())
    except RuntimeError:
        pass
    else:
        raise AssertionError("Expected embedding failure")

    events = parsed_dqss_events(caplog)
    assert len(events) == 1
    event = events[0]
    assert event["event"] == "dqss.suggest.failed"
    assert event["requestId"] == "req-instrumentation"
    assert event["facilityId"] == 17
    assert event["failureReason"] == "RuntimeError"
    assert event["metrics"] == {
        "deviceNameCount": 1,
        "uniqueDeviceNameCount": 1,
        "deviceCount": 2,
        "categoryCount": 1,
    }

    raw_logs = "\n".join(record.getMessage() for record in caplog.records)
    assert "SECRET_DEVICE_SENTINEL" not in raw_logs
    assert "SECRET_CATEGORY_SENTINEL" not in raw_logs
    assert "embedding backend failed" not in raw_logs


def test_request_cache_hit_still_logs_sanitized_summary(caplog):
    caplog.set_level(logging.INFO, logger="dqss.suggest")
    service = SuggestionService(embedding_backend=DeterministicEmbeddingBackend())

    service.suggest(payload())
    service.suggest(payload())

    events = parsed_dqss_events(caplog)
    assert len(events) == 2
    assert events[1]["event"] == "dqss.suggest.completed"
    assert events[1]["cache"]["requestHit"] is True
    assert events[1]["timings"]["categoryEmbeddingMs"] == 0.0
    assert events[1]["timings"]["deviceEmbeddingMs"] == 0.0
    assert events[1]["timings"]["rankingMs"] == 0.0
    assert events[1]["timings"]["totalMs"] >= 0


def test_reused_duplicate_device_names_count_unique_cache_hits(caplog):
    caplog.set_level(logging.INFO, logger="dqss.suggest")
    service = SuggestionService(embedding_backend=DeterministicEmbeddingBackend())
    first_payload = payload()
    second_payload = payload()
    second_payload["requestId"] = "req-instrumentation-second"
    second_payload["unassignedSignature"] = "unassigned-instrumentation-second"
    second_payload["deviceNames"] = [
        {"name": "SECRET_DEVICE_SENTINEL", "deviceIds": [1]},
        {"name": "secret device sentinel", "deviceIds": [2]},
    ]

    service.suggest(first_payload)
    service.suggest(second_payload)

    event = parsed_dqss_events(caplog)[1]
    assert event["metrics"]["deviceNameCount"] == 2
    assert event["metrics"]["uniqueDeviceNameCount"] == 1
    assert event["cache"]["deviceEmbeddingHits"] == 1
    assert event["cache"]["deviceEmbeddingMisses"] == 0
