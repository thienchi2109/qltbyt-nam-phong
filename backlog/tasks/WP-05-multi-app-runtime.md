# WP-05 — Runtime điều phối nhiều app và cô lập lỗi

- Status: To Do
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

- [ ] Runtime tạo worker với backend, credential và VAPID đúng app; không
      gửi hoặc report delivery về app khác dù local ID trùng nhau.
- [ ] Một app bị timeout, auth failure hoặc pause không chặn app còn lại;
      giới hạn concurrency/tải được xác định và kiểm chứng, không tạo goroutine
      hay hàng đợi tăng vô hạn.
- [ ] Readiness thể hiện rõ app bị suy giảm và trạng thái tổng hợp; metrics
      đủ phân biệt app, không báo healthy che lỗi app được cấu hình bắt buộc.
- [ ] Shutdown/cancellation dừng polling và xử lý delivery đang chạy theo
      contract; không xác nhận thành công khi chưa gửi/report thành công.
- [ ] Chế độ một app được giữ; health/metrics tiếp tục bind loopback, xử lý
      ràng buộc cổng hiện tại trong topology được chọn.

## Xác minh

Go integration tests với hai fake backend: một app lỗi/chậm trong khi app
còn lại hoàn tất delivery; chạy `go test -race ./...` ở module Web Push.
