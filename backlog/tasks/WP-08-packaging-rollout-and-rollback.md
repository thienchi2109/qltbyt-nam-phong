# WP-08 — Đóng gói service chung, runbook rollout và rollback

- Status: To Do
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-07
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu packaging ở `services/web-push/Dockerfile`, config example và runbook
versioned được chọn sau khảo sát. Chuẩn bị artifact vận hành review được;
mọi thao tác deploy/cutover thực tế phải có phê duyệt riêng.

## Acceptance criteria

- [ ] Build artifact chạy được một/nhiều app theo topology đã chốt; config
      example chỉ có placeholder, hướng dẫn cấp/rotate credential và VAPID.
- [ ] Runbook nêu preflight, version/contract compatibility, consumer đang
      hoạt động, giới hạn tải, loopback health/metrics và tín hiệu theo từng app.
- [ ] Rehearsal trên môi trường cô lập kiểm chứng bắt đầu/dừng/chuyển lại,
      lease đang chạy, backlog và lỗi từng app; không suy diễn thành live PASS.
- [ ] Rollback giữ được subscription, consent và khả năng xử lý delivery;
      nếu có thay đổi dữ liệu/key phải có phương án khôi phục riêng đã review.
- [ ] Có checklist hậu triển khai và tiêu chí dừng/rollback đo được; trạng
      thái local, staging và live được ghi riêng theo exact artifact/commit.
- [ ] Chỉ đánh dấu Done sau phạm vi rollout được chốt và đã thực hiện;
      nếu chưa được phép deploy, ghi phần chuẩn bị hoàn tất và rollout pending,
      không coi backlog này là quyền deploy hay quyền ghi DB.

## Xác minh

Build/smoke image với fixture từ WP-06, kiểm tra cấu hình mẫu và rehearsal
rollback. SQL nếu phát sinh tuân thủ Database Quality Gate. Giữ production
credentials, cron, VAPID và DB nguyên trạng cho đến thao tác được phê duyệt.
