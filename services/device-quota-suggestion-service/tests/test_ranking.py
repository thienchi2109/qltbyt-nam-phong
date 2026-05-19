import app.ranking as ranking
from app.embeddings import MappingEmbeddingBackend
from app.embeddings import ShortEmbeddingBackend
from app.ranking import CategoryVector
from app.ranking import rank_categories
from app.schemas import CategoryItem
from app.schemas import SuggestOptions
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


def test_fuzzy_typo_match_can_rank_first_after_shortlisting():
    options = SuggestOptions(topK=2)
    candidates = rank_categories(
        "monitor theo doi benh nhn",
        [1.0, 0.0],
        [
            CategoryVector(
                category=CategoryItem(
                    id=10,
                    code="A",
                    name="Monitor theo doi benh nhan",
                    classification=None,
                ),
                normalized_name="monitor theo doi benh nhan",
                embedding=[1.0, 0.0],
            ),
            CategoryVector(
                category=CategoryItem(id=20, code="B", name="May sieu am", classification=None),
                normalized_name="may sieu am",
                embedding=[1.0, 0.0],
            ),
            CategoryVector(
                category=CategoryItem(id=30, code="C", name="Bom tiem dien", classification=None),
                normalized_name="bom tiem dien",
                embedding=[1.0, 0.0],
            ),
        ],
        options,
    )

    assert candidates[0]["categoryId"] == 10
    assert candidates[0]["lexicalScore"] > candidates[1]["lexicalScore"]


def test_lexical_only_typo_match_can_enter_shortlist_without_token_overlap():
    options = SuggestOptions(topK=1, semanticWeight=0.0, lexicalWeight=1.0)
    categories = [
        CategoryVector(
            category=CategoryItem(
                id=index + 1,
                code=f"C{index:03d}",
                name=f"zzzzzz {index:03d}",
                classification=None,
            ),
            normalized_name=f"zzzzzz {index:03d}",
            embedding=[1.0, 0.0],
        )
        for index in range(40)
    ]
    categories.append(
        CategoryVector(
            category=CategoryItem(id=99, code="M", name="abcxef", classification=None),
            normalized_name="abcxef",
            embedding=[1.0, 0.0],
        )
    )

    candidates = rank_categories(
        "abcdef",
        [0.0, 1.0],
        categories,
        options,
    )

    assert candidates[0]["categoryId"] == 99


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


def test_deterministic_tie_breaking_uses_code_then_id():
    options = SuggestOptions(topK=3)
    candidates = rank_categories(
        "alpha",
        [1.0, 0.0],
        [
            CategoryVector(
                category=CategoryItem(id=30, code="C", name="beta", classification=None),
                normalized_name="beta",
                embedding=[1.0, 0.0],
            ),
            CategoryVector(
                category=CategoryItem(id=20, code="B", name="beta", classification=None),
                normalized_name="beta",
                embedding=[1.0, 0.0],
            ),
            CategoryVector(
                category=CategoryItem(id=10, code="B", name="beta", classification=None),
                normalized_name="beta",
                embedding=[1.0, 0.0],
            ),
        ],
        options,
    )

    assert [candidate["categoryId"] for candidate in candidates] == [10, 20, 30]


def test_fuzzy_matching_is_bounded_to_shortlist(monkeypatch):
    fuzzy_call_count = 0
    real_sequence_matcher = ranking.SequenceMatcher

    class CountingSequenceMatcher:
        def __init__(self, *args, **kwargs):
            self._matcher = real_sequence_matcher(*args, **kwargs)

        def ratio(self):
            nonlocal fuzzy_call_count
            fuzzy_call_count += 1
            return self._matcher.ratio()

    monkeypatch.setattr(ranking, "SequenceMatcher", CountingSequenceMatcher)
    options = SuggestOptions(topK=3)
    categories = [
        CategoryVector(
            category=CategoryItem(
                id=index + 1,
                code=f"C{index:03d}",
                name=f"nhom vat tu {index:03d}",
                classification=None,
            ),
            normalized_name=f"nhom vat tu {index:03d}",
            embedding=[1.0, 0.0] if index < 8 else [0.0, 1.0],
        )
        for index in range(80)
    ]

    candidates = rank_categories(
        "monitor tim mach",
        [1.0, 0.0],
        categories,
        options,
    )

    assert len(candidates) == 3
    assert fuzzy_call_count <= 16


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
