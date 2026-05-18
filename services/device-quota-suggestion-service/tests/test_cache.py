from concurrent.futures import ThreadPoolExecutor

from app.embeddings import CountingEmbeddingBackend
from app.embeddings import LazyInitCountingBackend
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


def test_duplicate_concurrent_requests_share_single_flight_work():
    backend = CountingEmbeddingBackend(delay_seconds=0.05)
    service = SuggestionService(embedding_backend=backend)

    with ThreadPoolExecutor(max_workers=5) as executor:
        responses = list(executor.map(lambda _: service.suggest(payload()), range(5)))

    assert len(responses) == 5
    assert backend.call_count == 2
    assert any(response["cache"]["requestHit"] is False for response in responses)
    assert any(response["cache"]["requestHit"] is True for response in responses)


def test_lazy_embedding_backend_initializes_model_once_under_concurrency():
    backend = LazyInitCountingBackend(delay_seconds=0.05)

    with ThreadPoolExecutor(max_workers=5) as executor:
        vectors = list(executor.map(lambda _: backend.embed(["Monitor"]), range(5)))

    assert len(vectors) == 5
    assert backend.init_count == 1
