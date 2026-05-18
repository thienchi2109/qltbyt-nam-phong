import os

from app.embeddings import create_runtime_embedding_backend
from app.settings import Settings


def test_runtime_embedding_backend_consumes_cache_dir(monkeypatch, tmp_path):
    monkeypatch.delenv("HF_HOME", raising=False)
    monkeypatch.delenv("TRANSFORMERS_CACHE", raising=False)
    cache_dir = tmp_path / "dqss-cache"

    create_runtime_embedding_backend(
        Settings(
            internal_token="token",
            cache_dir=str(cache_dir),
        )
    )

    assert os.environ["HF_HOME"] == str(cache_dir / "huggingface")
    assert os.environ["TRANSFORMERS_CACHE"] == str(cache_dir / "huggingface")
