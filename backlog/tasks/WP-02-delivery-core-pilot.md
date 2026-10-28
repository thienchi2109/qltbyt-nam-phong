# WP-02 — Pilot tách delivery core qua các port hiện có

- Status: Done — parent đã nghiệm thu; chỉ commit local, không push
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-01
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu backend error boundary trong `services/web-push/{types,client,worker,
worker_helpers}.go` và test tương ứng. Dựa trên assessment WP-01, tách đúng
coupling đã xác minh; giữ tên/package. Không thêm interface song song với
`Backend`/`Sender`; không sửa provider transport hoặc runtime composition.

## Acceptance criteria

- [x] Core điều phối qua port; HTTP/HMAC và Web Push transport ở adapter,
      dependency đi từ adapter tới contract/core.
- [x] Luồng một app vẫn giữ concurrency limit, timeout, cancellation,
      retry/backoff, xử lý 404/410 và report theo attempt token/revision.
- [x] Core không diễn giải role, `don_vi`, bảng SQL hoặc repair-request URL.
- [x] Test qua fake port bảo vệ hành vi thành công, lỗi provider, lỗi report
      và shutdown; không cần HTTP/DB để chạy test core.
- [x] So sánh trước/sau cho thấy contract QLTBYT, VAPID và dữ liệu không đổi;
      ghi rõ cách rollback pilot và review độc lập trước khi mở rộng.

## Xác minh

Chạy `go test ./...` từ `services/web-push`; bổ sung race check nếu thay đổi
chia sẻ trạng thái/concurrency. Không thay schema hoặc triển khai live.

## Plan đã duyệt (2026-10-28)

1. Characterize retry precedence, disabled polling và report/lease bằng test;
   baseline `85b990ec3496e2c03a8d43e0a4394b7d8f10c043` đã PASS Go suite.
2. Thêm một concrete `BackendError` core-owned, map tại HTTP Claim/Report,
   giữ `APIError` trong wrapped cause; worker chỉ đọc policy trung lập.
3. Fake-port tests bảo vệ policy không phụ thuộc HTTP; giữ nguyên ports,
   structs/JSON tags, provider fallback, HMAC/replay, VAPID và runtime.
4. Chạy focused/full/race Go, gofmt và docs Prettier; ghi contract/rollback,
   chờ review trước khi đóng task hoặc bắt đầu WP-03.

Reuse: giữ `Backend`/`Sender`, `fakeAPI`/`fakeSender` và scripted helpers.
CRG stale tại `4e308be7` không trả matching nodes; GitNexus stale tại `8859e3c3`
chỉ ra hai consumer trực tiếp `Run`/`reportWithRetry` với fuzzy edges. Đã đối
chiếu source bằng `rg` và đọc file; không có error contract phù hợp để tái dùng.

## Contract trước/sau và rollback

Trước pilot: worker đọc `APIError.Status`, `Code`, `RetryAfterSeconds` để chọn
retry/disabled/delay. Sau pilot: HTTP adapter map lỗi tại cả Claim/Report thành
`BackendError{Retryable,Disabled,RetryAfter,Err}`; worker chỉ đọc policy này.
`RetryAfter` là optional `*time.Duration`. `Unwrap` giữ nguyên cause/wrapped
`APIError`, `errors.Is`/`errors.As` và diagnostic text; success vẫn trả nil.
Đây là thay đổi Go error contract: caller cần dùng `errors.As`, không assert
trực tiếp `err.(*APIError)`.

Giữ nguyên wire v1/JSON tags/structs, HMAC/nonce/replay 409 retry đúng một lần,
validation/response limits, VAPID, concurrency 5, timeouts và cancellation.
API status 0/429/>=500 vẫn retryable kể cả malformed; malformed 2xx terminal.
Disabled chỉ được poll 60s sau retryability check, bỏ qua hint kể cả >60s;
poll thường và report dùng max(base,hint). Report tối đa 3 logical calls, base
1s/2s, bounded bởi earliest batch lease với server offset; không resend provider.
Provider status fallback vẫn nằm trong worker; không tuyên bố core đã hết mọi
HTTP/provider coupling. Send vẫn dùng server_time snapshot hiện tại.

Source giữ quyền sở hữu durable retry, attempt token/revision, outbox/recipient
rules và dữ liệu subscription. Provider acceptance không chứng minh display,
exactly-once hoặc at-least-once. Không sửa browser/DB/Next.js hoặc deploy.

Rollback local: revert commit WP-02 khi đã tạo để quay về contract tại WP-01
`85b990ec3496e2c03a8d43e0a4394b7d8f10c043`, chạy lại Go suite. Nếu được deploy
sau này, dừng binary pilot rồi chạy binary trước đó với cùng config/VAPID;
không cần rollback wire/schema/data và không chạy song song hai phiên bản.
Chưa thực hiện deploy/rollback live; mọi thao tác đó cần phê duyệt riêng.

## Evidence cục bộ (2026-10-28)

Baseline và characterization chạy GREEN trên production source chưa sửa;
không diễn giải refactor bảo toàn hành vi thành bug RED.

- Baseline `go test ./...`: PASS cả hai packages tại WP-01.
- Characterization `go test ./... -run
'Test(Worker(BackendPollingPolicy|ReportRetryPolicy|ReportRetryUsesEarliestLeaseAndServerOffset)|HTTPBackendRetryPolicy)$'
-count=1`: PASS trước mapping/consumer changes. API precedence sau đó được
  giữ tại HTTP table; fake worker fixtures chuyển sang policy trung lập.
- Behavioral RED: sau khi khai báo type để test compile, trước adapter mapping
  và worker consumer changes, chạy `go test ./... -run
'Test(Worker(BackendPollingPolicy|ReportRetryPolicy)|HTTPBackendRetryPolicy)$'
-count=1`: FAIL do hành vi, không phải missing-type compile. Excerpts:
  `retry error/delays = backend: invalid worker API response/[], want canceled/[5s]`;
  terminal report `3/[1s 2s], want original error/1/[]`;
  disabled poll `[5s], want canceled/[1m0s]`; HTTP `BackendError(nil)`.
  Source: context-mode `execute:shell`, intent `WP02 neutral policy behavioral
RED before adapter mapping and worker consumers`; failures tại
  `TestWorkerBackendPollingPolicy/retryable_overrides_invalid_cause`,
  `TestWorkerReportRetryPolicy/terminal` và `TestHTTPBackendRetryPolicy`.
- Focused GREEN: `go test ./... -run
'Test(BackendErrorPreservesWrappedDiagnostics|HTTPBackendRetryPolicy|Worker(BackendPollingPolicy|ReportRetryPolicy|ReportRetryUsesEarliestLeaseAndServerOffset|ReportsProviderFailuresWithoutResending|RetriesAcceptedReportWithoutCallingItDeliveredOrRead|RunStopsAfterCancellation))$'
-count=1`: PASS. Fake Backend/Sender tests không cần HTTP/DB; HTTP table
  kiểm tra cả Claim/Report, retry policy và wrapped diagnostics.
- `go test ./... -count=1`: PASS cả hai packages.
- `go test -race ./... -count=1`: PASS cả hai packages.
- `gofmt -l` trên 7 Go files thay đổi: PASS, không có file cần format.
- `node scripts/npm-run.js exec -- prettier --check
backlog/tasks/WP-02-delivery-core-pilot.md
backlog/tasks/web-push-hexagonal-index.md`: PASS.
- `git diff --check`: PASS.
- Review độc lập: parent spec review PASS; `post_implementation_reviewer`
  không có actionable findings, gồm cả test file mới chưa tracked. Parent
  chạy lại focused/full/race và `go vet ./...`: PASS. Parent đã nghiệm thu
  contract, assertions và phạm vi diff, gồm test mới; chỉ commit local, không push.

Evidence scope: local Go service only; không có disposable DB, staging/browser
hoặc live smoke. WP-02 đã nghiệm thu; chưa bắt đầu WP-03.
