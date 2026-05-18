import os

from app.embeddings import create_runtime_embedding_backend
from app.settings import Settings


def test_runtime_embedding_backend_consumes_cache_dir(monkeypatch):
    monkeypatch.delenv("HF_HOME", raising=False)
    monkeypatch.delenv("TRANSFORMERS_CACHE", raising=False)

    create_runtime_embedding_backend(
        Settings(
            internal_token="token",
            cache_dir="/tmp/dqss-cache",
        )
    )

    assert os.environ["HF_HOME"] == "/tmp/dqss-cache/huggingface"
    assert os.environ["TRANSFORMERS_CACHE"] == "/tmp/dqss-cache/huggingface"
