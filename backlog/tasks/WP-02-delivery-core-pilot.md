# WP-02 — Pilot tách delivery core qua các port hiện có

- Status: To Do
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-01
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu slice điều phối delivery trong `services/web-push/{types,worker,
worker_helpers,provider}.go` và test tương ứng. Dựa trên assessment WP-01,
tách đúng coupling đã xác minh; giữ tên/package nếu đủ dùng. Không thêm
interface song song với `Backend`/`Sender` đang đáp ứng yêu cầu.

## Acceptance criteria

- [ ] Core điều phối qua port; HTTP/HMAC và Web Push transport ở adapter,
      dependency đi từ adapter tới contract/core.
- [ ] Luồng một app vẫn giữ concurrency limit, timeout, cancellation,
      retry/backoff, xử lý 404/410 và report theo attempt token/revision.
- [ ] Core không diễn giải role, `don_vi`, bảng SQL hoặc repair-request URL.
- [ ] Test qua fake port bảo vệ hành vi thành công, lỗi provider, lỗi report
      và shutdown; không cần HTTP/DB để chạy test core.
- [ ] So sánh trước/sau cho thấy contract QLTBYT, VAPID và dữ liệu không đổi;
      ghi rõ cách rollback pilot và review độc lập trước khi mở rộng.

## Xác minh

Chạy `go test ./...` từ `services/web-push`; bổ sung race check nếu thay đổi
chia sẻ trạng thái/concurrency. Không thay schema hoặc triển khai live.
