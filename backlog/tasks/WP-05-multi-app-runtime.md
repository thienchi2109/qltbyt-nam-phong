# WP-05 — Runtime điều phối nhiều app và cô lập lỗi

- Status: Done — local gates và hai trục review PASS; đã merge main local, chưa push
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-03, WP-04
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu composition/lifecycle nhiều app ở
`services/web-push/{runtime,metrics,worker}.go` và
`services/web-push/cmd/web-push/main.go`. Tái sử dụng worker/core, mở rộng
đúng seam cần thiết để chạy nhiều adapter trong một runtime.

## Acceptance criteria

- [x] Runtime tạo worker với backend, credential và VAPID đúng app; không
      gửi hoặc report delivery về app khác dù local ID trùng nhau.
- [x] Một app bị timeout, auth failure hoặc pause không chặn app còn lại;
      giới hạn concurrency/tải được xác định và kiểm chứng, không tạo goroutine
      hay hàng đợi tăng vô hạn.
- [x] Readiness thể hiện rõ app bị suy giảm và trạng thái tổng hợp; metrics
      đủ phân biệt app, không báo healthy che lỗi app được cấu hình bắt buộc.
- [x] Shutdown/cancellation dừng polling và xử lý delivery đang chạy theo
      contract; không xác nhận thành công khi chưa gửi/report thành công.
- [x] Chế độ một app được giữ; health/metrics tiếp tục bind loopback, xử lý
      ràng buộc cổng hiện tại trong topology được chọn.

## Xác minh

Go integration tests với hai fake backend: một app lỗi/chậm trong khi app
còn lại hoàn tất delivery; chạy `go test -race ./...` ở module Web Push.

## Implementation và bằng chứng local (2026-10-29)

- Commit `3a9ef09a`, base `d827d03b`; đã merge main local, chưa push.
  Branch `refactor/web-push-wp-05` vẫn được giữ lại.
- `WEB_PUSH_APPS_CONFIG_PATH` đọc JSON tin cậy 1–16 app, tối đa 1 MiB; default
  pause, strict field/type/duplicate/trailing checks, không fallback/merge env.
  Env cũ giữ nguyên mặc định và health/metrics một app.
- Tái sử dụng `NewAppBindings`, `Worker.Run`, health và counters; một worker/app,
  mỗi app 5 slot riêng, tối đa 80 provider call và 16 backend call đồng thời.
  Không shared queue, prefetch hay scheduler mới. Bound không áp dụng cho tổng
  lease cũ còn tồn tại trong durable source sau report lỗi.
- Một listener loopback 8080. JSON mode readiness tổng hợp và `/readyz/<AppID>`
  fail closed cho app paused/not-ready/stale/stopped; terminal worker không
  dừng app khác, cần restart để phục hồi. Metrics chỉ có AppID từ config hữu hạn.
- Cancellation giữ source lease reclaim và report snapshot; không background
  report/resend. Hai test RED đã tái hiện provider accepted counter sau cancel
  và report nil/ready=true sau cancel; guards chuyển GREEN. Thêm empty-claim
  cancellation check. `worker_send.go` là extraction nhỏ để worker dưới 350 dòng.
- TLS/HMAC integration chạy hai source có local IDs trùng, credential/VAPID
  riêng; send và report về đúng binding. Timeout HTTP thật 250 ms, auth và pause
  không chặn app tốt; full backlog không chặn app tốt hoàn tất nhiều batch.
- Capacity test cho cả 16 app đồng thời chiếm 5 slot/app, zero prefetch; cancel
  join đủ 80 send, zero false accepted/report. Readiness freshness boundary,
  mọi worker terminal, metric TYPE/sample uniqueness và strict config có tests.
- `go test ./... -count=1 -timeout=60s`: PASS.
- `go test -race ./... -count=1 -timeout=60s`: PASS.
- `go vet ./...`: PASS. Touched Go files đã `gofmt`.
- Điều phối viên tự review diff, xác minh extraction giữ nguyên send/lease ngoài
  guard cancellation, chạy lại full/race/vet, gofmt, whitespace và Markdown
  Prettier: PASS. Giữ startup VAPID error codes và metrics flush của env mode.
- Reviewer mới `gpt-6.1-sol/xhigh` review độc lập toàn bộ diff so với `d827d03b`
  theo contract/isolation/failure: spec PASS, quality PASS, không có actionable
  findings; tự chạy focused runtime/config/cancellation tests: PASS.

Chi tiết operator: [Cấu hình app](../../ops/web-push/app-configuration.vi.md).
Chưa push/deploy, smoke provider/browser/staging/live hoặc app thứ hai thật;
app fixture không thay thế WP-06. Chưa có process-level SIGTERM/port-collision
integration test; cancellation/join và loopback address được kiểm chứng ở Go
tests. Không sửa TS/SQL/dependency/VAPID live.
