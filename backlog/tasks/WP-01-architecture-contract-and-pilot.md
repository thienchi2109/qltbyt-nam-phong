# WP-01 — Chốt boundary, contract và pilot Hexagonal cho Web Push

- Status: To Do
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: None
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi

Đối chiếu khảo sát với source hiện tại và nguyên tắc trong
`/root/docs/hexagonal-architect.md`. Ghi assessment/contract versioned về
dependency direction, port/adapter tái sử dụng, coupling thực tế, ownership
nghiệp vụ và pilot nhỏ giữ tương thích. Định hướng giữ queue/quyền tại app,
service dùng chung phần delivery; không mặc định tạo API/store trung tâm.

## Điểm chạm cần khảo sát

- `services/web-push/{types,worker,worker_helpers,client,provider,runtime}.go`
- `services/web-push/cmd/web-push/main.go`
- `src/lib/web-push/` và `src/app/api/web-push/`
- Các migration Web Push và `repair_request_create` đang có hiệu lực.

## Acceptance criteria

- [ ] Assessment chỉ rõ coupling có bằng chứng file/symbol; giữ các thiết kế
      đã hợp lý, nhất là `Backend` và `Sender`.
- [ ] Contract định nghĩa delivery, claim/lease/report, retry, revision,
      attempt token, payload, app context, VAPID selection và lỗi.
- [ ] Phân định core không phụ thuộc NextAuth, schema QLTBYT hay HTTP DTO;
      app vẫn quyết định recipient và kiểm tra quyền trước khi giao.
- [ ] Chọn pilot WP-02, ghi lợi ích, chi phí, test strategy và rollback;
      phân biệt phần giữ nguyên với thay đổi contract có chủ đích.
- [ ] Chốt đường tích hợp app thứ hai và phạm vi runtime dùng chung; ghi rõ
      API publish/store trung tâm nằm ngoài scope hiện tại.
- [ ] Tài liệu versioned chứa đủ nguyên tắc áp dụng từ reference ngoài repo;
      boundary và contract được review trước khi triển khai WP-02.

## Xác minh

Review tài liệu với luồng claim → send → report và register → revoke hiện có.
Task này chỉ khảo sát/tài liệu; không sửa runtime, SQL hoặc live.
