# Phase 6.4 Evidence

Ngày 2026-09-16. Commit local kiểm chứng: `f03fce28` (`fix(web-push): gate readiness and record worker outcomes`), trên nền `07b171dd`.

## Phạm vi

Chunk này chỉ triển khai Go/runtime, Docker build artifact và runbook Oracle tương lai:

- Worker nhận `Paused` và không claim/send khi paused; binary mặc định paused khi `WEB_PUSH_PAUSED` vắng mặt.
- Private `/healthz`, `/readyz` và bounded `/metrics`; health address mặc định và duy nhất hợp lệ là loopback port `8080`.
- VAPID private key chỉ được đọc từ `/run/secrets/web_push_vapid_private_key`; derived public key/fingerprint vẫn được kiểm tra lúc load và trước mỗi claim.
- Startup log chỉ ghi stable error code; metrics không có endpoint, payload, key, HMAC, phone hoặc backlog.
- Static non-root Docker image, Compose secret mount và runbook pause/rotation/resubscribe/rollback.

Không sửa SQL/live DB, provider thật, browser, Oracle hoặc production deploy. Main agent chỉ tick 6.4 sau review và gates bên dưới.

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

Các test GREEN bảo vệ pause parsing/fail-closed, no-claim, local readiness preflight khi paused, readiness sau claim/report khi dispatch bật và hạ xuống khi backend lỗi/shutdown, loopback binding, bounded metrics, outcome/latency recording và startup log redaction. Accepted vẫn chỉ là provider acceptance, không phải delivered/read. Existing VAPID tests bảo vệ artifact derivation/persistence semantics; không có nhánh regenerate khi restart.

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
- Khi paused, readiness bật sau local VAPID/config preflight và trả `200 paused` mà không claim; khi dispatch bật, readiness chỉ bật sau một claim/report cycle hợp lệ với backend. Cả hai trạng thái đều không phải bằng chứng subscription catalog, registration hoặc provider tương thích. Runbook yêu cầu remote read-only check riêng trước khi bật.
- Mock/unit tests không chứng minh Oracle/network/secret store thật.
- Main agent review hoàn tất ngày 2026-09-17; chỉ tick 6.4. Giữ 6.5 và mọi checkbox khác nguyên trạng.

## Follow-up review 2026-09-17

Review này xử lý đúng hai finding readiness/metrics trên nền `63372c2b` bằng một worktree cô lập; main working tree không bị reset.

RED, chạy từ `services/web-push/` sau khi thêm hai regression tests vào worktree baseline:

```text
go test -count=1 -run 'TestPausedWorkerPreflightMarksLocalReadinessWithoutClaim|TestMetricsDoNotReportRetryBeforeItOccurs' ./...
--- FAIL: TestPausedWorkerPreflightMarksLocalReadinessWithoutClaim
    paused /readyz = 503 "not_ready\n", want 200 paused
--- FAIL: TestMetricsDoNotReportRetryBeforeItOccurs
    metrics missing "web_push_deliveries_retried_total 0\n"; baseline reported retried_total 2
FAIL
```

GREEN sau khi chuyển local VAPID preflight trước nhánh paused, trả `200 paused` cho state đã preflight, và tách `retryable_total`/`backend_owned_total` khỏi `retried_total`:

```text
go test -count=1 -run 'TestPausedWorkerPreflightMarksLocalReadinessWithoutClaim|TestMetricsDoNotReportRetryBeforeItOccurs' ./...
ok   github.com/qltbyt-nam-phong/web-push
ok   github.com/qltbyt-nam-phong/web-push/cmd/web-push [no tests to run]
```

`transient` chỉ là retryable local outcome; `not_sent_lease_expired` chỉ ghi nhận backend-owned follow-up. Không có metric nào tuyên bố backend đã retry, cancel hoặc expiry schedule. Invalid VAPID/config vẫn chạy qua `checkReady` trước nhánh paused; shutdown vẫn hạ readiness.

Verification sau correction trong `services/web-push/`: `gofmt` check PASS, `go test -count=1 ./...` PASS, `go test -race ./...` PASS, `go vet ./...` PASS, `golangci-lint run ./...` PASS (0 issues) và `go build ./...` PASS.

Local image verification sau correction cũng PASS:

```text
docker build -f services/web-push/Dockerfile -t qltbyt-web-push:e400da83 services/web-push
docker image inspect: entrypoint=["/usr/local/bin/web-push"] user="65532:65532" image_id=sha256:2d15979384b9e965a5a561dcf33b0fd390f4354c31d53d068e33be1fb7891ac4
```

Đây vẫn chỉ là local image build; không chạy container smoke hay image secrets audit thuộc 6.5.

## Main agent review và verification cuối — 2026-09-17

Reviewed HEAD `c66c387ded743929d2c95445ee3ae09c10f1fdce`, runtime correction `e400da839c618581f522be349fd8eddffa28668b`. Main agent trực tiếp review logic, cấu trúc, tests, Docker/Compose, runbook và compliance với contract; không còn finding chặn trong phạm vi 6.4. Finding ban đầu nói metrics chưa được nối vào worker là sai: `w.metrics.Record` đã tồn tại; follow-up bổ sung coverage nhánh lỗi và sửa semantics retry.

Kiểm chứng độc lập:

- Go tests `-count=1`, race `-count=1`, vet, gofmt, golangci-lint (0 issues), build: PASS.
- Repo typecheck: PASS. No-explicit-any/dedupe và React Doctor diff-only: SKIP vì không đổi JS/TS/React.
- Focused Vitest worker-routes + wire: 11 PASS; phase4-worker integration: 1 SKIP vì không cấu hình disposable database; không coi là bằng chứng DB integration.
- Repo format gate: SKIP trên clean main; explicit Prettier check trên Compose/runbook/evidence/handoff: PASS. Git diff check và OpenSpec strict validation: PASS.
- Compose config với placeholder: PASS. Local image `qltbyt-web-push:e400da83` có entrypoint `/usr/local/bin/web-push`, UID/GID `65532:65532`; SHA ở trên là image ID, `RepoDigests=[]`, chưa có registry digest/publish.

Giới hạn: counters chỉ phản ánh local outcomes; wire hiện tại không cung cấp số retry thực tế backend. Paused readiness chỉ xác nhận local preflight, không xác nhận remote/provider. Chưa chạy 6.5 container smoke/image secrets audit, live DB, provider thật hoặc deploy. Không push; maintainer quyết định bước tiếp theo.
