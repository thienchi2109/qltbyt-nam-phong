import hashlib
import math
import os
import threading
import time
from typing import Dict, Iterable, List, Optional

from app.normalization import normalize_text
from app.settings import Settings


class EmbeddingBackend:
    model_name = "unknown"

    def is_ready(self) -> bool:
        return True

    def warm(self) -> None:
        self.embed(["warmup"])

    def embed(self, texts: Iterable[str]) -> List[List[float]]:
        raise NotImplementedError


class DeterministicEmbeddingBackend(EmbeddingBackend):
    model_name = "deterministic-test-embedding"

    def embed(self, texts: Iterable[str]) -> List[List[float]]:
        return [self._embed_one(text) for text in texts]

    @staticmethod
    def _embed_one(text: str) -> List[float]:
        normalized = normalize_text(text)
        digest = hashlib.sha256(normalized.encode("utf-8")).digest()
        values = []
        for index in range(0, 16, 2):
            raw = int.from_bytes(digest[index : index + 2], "big")
            values.append((raw / 65535.0) * 2.0 - 1.0)
        norm = math.sqrt(sum(value * value for value in values)) or 1.0
        return [value / norm for value in values]


class MappingEmbeddingBackend(EmbeddingBackend):
    model_name = "mapping-test-embedding"

    def __init__(self, mapping: Dict[str, List[float]]):
        self._mapping = {
            normalize_text(key): self._normalize_vector(value)
            for key, value in mapping.items()
        }
        self._fallback = DeterministicEmbeddingBackend()

    def embed(self, texts: Iterable[str]) -> List[List[float]]:
        vectors = []
        for text in texts:
            normalized = normalize_text(text)
            if normalized in self._mapping:
                vectors.append(self._mapping[normalized])
            else:
                vectors.append(self._fallback.embed([text])[0])
        return vectors

    @staticmethod
    def _normalize_vector(vector: List[float]) -> List[float]:
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]


class CountingEmbeddingBackend(DeterministicEmbeddingBackend):
    def __init__(self, delay_seconds: float = 0.0):
        self.delay_seconds = delay_seconds
        self.call_count = 0
        self._lock = threading.Lock()

    def embed(self, texts: Iterable[str]) -> List[List[float]]:
        with self._lock:
            self.call_count += 1
        if self.delay_seconds:
            time.sleep(self.delay_seconds)
        return super().embed(texts)


class SentenceTransformerEmbeddingBackend(EmbeddingBackend):
    def __init__(self, model_name: str):
        self.model_name = model_name
        self._model = None
        self._model_lock = threading.Lock()

    def is_ready(self) -> bool:
        return self._model is not None

    def warm(self) -> None:
        self._ensure_model()
        self.embed(["warmup"])

    def embed(self, texts: Iterable[str]) -> List[List[float]]:
        model = self._ensure_model()
        prepared = [self._prepare(text) for text in texts]
        encoded = model.encode(prepared, normalize_embeddings=True)
        return [list(map(float, vector)) for vector in encoded]

    def _ensure_model(self):
        if self._model is None:
            with self._model_lock:
                if self._model is None:
                    self._model = self._load_model()
        return self._model

    def _load_model(self):
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(self.model_name)

    @staticmethod
    def _prepare(text: str) -> str:
        normalized = normalize_text(text)
        try:
            from pyvi import ViTokenizer
        except ImportError:
            return normalized

        try:
            return ViTokenizer.tokenize(normalized)
        except (AttributeError, TypeError, ValueError):
            return normalized


def create_runtime_embedding_backend(settings: Settings) -> EmbeddingBackend:
    cache_home = os.path.join(settings.cache_dir, "huggingface")
    os.environ.setdefault("HF_HOME", cache_home)
    os.environ.setdefault("TRANSFORMERS_CACHE", cache_home)
    return SentenceTransformerEmbeddingBackend(settings.model_name)


class LazyInitCountingBackend(SentenceTransformerEmbeddingBackend):
    def __init__(self, delay_seconds: float = 0.0):
        super().__init__("lazy-init-counting-test")
        self.delay_seconds = delay_seconds
        self.init_count = 0
        self._counter_lock = threading.Lock()
        self._fallback = DeterministicEmbeddingBackend()

    def _load_model(self):
        with self._counter_lock:
            self.init_count += 1
        if self.delay_seconds:
            time.sleep(self.delay_seconds)
        return object()

    def embed(self, texts: Iterable[str]) -> List[List[float]]:
        self._ensure_model()
        return self._fallback.embed(texts)


class RecordingEmbeddingBackend(DeterministicEmbeddingBackend):
    def __init__(self):
        self.seen_text_batches: List[List[str]] = []

    def embed(self, texts: Iterable[str]) -> List[List[float]]:
        batch = list(texts)
        self.seen_text_batches.append(batch)
        return super().embed(batch)

    def flattened_seen_texts(self) -> List[str]:
        return [text for batch in self.seen_text_batches for text in batch]


class ShortEmbeddingBackend(DeterministicEmbeddingBackend):
    def embed(self, texts: Iterable[str]) -> List[List[float]]:
        vectors = super().embed(texts)
        return vectors[:-1]


class FailingEmbeddingBackend(EmbeddingBackend):
    model_name = "failing-test-embedding"

    def embed(self, texts: Iterable[str]) -> List[List[float]]:
        raise RuntimeError("embedding backend failed")
