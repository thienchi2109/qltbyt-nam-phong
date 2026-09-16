# Phase 6.4 Evidence

Ngày 2026-09-16. Base trước local landing: `df26807704e698b487b746dbe0a0e3db47c98446`.

## Phạm vi

Chunk này chỉ triển khai Go/runtime, Docker build artifact và runbook Oracle tương lai:

- Worker nhận `Paused` và không claim/send khi paused; binary mặc định paused khi `WEB_PUSH_PAUSED` vắng mặt.
- Private `/healthz`, `/readyz` và bounded `/metrics`; health address mặc định và duy nhất hợp lệ là loopback port `8080`.
- VAPID private key chỉ được đọc từ `/run/secrets/web_push_vapid_private_key`; derived public key/fingerprint vẫn được kiểm tra lúc load và trước mỗi claim.
- Startup log chỉ ghi stable error code; metrics không có endpoint, payload, key, HMAC, phone hoặc backlog.
- Static non-root Docker image, Compose secret mount và runbook pause/rotation/resubscribe/rollback.

Không sửa `tasks.md`, SQL/live DB, provider thật, browser, Oracle hoặc production deploy.

## TDD RED -> GREEN

RED được chạy trước runtime edit, từ đúng module:

```text
cd services/web-push && go test ./...
--- FAIL: TestWorkerDefaultDispatchIsPaused
    runtime_test.go:31: RunOnce() error = <nil>, claim calls = 1; want paused without claim
FAIL
```

Sau khi thêm runtime implementation, cùng lệnh chạy PASS:

```text
cd services/web-push && go test ./...
ok   github.com/qltbyt-nam-phong/web-push
ok   github.com/qltbyt-nam-phong/web-push/cmd/web-push
```

Các test GREEN bảo vệ pause parsing/fail-closed, no-claim, loopback binding, health/readiness state, bounded metrics và startup log redaction. Existing VAPID tests bảo vệ artifact derivation/persistence semantics; không có nhánh regenerate khi restart.

## Verification

Từ `services/web-push/`:

- `gofmt` check: PASS.
- `go test -count=1 ./...`: PASS.
- `go test -race ./...`: PASS.
- `go vet ./...`: PASS.
- `golangci-lint run ./...`: PASS, 0 issues.

Local image build được phép trong Chunk 6.4 và đã chạy:

```text
docker build -f services/web-push/Dockerfile -t qltbyt-web-push:df26807704e698b487b746dbe0a0e3db47c98446 services/web-push
```

`docker image inspect` xác nhận entrypoint `/usr/local/bin/web-push` và user `65532:65532`.

Compose syntax với placeholder không chứa secret cũng PASS:

```text
docker compose -f ops/web-push/docker-compose.yml config --quiet
```

## Giới hạn và review gate

- Đây là local image build, chưa chạy container smoke, chưa audit filesystem/image layers/secrets và chưa provider send; các việc đó thuộc 6.5.
- Readiness local chỉ chứng minh private key và configured public artifact khớp; không phải bằng chứng remote QLTBYT controls, subscription catalog, registration hoặc provider tương thích. Runbook yêu cầu remote read-only check riêng trước khi bật.
- Mock/unit tests không chứng minh Oracle/network/secret store thật.
- Main agent review đang pending; không tick 6.4 hoặc 6.5 trong `tasks.md` từ evidence này.
