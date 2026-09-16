# Phase 6.4 Evidence

Ngày 2026-09-16. Commit local kiểm chứng: `f03fce28` (`fix(web-push): gate readiness and record worker outcomes`), trên nền `07b171dd`.

## Phạm vi

Chunk này chỉ triển khai Go/runtime, Docker build artifact và runbook Oracle tương lai:

- Worker nhận `Paused` và không claim/send khi paused; binary mặc định paused khi `WEB_PUSH_PAUSED` vắng mặt.
- Private `/healthz`, `/readyz` và bounded `/metrics`; health address mặc định và duy nhất hợp lệ là loopback port `8080`.
- VAPID private key chỉ được đọc từ `/run/secrets/web_push_vapid_private_key`; derived public key/fingerprint vẫn được kiểm tra lúc load và trước mỗi claim.
- Startup log chỉ ghi stable error code; metrics không có endpoint, payload, key, HMAC, phone hoặc backlog.
- Static non-root Docker image, Compose secret mount và runbook pause/rotation/resubscribe/rollback.

Không sửa `tasks.md`, SQL/live DB, provider thật, browser, Oracle hoặc production deploy.

## TDD RED -> GREEN

RED được chạy trước runtime edit bổ sung, từ đúng module:

```text
cd services/web-push && go test ./...
--- FAIL: TestWorkerDefaultDispatchIsPaused
    runtime_test.go:31: RunOnce() error = <nil>, claim calls = 1; want paused without claim
FAIL
```

Vòng RED của lần review này cũng chạy trước sửa metrics/readiness:

```text
cd services/web-push && go test -count=1 -run 'TestWorkerRecordsFailedMetricForInvalidDelivery|TestHealthStateStartsFailClosedUntilRuntimeMarksReady' ./...
--- FAIL: TestHealthStateStartsFailClosedUntilRuntimeMarksReady
    runtime_test.go:106: initial /readyz = 200 "ready\n", want 503 not_ready
--- FAIL: TestWorkerRecordsFailedMetricForInvalidDelivery
    worker_test.go:129: metrics snapshot = {accepted:0 failed:0 retried:0 cancelled:0 expired:0 latencyCount:0 latencySeconds:0}, want one failed delivery with latency
FAIL
```

Sau khi thêm runtime implementation, cùng lệnh chạy PASS:

```text
cd services/web-push && go test ./...
ok   github.com/qltbyt-nam-phong/web-push
ok   github.com/qltbyt-nam-phong/web-push/cmd/web-push
```

Vòng GREEN của lần review:

```text
cd services/web-push && go test -count=1 -run 'TestWorkerRecordsFailedMetricForInvalidDelivery|TestHealthStateStartsFailClosedUntilRuntimeMarksReady' ./...
ok   github.com/qltbyt-nam-phong/web-push
ok   github.com/qltbyt-nam-phong/web-push/cmd/web-push [no tests to run]
```

Các test GREEN bảo vệ pause parsing/fail-closed, no-claim, readiness chỉ bật sau claim/report backend thành công và hạ xuống khi backend lỗi/shutdown, loopback binding, bounded metrics, outcome/latency recording và startup log redaction. Accepted vẫn chỉ là provider acceptance, không phải delivered/read. Existing VAPID tests bảo vệ artifact derivation/persistence semantics; không có nhánh regenerate khi restart.

## Verification

Từ `services/web-push/`:

- `gofmt` check: PASS.
- `go test -count=1 ./...`: PASS.
- `go test -race ./...`: PASS.
- `go vet ./...`: PASS.
- `golangci-lint run ./...`: PASS, 0 issues.

Local image build được phép trong Chunk 6.4 và đã chạy:

```text
docker build -f services/web-push/Dockerfile -t qltbyt-web-push:f03fce28 services/web-push
```

`docker image inspect` xác nhận entrypoint `/usr/local/bin/web-push` và user `65532:65532`.

Compose syntax với placeholder không chứa secret cũng PASS:

```text
WEB_PUSH_IMAGE=qltbyt-web-push:f03fce28 WEB_PUSH_ORIGIN=https://example.invalid WEB_PUSH_VAPID_KEY_VERSION=staging-test WEB_PUSH_VAPID_PUBLIC_KEY=public-placeholder WEB_PUSH_VAPID_FINGERPRINT=fingerprint-placeholder WEB_PUSH_VAPID_PRIVATE_KEY_FILE=/tmp/placeholder WEB_PUSH_VAPID_SUBJECT=mailto:test@example.invalid WEB_PUSH_HMAC_KEY_ID=key-placeholder WEB_PUSH_HMAC_SECRET=secret-placeholder docker compose -f ops/web-push/docker-compose.yml config --quiet
```

## Giới hạn và review gate

- Đây là local image build, chưa chạy container smoke, chưa audit filesystem/image layers/secrets và chưa provider send; các việc đó thuộc 6.5.
- Readiness chỉ bật sau local VAPID/config validation và một claim/report cycle hợp lệ với backend; đây không phải bằng chứng subscription catalog, registration hoặc provider tương thích. Runbook yêu cầu remote read-only check riêng trước khi bật.
- Mock/unit tests không chứng minh Oracle/network/secret store thật.
- Main agent review đang pending; không tick 6.4 hoặc 6.5 trong `tasks.md` từ evidence này.
