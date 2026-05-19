"""Request orchestration for device quota category suggestions."""

import copy
from dataclasses import dataclass
import hashlib
import json
import threading
import time
from typing import Dict, List, Optional, Tuple

from app.embeddings import EmbeddingBackend
from app.instrumentation import elapsed_ms
from app.instrumentation import log_failure
from app.instrumentation import log_success
from app.normalization import normalize_text
from app.ranking import CategoryVector
from app.ranking import character_ngrams
from app.ranking import needs_review
from app.ranking import normalize_vector
from app.ranking import rank_categories
from app.schemas import CategoryItem, ResponseDict, SuggestRequest
from app.settings import Settings


@dataclass
class _InflightRequest:
    condition: threading.Condition
    done: bool = False
    error: Optional[BaseException] = None


class SuggestionService:
    """Coordinate validation, embeddings, ranking, caching, and instrumentation."""

    def __init__(
        self,
        embedding_backend: EmbeddingBackend,
        settings: Settings = Settings(),
    ):
        self.embedding_backend = embedding_backend
        self.settings = settings
        self._category_embedding_cache: Dict[str, List[CategoryVector]] = {}
        self._device_embedding_cache: Dict[str, List[float]] = {}
        self._request_cache: Dict[str, ResponseDict] = {}
        self._inflight: Dict[str, _InflightRequest] = {}
        self._lock = threading.Lock()

    def is_ready(self) -> bool:
        """Return whether the embedding backend has completed runtime initialization."""
        return self.embedding_backend.is_ready()

    def warm(self) -> None:
        """Preload the embedding backend so readiness checks can turn true."""
        self.embedding_backend.warm()

    def suggest(self, payload: dict) -> ResponseDict:
        """Validate a raw request payload and return ranked category suggestions."""
        request_started = time.perf_counter()
        validation_started = request_started
        request = SuggestRequest.model_validate(payload)
        validation_ms = elapsed_ms(validation_started)
        request_key = self._request_key(request)

        with self._lock:
            cached = self._request_cache.get(request_key)
            if cached is not None:
                response = self._cache_hit_response(
                    cached,
                    request.requestId,
                    validation_ms=validation_ms,
                    total_ms=elapsed_ms(request_started),
                )
                log_success(response, request)
                return response
            inflight = self._inflight.get(request_key)
            if inflight is None:
                inflight = _InflightRequest(threading.Condition(self._lock))
                self._inflight[request_key] = inflight
                leader = True
            else:
                leader = False
                while not inflight.done:
                    inflight.condition.wait()
                if inflight.error is not None:
                    raise inflight.error
                cached = self._request_cache[request_key]
                response = self._cache_hit_response(
                    cached,
                    request.requestId,
                    validation_ms=validation_ms,
                    total_ms=elapsed_ms(request_started),
                )
                log_success(response, request)
                return response

        if not leader:
            raise RuntimeError("unreachable single-flight state")

        try:
            result = self._compute(request, validation_ms)
            log_success(result, request)
        except Exception as error:
            log_failure(
                request,
                self._provider_metadata(),
                {
                    "validationMs": validation_ms,
                    "totalMs": elapsed_ms(request_started),
                },
                error,
            )
            with self._lock:
                inflight = self._inflight.pop(request_key)
                inflight.error = error
                inflight.done = True
                inflight.condition.notify_all()
            raise

        with self._lock:
            self._request_cache[request_key] = copy.deepcopy(result)
            inflight = self._inflight.pop(request_key)
            inflight.done = True
            inflight.condition.notify_all()
        return result

    def _compute(self, request: SuggestRequest, validation_ms: float) -> ResponseDict:
        started = time.perf_counter()
        category_started = time.perf_counter()
        categories, category_hit = self._category_vectors(request)
        category_embedding_ms = elapsed_ms(category_started)
        suggestions = []
        normalized_names = [normalize_text(item.name) for item in request.deviceNames]
        unique_device_name_count = len(dict.fromkeys(normalized_names))
        device_started = time.perf_counter()
        device_embeddings = self._device_embeddings(normalized_names)
        device_embedding_ms = elapsed_ms(device_started)
        device_embedding_hits = sum(1 for _, hit in device_embeddings.values() if hit)

        ranking_started = time.perf_counter()
        for item, normalized_name in zip(request.deviceNames, normalized_names):
            embedding, _ = device_embeddings[normalized_name]
            candidates = rank_categories(
                item.name,
                embedding,
                categories,
                request.options,
            )
            suggestions.append(
                {
                    "deviceName": item.name,
                    "deviceIds": item.deviceIds,
                    "normalizedName": normalized_name,
                    "needsReview": needs_review(candidates, request.options),
                    "confidence": candidates[0]["score"] if candidates else 0.0,
                    "candidates": candidates,
                }
            )
        ranking_ms = elapsed_ms(ranking_started)

        result = {
            "requestId": request.requestId,
            "provider": self._provider_metadata(),
            "timings": {
                "validationMs": validation_ms,
                "categoryEmbeddingMs": category_embedding_ms,
                "deviceEmbeddingMs": device_embedding_ms,
                "rankingMs": ranking_ms,
                "serializationMs": 0.0,
                "totalMs": 0.0,
            },
            "metrics": {
                "deviceNameCount": len(request.deviceNames),
                "uniqueDeviceNameCount": unique_device_name_count,
                "deviceCount": sum(len(item.deviceIds) for item in request.deviceNames),
                "categoryCount": len(request.categories),
            },
            "cache": {
                "requestHit": False,
                "categoryEmbeddingHit": category_hit,
                "deviceEmbeddingHits": device_embedding_hits,
                "deviceEmbeddingMisses": unique_device_name_count - device_embedding_hits,
            },
            "suggestions": suggestions,
        }
        serialization_started = time.perf_counter()
        json.dumps(result, ensure_ascii=False, separators=(",", ":"))
        result["timings"]["serializationMs"] = elapsed_ms(serialization_started)
        result["timings"]["totalMs"] = round(elapsed_ms(started) + validation_ms, 3)
        return result

    def _category_vectors(
        self,
        request: SuggestRequest,
    ) -> Tuple[List[CategoryVector], bool]:
        key = self._category_key(request)
        with self._lock:
            cached = self._category_embedding_cache.get(key)
            if cached is not None:
                return cached, True

        normalized = [normalize_text(category.name) for category in request.categories]
        embeddings = self.embedding_backend.embed(normalized)
        if len(embeddings) != len(request.categories):
            raise ValueError(
                "Embedding response count mismatch: expected %d category vectors, received %d"
                % (len(request.categories), len(embeddings))
            )
        vectors = [
            CategoryVector(
                category=category,
                normalized_name=normalized_name,
                embedding=normalize_vector(embedding),
                tokens=frozenset(normalized_name.split()),
                char_grams=character_ngrams(normalized_name),
            )
            for category, normalized_name, embedding in zip(
                request.categories,
                normalized,
                embeddings,
            )
        ]
        with self._lock:
            self._category_embedding_cache[key] = vectors
        return vectors, False

    def _device_embeddings(
        self,
        normalized_names: List[str],
    ) -> Dict[str, Tuple[List[float], bool]]:
        unique_names = list(dict.fromkeys(normalized_names))
        results: Dict[str, Tuple[List[float], bool]] = {}
        missing_names: List[str] = []

        with self._lock:
            for normalized_name in unique_names:
                key = self._device_key(normalized_name)
                cached = self._device_embedding_cache.get(key)
                if cached is not None:
                    results[normalized_name] = (cached, True)
                else:
                    missing_names.append(normalized_name)

        if not missing_names:
            return results

        embeddings = self.embedding_backend.embed(missing_names)
        if len(embeddings) != len(missing_names):
            raise ValueError(
                "Embedding response count mismatch: expected %d device vectors, received %d"
                % (len(missing_names), len(embeddings))
            )

        normalized_embeddings = [normalize_vector(embedding) for embedding in embeddings]
        with self._lock:
            for normalized_name, embedding in zip(missing_names, normalized_embeddings):
                self._device_embedding_cache[self._device_key(normalized_name)] = embedding
                results[normalized_name] = (embedding, False)
        return results

    def _engine_signature(self) -> str:
        return "%s:%s:%s" % (
            self.settings.provider_name,
            self.settings.provider_version,
            self.embedding_backend.model_name,
        )

    def _provider_metadata(self) -> dict:
        return {
            "name": self.settings.provider_name,
            "version": self.settings.provider_version,
            "model": self.embedding_backend.model_name,
        }

    def _category_key(self, request: SuggestRequest) -> str:
        return self._hash(
            {
                "facilityId": request.facilityId,
                "catalogSignature": request.catalogSignature,
                "engine": self._engine_signature(),
            }
        )

    def _device_key(self, normalized_name: str) -> str:
        return self._hash(
            {
                "normalizedName": normalized_name,
                "engine": self._engine_signature(),
            }
        )

    def _request_key(self, request: SuggestRequest) -> str:
        return self._hash(
            {
                "facilityId": request.facilityId,
                "catalogSignature": request.catalogSignature,
                "unassignedSignature": request.unassignedSignature,
                "options": request.options.model_dump(),
                "engine": self._engine_signature(),
            }
        )

    @staticmethod
    def _hash(value: dict) -> str:
        packed = json.dumps(value, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(packed.encode("utf-8")).hexdigest()

    @staticmethod
    def _cache_hit_response(
        cached: ResponseDict,
        request_id: str,
        validation_ms: Optional[float] = None,
        total_ms: Optional[float] = None,
    ) -> ResponseDict:
        response = copy.deepcopy(cached)
        response["requestId"] = request_id
        response["cache"]["requestHit"] = True
        if validation_ms is not None and total_ms is not None:
            response["timings"] = {
                "validationMs": validation_ms,
                "categoryEmbeddingMs": 0.0,
                "deviceEmbeddingMs": 0.0,
                "rankingMs": 0.0,
                "serializationMs": 0.0,
                "totalMs": total_ms,
            }
        return response
