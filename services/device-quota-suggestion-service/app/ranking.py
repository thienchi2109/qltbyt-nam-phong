import math
from dataclasses import dataclass
from difflib import SequenceMatcher
import heapq
from typing import FrozenSet, List, Optional

from app.normalization import normalize_text
from app.schemas import CategoryItem, SuggestOptions


@dataclass(frozen=True)
class CategoryVector:
    category: CategoryItem
    normalized_name: str
    embedding: List[float]
    tokens: Optional[FrozenSet[str]] = None
    char_grams: Optional[FrozenSet[str]] = None


def cosine_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))

def normalize_vector(vector: List[float]) -> List[float]:
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]

def normalized_dot_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    return max(0.0, min(1.0, dot))


def lexical_similarity(left: str, right: str) -> float:
    return lexical_similarity_normalized(
        normalize_text(left),
        normalize_text(right),
    )


def lexical_similarity_normalized(left_normalized: str, right_normalized: str) -> float:
    if not left_normalized or not right_normalized:
        return 0.0
    if left_normalized == right_normalized:
        return 1.0
    if left_normalized in right_normalized or right_normalized in left_normalized:
        return 0.86
    return SequenceMatcher(None, left_normalized, right_normalized).ratio()


def fused_score(
    lexical_score: float,
    semantic_score: float,
    options: SuggestOptions,
) -> float:
    total_weight = options.lexicalWeight + options.semanticWeight
    if total_weight <= 0:
        return 0.0
    value = (
        lexical_score * options.lexicalWeight
        + semantic_score * options.semanticWeight
    ) / total_weight
    return round(max(0.0, min(1.0, value)), 6)


def rank_categories(
    device_name: str,
    device_embedding: List[float],
    categories: List[CategoryVector],
    options: SuggestOptions,
) -> List[dict]:
    device_normalized = normalize_text(device_name)
    device_tokens = frozenset(device_normalized.split())
    device_char_grams = character_ngrams(device_normalized)
    shortlist = _shortlist_category_indices(
        device_normalized,
        device_tokens,
        device_char_grams,
        device_embedding,
        categories,
        options,
    )
    ranked = []
    for category_index in shortlist:
        category_vector = categories[category_index]
        lexical = _exact_or_contains_score(
            device_normalized,
            category_vector.normalized_name,
        )
        if lexical is None:
            lexical = lexical_similarity_normalized(
                device_normalized,
                category_vector.normalized_name,
            )
        semantic = normalized_dot_similarity(
            device_embedding,
            category_vector.embedding,
        )
        score = fused_score(lexical, semantic, options)
        ranked.append(
            {
                "categoryId": category_vector.category.id,
                "categoryCode": category_vector.category.code,
                "categoryName": category_vector.category.name,
                "classification": category_vector.category.classification,
                "score": score,
                "lexicalScore": round(lexical, 6),
                "semanticScore": round(semantic, 6),
            }
        )
    ranked.sort(
        key=lambda item: (
            -item["score"],
            -item["lexicalScore"],
            item["categoryCode"] or "",
            item["categoryId"],
        )
    )
    return ranked[: options.topK]


def _shortlist_category_indices(
    device_normalized: str,
    device_tokens: FrozenSet[str],
    device_char_grams: FrozenSet[str],
    device_embedding: List[float],
    categories: List[CategoryVector],
    options: SuggestOptions,
) -> List[int]:
    limit = _shortlist_limit(options)
    selected = set()
    semantic_scores = []
    cheap_lexical_scores = []

    for index, category_vector in enumerate(categories):
        category_tokens = category_vector.tokens or frozenset(
            category_vector.normalized_name.split()
        )
        category_char_grams = category_vector.char_grams or character_ngrams(
            category_vector.normalized_name
        )
        exact_or_contains = _exact_or_contains_score(
            device_normalized,
            category_vector.normalized_name,
        )
        if exact_or_contains is not None:
            selected.add(index)
            cheap_lexical = exact_or_contains
        else:
            cheap_lexical = max(
                _token_overlap_score(device_tokens, category_tokens),
                _character_ngram_score(device_char_grams, category_char_grams),
            )

        semantic = normalized_dot_similarity(device_embedding, category_vector.embedding)
        semantic_scores.append((index, semantic, category_vector))
        if cheap_lexical > 0:
            cheap_lexical_scores.append((index, cheap_lexical, category_vector))

    selected.update(
        index
        for index, _, _ in heapq.nsmallest(
            limit,
            semantic_scores,
            key=lambda item: (
                -item[1],
                item[2].category.code or "",
                item[2].category.id,
            ),
        )
    )
    selected.update(
        index
        for index, _, _ in heapq.nsmallest(
            limit,
            cheap_lexical_scores,
            key=lambda item: (
                -item[1],
                item[2].category.code or "",
                item[2].category.id,
            ),
        )
    )
    return sorted(selected)


def _shortlist_limit(options: SuggestOptions) -> int:
    return min(max(options.topK * 3, 8), 24)


def _exact_or_contains_score(
    left_normalized: str,
    right_normalized: str,
) -> Optional[float]:
    if not left_normalized or not right_normalized:
        return None
    if left_normalized == right_normalized:
        return 1.0
    if left_normalized in right_normalized or right_normalized in left_normalized:
        return 0.86
    return None


def _token_overlap_score(
    left_tokens: FrozenSet[str],
    right_tokens: FrozenSet[str],
) -> float:
    if not left_tokens or not right_tokens:
        return 0.0
    overlap = len(left_tokens & right_tokens)
    if overlap == 0:
        return 0.0
    return overlap / max(len(left_tokens), len(right_tokens))


def _character_ngram_score(
    left_grams: FrozenSet[str],
    right_grams: FrozenSet[str],
) -> float:
    if not left_grams or not right_grams:
        return 0.0
    overlap = len(left_grams & right_grams)
    if overlap == 0:
        return 0.0
    return overlap / max(len(left_grams), len(right_grams))


def character_ngrams(value: str) -> FrozenSet[str]:
    compact = value.replace(" ", "")
    if len(compact) < 2:
        return frozenset([compact]) if compact else frozenset()
    return frozenset(compact[index : index + 2] for index in range(len(compact) - 1))


def needs_review(candidates: List[dict], options: SuggestOptions) -> bool:
    if not candidates:
        return True
    top_score = candidates[0]["score"]
    if top_score < options.minConfidence:
        return True
    second_score: Optional[float] = None
    if len(candidates) > 1:
        second_score = candidates[1]["score"]
    if second_score is not None and top_score - second_score < options.minMargin:
        return True
    return False
