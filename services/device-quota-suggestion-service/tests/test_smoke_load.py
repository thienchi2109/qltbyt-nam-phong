from app.embeddings import CountingEmbeddingBackend
from app.embeddings import DeterministicEmbeddingBackend
from app.perf_harness import create_synthetic_unique_payload
from app.perf_harness import create_unit17_payload
from app.service import SuggestionService


def test_service_handles_600_distinct_names_against_300_categories_without_oom():
    payload = create_synthetic_unique_payload(unique_name_count=600, category_count=300)
    service = SuggestionService(embedding_backend=DeterministicEmbeddingBackend())

    result = service.suggest(payload)

    assert len(result["suggestions"]) == 600
    assert result["metrics"]["deviceNameCount"] == 600
    assert result["metrics"]["categoryCount"] == 300
    assert result["timings"]["totalMs"] >= 0


def test_facility_sized_request_batches_device_embeddings():
    payload = create_unit17_payload()
    backend = CountingEmbeddingBackend()
    service = SuggestionService(embedding_backend=backend)

    result = service.suggest(payload)

    assert len(result["suggestions"]) == 504
    assert result["metrics"]["deviceCount"] == 1940
    assert backend.call_count == 2
