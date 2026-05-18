from fastapi.testclient import TestClient

from app.embeddings import DeterministicEmbeddingBackend
from app.main import create_app
from app.settings import Settings


def build_client():
    app = create_app(
        settings=Settings(internal_token="test-token"),
        embedding_backend=DeterministicEmbeddingBackend(),
    )
    return TestClient(app)


def sample_payload():
    return {
        "requestId": "req-api",
        "facilityId": 17,
        "catalogSignature": "catalog-v1",
        "unassignedSignature": "unassigned-v1",
        "deviceNames": [
            {"name": "Monitor theo doi benh nhan", "deviceIds": [1, 2, 3]},
            {"name": "Bom tiem dien tu dong", "deviceIds": [4]},
        ],
        "categories": [
            {
                "id": 291,
                "code": "03.02.001",
                "name": "Monitor theo doi benh nhan",
                "classification": None,
            },
            {
                "id": 292,
                "code": "03.02.002",
                "name": "Bom tiem dien",
                "classification": "Dieu tri",
            },
        ],
        "options": {
            "topK": 2,
            "semanticWeight": 1.0,
            "lexicalWeight": 1.0,
            "minConfidence": 0.62,
            "minMargin": 0.04,
        },
    }


def test_health_and_readiness_endpoints_are_available():
    client = build_client()

    assert client.get("/healthz").json() == {"status": "ok"}

    ready = client.get("/readyz")
    assert ready.status_code == 200
    assert ready.json()["ready"] is True


def test_suggest_requires_internal_token():
    client = build_client()

    missing = client.post("/suggest", json=sample_payload())
    assert missing.status_code == 401

    wrong = client.post(
        "/suggest",
        json=sample_payload(),
        headers={"X-Internal-Token": "wrong-token"},
    )
    assert wrong.status_code == 403


def test_suggest_rejects_malformed_payload():
    client = build_client()

    response = client.post(
        "/suggest",
        json={"requestId": "req-bad"},
        headers={"X-Internal-Token": "test-token"},
    )

    assert response.status_code == 422


def test_suggest_returns_bounded_candidates_provider_cache_and_timing_metadata():
    client = build_client()

    response = client.post(
        "/suggest",
        json=sample_payload(),
        headers={"X-Internal-Token": "test-token"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["requestId"] == "req-api"
    assert body["provider"] == {
        "name": "vm-local",
        "version": "0.1.0",
        "model": "deterministic-test-embedding",
    }
    assert body["timings"]["totalMs"] >= 0
    assert body["cache"]["requestHit"] is False
    assert body["suggestions"][0]["deviceName"] == "Monitor theo doi benh nhan"
    assert body["suggestions"][0]["candidates"][0]["categoryId"] == 291
    assert body["suggestions"][0]["needsReview"] is False
    assert len(body["suggestions"][0]["candidates"]) <= 2
