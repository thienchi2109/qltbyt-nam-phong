import math
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import List, Optional

from app.normalization import normalize_text
from app.schemas import CategoryItem, SuggestOptions


@dataclass(frozen=True)
class CategoryVector:
    category: CategoryItem
    normalized_name: str
    embedding: List[float]


def cosine_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))


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
    ranked = []
    for category_vector in categories:
        lexical = lexical_similarity_normalized(
            device_normalized,
            category_vector.normalized_name,
        )
        semantic = cosine_similarity(device_embedding, category_vector.embedding)
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
