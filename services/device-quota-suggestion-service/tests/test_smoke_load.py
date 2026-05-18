from app.embeddings import DeterministicEmbeddingBackend
from app.service import SuggestionService


def test_service_handles_600_distinct_names_against_300_categories_without_oom():
    categories = [
        {
            "id": index + 1,
            "code": "CAT-%03d" % (index + 1),
            "name": "Nhom thiet bi %03d" % (index + 1),
            "classification": None,
        }
        for index in range(300)
    ]
    device_names = [
        {
            "name": "Nhom thiet bi %03d model %03d" % ((index % 300) + 1, index),
            "deviceIds": [index + 1],
        }
        for index in range(600)
    ]
    payload = {
        "requestId": "req-load",
        "facilityId": 17,
        "catalogSignature": "catalog-load",
        "unassignedSignature": "unassigned-load",
        "deviceNames": device_names,
        "categories": categories,
        "options": {"topK": 3, "minConfidence": 0.10, "minMargin": 0.0},
    }
    service = SuggestionService(embedding_backend=DeterministicEmbeddingBackend())

    result = service.suggest(payload)

    assert len(result["suggestions"]) == 600
    assert result["metrics"]["deviceNameCount"] == 600
    assert result["metrics"]["categoryCount"] == 300
    assert result["timings"]["totalMs"] >= 0
