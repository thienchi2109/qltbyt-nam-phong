from concurrent.futures import ThreadPoolExecutor

from app.embeddings import CountingEmbeddingBackend
from app.embeddings import FailingEmbeddingBackend
from app.embeddings import LazyInitCountingBackend
from app.embeddings import RecordingEmbeddingBackend
from app.service import SuggestionService


def payload():
    return {
        "requestId": "req-cache",
        "facilityId": 17,
        "catalogSignature": "catalog-cache",
        "unassignedSignature": "unassigned-cache",
        "deviceNames": [{"name": "Monitor", "deviceIds": [1, 2]}],
        "categories": [{"id": 10, "code": "A", "name": "Monitor", "classification": None}],
        "options": {"topK": 1},
    }


def test_repeated_identical_requests_use_request_cache_and_embedding_cache():
    backend = CountingEmbeddingBackend()
    service = SuggestionService(embedding_backend=backend)

    first = service.suggest(payload())
    calls_after_first = backend.call_count
    second = service.suggest(payload())

    assert first["cache"]["requestHit"] is False
    assert second["cache"]["requestHit"] is True
    assert backend.call_count == calls_after_first


def test_cached_response_preserves_the_current_request_id():
    backend = CountingEmbeddingBackend()
    service = SuggestionService(embedding_backend=backend)
    first_payload = payload()
    second_payload = payload()
    second_payload["requestId"] = "req-cache-second"

    first = service.suggest(first_payload)
    second = service.suggest(second_payload)

    assert first["requestId"] == "req-cache"
    assert second["requestId"] == "req-cache-second"
    assert second["cache"]["requestHit"] is True


def test_device_embedding_uses_normalized_name_for_cache_consistent_vectors():
    backend = RecordingEmbeddingBackend()
    service = SuggestionService(embedding_backend=backend)
    first_payload = payload()
    second_payload = payload()
    first_payload["deviceNames"] = [{"name": "Bơm tiêm điện", "deviceIds": [1]}]
    second_payload["requestId"] = "req-normalized-second"
    second_payload["unassignedSignature"] = "unassigned-cache-2"
    second_payload["deviceNames"] = [{"name": "Bom tiem dien", "deviceIds": [2]}]

    service.suggest(first_payload)
    service.suggest(second_payload)

    assert "bom tiem dien" in backend.seen_text_batches[-1]
    assert "Bơm tiêm điện" not in backend.flattened_seen_texts()


def test_duplicate_concurrent_requests_share_single_flight_work():
    backend = CountingEmbeddingBackend(delay_seconds=0.05)
    service = SuggestionService(embedding_backend=backend)

    with ThreadPoolExecutor(max_workers=5) as executor:
        responses = list(executor.map(lambda _: service.suggest(payload()), range(5)))

    assert len(responses) == 5
    assert backend.call_count == 2
    assert any(response["cache"]["requestHit"] is False for response in responses)
    assert any(response["cache"]["requestHit"] is True for response in responses)


def test_duplicate_concurrent_request_failures_propagate_original_error():
    service = SuggestionService(embedding_backend=FailingEmbeddingBackend())

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(service.suggest, payload()) for _ in range(3)]

    for future in futures:
        try:
            future.result()
        except RuntimeError as exc:
            assert "embedding backend failed" in str(exc)
        else:
            raise AssertionError("Expected backend failure to propagate")


def test_lazy_embedding_backend_initializes_model_once_under_concurrency():
    backend = LazyInitCountingBackend(delay_seconds=0.05)

    with ThreadPoolExecutor(max_workers=5) as executor:
        vectors = list(executor.map(lambda _: backend.embed(["Monitor"]), range(5)))

    assert len(vectors) == 5
    assert backend.init_count == 1
