# Device Quota Suggestion Service

Internal VM service for Issue #495. It computes device-to-category suggestions with local Vietnamese embeddings and returns bounded candidates for the Next.js suggestion route.

Target VM deployment is tracked separately in #508. This service is intentionally isolated from the Next.js app:

- Python dependencies live only in this service directory.
- The service does not receive database credentials.
- The service does not write mappings.
- Browser clients must not call this service directly.
- VM deployment and container smoke testing are handled by a follow-up issue on the target VM.

## API

- `GET /healthz`: process liveness.
- `GET /readyz`: embedding backend readiness.
- `POST /suggest`: internal suggestion endpoint. Requires `X-Internal-Token`.

Request:

```json
{
  "requestId": "req-1",
  "facilityId": 17,
  "catalogSignature": "catalog-v1",
  "unassignedSignature": "unassigned-v1",
  "deviceNames": [
    { "name": "Monitor theo doi benh nhan", "deviceIds": [1, 2, 3] }
  ],
  "categories": [
    {
      "id": 291,
      "code": "03.02.001",
      "name": "Monitor theo doi benh nhan",
      "classification": null
    }
  ],
  "options": {
    "topK": 3,
    "semanticWeight": 1,
    "lexicalWeight": 1,
    "minConfidence": 0.62,
    "minMargin": 0.04
  }
}
```

Response includes `provider`, `timings`, `metrics`, `cache`, and `suggestions`. Each suggestion includes `needsReview`, `confidence`, and bounded candidate categories.

`timings` includes phase timings for validation, category embedding, device
embedding, ranking, response serialization, and total duration. Structured
`dqss.suggest` logs include the same phase timings plus request id, facility id,
provider/model, cache status, device/category counts, and sanitized failure
reason. Logs must not include raw device names, category names, tokens, or
Cloudflare Access secrets.

## Local Tests

Use a temporary virtual environment outside the repo:

```bash
python3 -m venv /tmp/dqss-venv
/tmp/dqss-venv/bin/python -m pip install -q fastapi==0.115.6 httpx==0.27.2 pydantic==2.10.6 pytest==8.3.5
cd services/device-quota-suggestion-service
PYTHONPATH=. /tmp/dqss-venv/bin/python -m pytest tests -q
```

Tests use deterministic fake embeddings. They do not download the model.

## Large-Payload Harness

The deterministic harness documents the unit-17 and synthetic high-risk shapes
without downloading the real model:

```bash
cd services/device-quota-suggestion-service
PYTHONPATH=. /tmp/dqss-venv/bin/python scripts/dqss_perf_harness.py --case unit17 --mode deterministic
PYTHONPATH=. /tmp/dqss-venv/bin/python scripts/dqss_perf_harness.py --case synthetic-2000 --mode deterministic
```

- `unit-17`: 504 unique names, 1940 devices, 291 categories.
- `synthetic-2000`: 2000 unique names, 2000 devices, 300 categories.

Each run prints JSON with total duration, phase timings, metrics, cache status,
suggestion count, and provider metadata.

Manual VM smoke against the real model should use the same payload shape and
record total duration plus DQSS phase timings from the JSON response and
structured service logs. Use environment-managed secrets only:

```bash
DQSS_URL=https://dqss-cvmems.cdclims.cloud
DQSS_INTERNAL_TOKEN=...
CF_ACCESS_CLIENT_ID=...
CF_ACCESS_CLIENT_SECRET=...
```

Do not re-enable production canary from this instrumentation issue. Canary
belongs to a later issue after timing evidence is captured and the VM path is
fast enough for the real facility-sized request.

## Target VM Container

Build and run this image only on the target VM or deploy host, not on the current Codex VM:

```bash
cd services/device-quota-suggestion-service
docker build -t device-quota-suggestion-service:0.1.0 .
docker run --rm -p 8080:8080 --env-file .env.example device-quota-suggestion-service:0.1.0
```

For real deployment, replace `.env.example` with Coolify-managed secrets. Do not commit filled `.env` files.

## Environment

| Variable | Purpose |
| --- | --- |
| `DQSS_INTERNAL_TOKEN` | Shared internal token required by `POST /suggest`. |
| `DQSS_PROVIDER_NAME` | Provider metadata, default `vm-local`. |
| `DQSS_PROVIDER_VERSION` | Provider metadata, default `0.1.0`. |
| `DQSS_MODEL_NAME` | Runtime embedding model, default `dangvantuan/vietnamese-embedding`. |
| `DQSS_CACHE_DIR` | Container cache path, default `/data/cache`. |

`DQSS_INTERNAL_TOKEN` is required at startup. The model extra pins
`numpy==1.26.4` to stay compatible with CPU-only hosts that can fail on newer
binary baselines.

## Scope Boundary

Issue #495 delivers repo code, tests, Docker artifact, and local static/test verification. The follow-up VM deploy issue should:

- SSH to the target VM.
- Build or deploy the container through Coolify.
- Configure secrets and network exposure.
- Smoke `/healthz`, `/readyz`, and `/suggest`.
- Record cold start, warm request, and cached request timings on the target VM.
