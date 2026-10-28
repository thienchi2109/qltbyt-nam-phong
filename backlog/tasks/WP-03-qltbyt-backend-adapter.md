# WP-03 — Đưa kết nối QLTBYT vào backend adapter

- Status: To Do
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-02
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu adapter từ `services/web-push/client.go`, wire mapping và test của nó.
Đối chiếu `src/lib/web-push/{wire,worker-auth}.ts`
và các route worker thực tế trước khi đổi; không mặc định sửa server/API.
Phối hợp WP-04 trước khi chạm wiring/config dùng chung.

## Acceptance criteria

- [ ] Adapter thực hiện claim/report và ánh xạ DTO sang contract core,
      không đưa HTTP/HMAC hay schema QLTBYT vào core.
- [ ] Bảo toàn ký HMAC trên đúng method/path/raw body, timestamp, nonce,
      key rotation, phiên bản wire và validation response hiện có.
- [ ] Report giữ lease/attempt token, revision và xử lý kết quả cũ; lỗi
      backend không bị biến thành trạng thái gửi thành công.
- [ ] Outbox tạo trong giao dịch nghiệp vụ và eligibility tại claim vẫn do
      QLTBYT sở hữu, gồm tenant, recipient config, revoked và password epoch.
- [ ] Contract tests chạy với backend giả lập có phản hồi hợp lệ/sai,
      auth failure và timeout; chế độ QLTBYT một app tiếp tục hoạt động.

## Xác minh

Chạy Go tests từ `services/web-push`; chạy test wire/auth liên quan nếu có
đổi contract. Áp dụng đủ JS/TS gates khi có thay đổi tương ứng. Không cần
SQL migration nếu adapter giữ nguyên contract hiện tại.
