# Chunk 5.1 - Evidence và handoff

Ngày: 2026-09-14. Base: `b0b84a0e7c871b238480db322310fa65a4403af2`.

Chỉ frontend: route authenticated `/notifications`, link từ dialog chuông, picker theo role/đơn vị. Nhãn hiển thị: Người nhận thông báo. TanStack Query quản lý config/candidate pages/mutation; draft tách khỏi server cache, scope gồm caller và target. Protected identities được giữ trong UI nhưng không serialize vào normal usernames; `self_action=none`.

## Kiểm chứng

- TDD dựng lại: 16 tests ban đầu có 6 behavioral failures (selector thiếu, full-config identities thiếu, reload thiếu, Save overwrite, feedback lỗi thiếu); sau sửa đạt 16/16.
- Sau review, bổ sung regression protected serialization: focused suite cuối 3 files / 45 tests PASS.
- Format, no-explicit-any, diff-only dedupe, typecheck PASS. React Doctor quét đủ 8 files: 93/100, một cảnh báo complexity ở RecipientEditor.
- Review độc lập tìm một Important về protected serialization; đã sửa và thêm regression. Finding status/remove stale được triage thuộc Chunk 5.2, không đưa vào 5.1.
- Tái sử dụng AuthenticatedPageBoundary, TenantSelector/TenantSelectionContext, RBAC và test QueryClient wrapper. API browser riêng đã landed được tiêu thụ qua fetch trong queryFn, không thêm RPC.
- Không chạy browser authenticated theo chỉ thị maintainer; evidence là DOM/user-event, không tuyên bố browser/platform PASS. Không chạy DB Gate/Phase 4.5 hoặc sửa backend/API/RPC/SQL.

## Điểm dừng

Chỉ tick 5.1; 5.2–5.5 chưa triển khai. Status/quyền remove stale và protected self-edit thuộc 5.2. Không có production send/deploy/live write.
