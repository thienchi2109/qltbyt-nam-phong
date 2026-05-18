from app.embeddings import MappingEmbeddingBackend
from app.embeddings import ShortEmbeddingBackend
from app.service import SuggestionService


def payload_for(names, categories):
    return {
        "requestId": "req-ranking",
        "facilityId": 17,
        "catalogSignature": "catalog-rank",
        "unassignedSignature": "unassigned-rank",
        "deviceNames": names,
        "categories": categories,
        "options": {
            "topK": 2,
            "semanticWeight": 1.0,
            "lexicalWeight": 1.0,
            "minConfidence": 0.70,
            "minMargin": 0.05,
        },
    }


def test_exact_and_fuzzy_matches_rank_first_with_bounded_top_k():
    service = SuggestionService(embedding_backend=MappingEmbeddingBackend({}))
    result = service.suggest(
        payload_for(
            [{"name": "monitor theo dõi bệnh nhân", "deviceIds": [1]}],
            [
                {"id": 10, "code": "A", "name": "Monitor theo doi benh nhan", "classification": None},
                {"id": 20, "code": "B", "name": "May sieu am", "classification": None},
                {"id": 30, "code": "C", "name": "Bom tiem dien", "classification": None},
            ],
        )
    )

    suggestion = result["suggestions"][0]
    assert suggestion["candidates"][0]["categoryId"] == 10
    assert suggestion["needsReview"] is False
    assert len(suggestion["candidates"]) == 2


def test_semantic_similarity_can_rank_when_lexical_match_is_weak():
    backend = MappingEmbeddingBackend(
        {
            "thiet bi sieu am mau": [1.0, 0.0, 0.0],
            "may sieu am doppler": [0.99, 0.01, 0.0],
            "bom tiem dien": [0.0, 1.0, 0.0],
        }
    )
    service = SuggestionService(embedding_backend=backend)

    result = service.suggest(
        payload_for(
            [{"name": "Thiet bi sieu am mau", "deviceIds": [2]}],
            [
                {"id": 20, "code": "B", "name": "May sieu am doppler", "classification": None},
                {"id": 30, "code": "C", "name": "Bom tiem dien", "classification": None},
            ],
        )
    )

    assert result["suggestions"][0]["candidates"][0]["categoryId"] == 20


def test_low_confidence_or_small_margin_requires_review():
    backend = MappingEmbeddingBackend(
        {
            "unknown thing": [1.0, 0.0],
            "category one": [0.7, 0.3],
            "category two": [0.69, 0.31],
        }
    )
    service = SuggestionService(embedding_backend=backend)

    result = service.suggest(
        payload_for(
            [{"name": "unknown thing", "deviceIds": [9]}],
            [
                {"id": 1, "code": "A", "name": "category one", "classification": None},
                {"id": 2, "code": "B", "name": "category two", "classification": None},
            ],
        )
    )

    assert result["suggestions"][0]["needsReview"] is True


def test_category_embedding_count_mismatch_fails_fast():
    service = SuggestionService(embedding_backend=ShortEmbeddingBackend())

    try:
        service.suggest(
            payload_for(
                [{"name": "Monitor", "deviceIds": [1]}],
                [
                    {"id": 1, "code": "A", "name": "Monitor", "classification": None},
                    {"id": 2, "code": "B", "name": "Bom tiem", "classification": None},
                ],
            )
        )
    except ValueError as exc:
        assert "Embedding response count mismatch" in str(exc)
    else:
        raise AssertionError("Expected embedding count mismatch to fail fast")
