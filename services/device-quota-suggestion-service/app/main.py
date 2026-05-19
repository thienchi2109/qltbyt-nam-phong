"""FastAPI entrypoint for the internal device quota suggestion service."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException

from app.embeddings import EmbeddingBackend, create_runtime_embedding_backend
from app.schemas import SuggestRequest
from app.service import SuggestionService
from app.settings import Settings, load_settings


def create_app(
    settings: Settings = None,
    embedding_backend: EmbeddingBackend = None,
) -> FastAPI:
    """Create the FastAPI application with runtime settings and backend wiring."""
    actual_settings = settings or load_settings()
    backend = embedding_backend or create_runtime_embedding_backend(actual_settings)
    suggestion_service = SuggestionService(
        embedding_backend=backend,
        settings=actual_settings,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        """Warm the suggestion service during application startup."""
        suggestion_service.warm()
        yield

    app = FastAPI(
        title="Device Quota Suggestion Service",
        lifespan=lifespan,
    )

    def require_internal_token(
        x_internal_token: str = Header(default=""),
    ) -> None:
        """Reject requests that do not carry the configured internal token."""
        if not x_internal_token:
            raise HTTPException(status_code=401, detail="Missing internal token")
        if not actual_settings.internal_token:
            raise HTTPException(status_code=503, detail="Internal token is not configured")
        if x_internal_token != actual_settings.internal_token:
            raise HTTPException(status_code=403, detail="Invalid internal token")

    @app.get("/healthz")
    def healthz() -> dict:
        """Return a basic process health response."""
        return {"status": "ok"}

    @app.get("/readyz")
    def readyz() -> dict:
        """Return whether the embedding backend is ready to serve suggestions."""
        return {"ready": suggestion_service.is_ready()}

    @app.post("/suggest", dependencies=[Depends(require_internal_token)])
    def suggest(payload: SuggestRequest) -> dict:
        """Return category suggestions for a validated request payload."""
        return suggestion_service.suggest(payload.model_dump())

    return app
