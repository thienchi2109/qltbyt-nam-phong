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
    actual_settings = settings or load_settings()
    backend = embedding_backend or create_runtime_embedding_backend(
        actual_settings.model_name
    )
    suggestion_service = SuggestionService(
        embedding_backend=backend,
        settings=actual_settings,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        suggestion_service.warm()
        yield

    app = FastAPI(
        title="Device Quota Suggestion Service",
        lifespan=lifespan,
    )

    def require_internal_token(
        x_internal_token: str = Header(default=""),
    ) -> None:
        if not x_internal_token:
            raise HTTPException(status_code=401, detail="Missing internal token")
        if not actual_settings.internal_token:
            raise HTTPException(status_code=503, detail="Internal token is not configured")
        if x_internal_token != actual_settings.internal_token:
            raise HTTPException(status_code=403, detail="Invalid internal token")

    @app.get("/healthz")
    def healthz() -> dict:
        return {"status": "ok"}

    @app.get("/readyz")
    def readyz() -> dict:
        return {"ready": suggestion_service.is_ready()}

    @app.post("/suggest", dependencies=[Depends(require_internal_token)])
    def suggest(payload: SuggestRequest) -> dict:
        return suggestion_service.suggest(payload.model_dump())

    return app


app = create_app()
