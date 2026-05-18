import copy
import hashlib
import json
import threading
import time
from typing import Dict, List, Tuple

from app.embeddings import EmbeddingBackend
from app.normalization import normalize_text
from app.ranking import CategoryVector, needs_review, rank_categories
from app.schemas import CategoryItem, ResponseDict, SuggestRequest
from app.settings import Settings


class SuggestionService:
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
        self._inflight: Dict[str, threading.Condition] = {}
        self._inflight_errors: Dict[str, BaseException] = {}
        self._lock = threading.Lock()

    def is_ready(self) -> bool:
        return self.embedding_backend.is_ready()

    def warm(self) -> None:
        self.embedding_backend.warm()

    def suggest(self, payload: dict) -> ResponseDict:
        request = SuggestRequest.model_validate(payload)
        request_key = self._request_key(request)

        with self._lock:
            cached = self._request_cache.get(request_key)
            if cached is not None:
                return self._cache_hit_response(cached, request.requestId)
            condition = self._inflight.get(request_key)
            if condition is None:
                self._inflight_errors.pop(request_key, None)
                condition = threading.Condition(self._lock)
                self._inflight[request_key] = condition
                leader = True
            else:
                leader = False
                while request_key in self._inflight:
                    condition.wait()
                if request_key in self._inflight_errors:
                    raise self._inflight_errors[request_key]
                cached = self._request_cache[request_key]
                return self._cache_hit_response(cached, request.requestId)

        if not leader:
            raise RuntimeError("unreachable single-flight state")

        try:
            result = self._compute(request)
        except Exception as error:
            with self._lock:
                self._inflight_errors[request_key] = error
                condition = self._inflight.pop(request_key)
                condition.notify_all()
            raise

        with self._lock:
            self._request_cache[request_key] = copy.deepcopy(result)
            condition = self._inflight.pop(request_key)
            condition.notify_all()
        return result

    def _compute(self, request: SuggestRequest) -> ResponseDict:
        started = time.perf_counter()
        categories, category_hit = self._category_vectors(request)
        suggestions = []
        device_hits = 0

        for item in request.deviceNames:
            normalized_name = normalize_text(item.name)
            embedding, hit = self._device_embedding(normalized_name)
            if hit:
                device_hits += 1
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

        total_ms = round((time.perf_counter() - started) * 1000, 3)
        return {
            "requestId": request.requestId,
            "provider": {
                "name": self.settings.provider_name,
                "version": self.settings.provider_version,
                "model": self.embedding_backend.model_name,
            },
            "timings": {"totalMs": total_ms},
            "metrics": {
                "deviceNameCount": len(request.deviceNames),
                "categoryCount": len(request.categories),
            },
            "cache": {
                "requestHit": False,
                "categoryEmbeddingHit": category_hit,
                "deviceEmbeddingHits": device_hits,
            },
            "suggestions": suggestions,
        }

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
                embedding=embedding,
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

    def _device_embedding(self, normalized_name: str) -> Tuple[List[float], bool]:
        key = self._device_key(normalized_name)
        with self._lock:
            cached = self._device_embedding_cache.get(key)
            if cached is not None:
                return cached, True

        embeddings = self.embedding_backend.embed([normalized_name])
        if len(embeddings) != 1:
            raise ValueError(
                "Embedding response count mismatch: expected 1 device vector, received %d"
                % len(embeddings)
            )
        embedding = embeddings[0]
        with self._lock:
            self._device_embedding_cache[key] = embedding
        return embedding, False

    def _engine_signature(self) -> str:
        return "%s:%s:%s" % (
            self.settings.provider_name,
            self.settings.provider_version,
            self.embedding_backend.model_name,
        )

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
    def _cache_hit_response(cached: ResponseDict, request_id: str) -> ResponseDict:
        response = copy.deepcopy(cached)
        response["requestId"] = request_id
        response["cache"]["requestHit"] = True
        return response
