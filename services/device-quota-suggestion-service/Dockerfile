FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DQSS_CACHE_DIR=/data/cache \
    HF_HOME=/data/cache/huggingface \
    TRANSFORMERS_CACHE=/data/cache/huggingface

WORKDIR /app

RUN addgroup --system app && \
    adduser --system --ingroup app --home /app app && \
    mkdir -p /data/cache && \
    chown -R app:app /app /data/cache

COPY pyproject.toml ./
COPY app ./app

RUN pip install --upgrade pip && \
    pip install ".[model]"

USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
  CMD python -c "import json, urllib.request; data=json.load(urllib.request.urlopen('http://127.0.0.1:8080/readyz', timeout=5)); raise SystemExit(0 if data.get('ready') is True else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
