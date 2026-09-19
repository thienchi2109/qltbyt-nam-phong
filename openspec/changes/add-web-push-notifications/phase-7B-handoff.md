# Phase 7B - Handoff session persistence

## Behavior đã kiểm chứng

- Logout thường và session expiry giữ opted-in browser/PWA subscription cùng owner record; same-owner relogin/remount giữ delivery eligibility mà không cần enable lại.
- Khi chuyển A → B, persisted valid owner record của A được xử lý qua local discard/cleanup; B không revoke nhầm remote subscription của A.
- Cleanup probe thất bại là blocker nghiêm ngặt cho owner mới; preflight thường vẫn lenient. Disable và `forced_password_change` giữ cleanup/revoke behavior.

## Evidence và reuse decision

- Chi tiết RED → GREEN, validation counts/gates và giới hạn nằm trong [phase-7B-evidence.md](phase-7B-evidence.md).
- Reuse decision đã được kiểm tra bằng Code Review Graph/GitNexus exact relationships và `rg`: giữ ownership trong `browser-lifecycle.ts`, dùng lại record validation, discard, cleanup/revoke và probe contract; `session-provider.tsx` chỉ điều phối transition. Không tạo helper storage/revoke thứ hai.
- Graph semantic search không thấy câu mô tả nghiệp vụ vì chỉ index name/path/signature; artifact ghi rõ giới hạn này và không coi `0 node` là bằng chứng absence. GitNexus exact callers/impact và direct search là evidence chính.
- Graph không được rebuild trên runtime diff chưa commit; `readStoredBrowserSubscriptionOwnerIds` và `probeMatchingLocalBrowserSubscription` không có trong index (`0 node`) và được xác nhận bằng direct diff/`rg` cùng tests.

## Validation status

- Luna: `10` files, `76 PASS`; parent independent validation: `4` files, `27 PASS`.
- `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`, React Doctor `100/100` và `git diff --check` đều PASS.
- Không có real provider/logout E2E, full browser auth suite hoặc browser matrix; không ghi claim cho các lane này.

## Boundary cho lượt sau

- Đây là handoff tài liệu trên working tree tại HEAD `6049761ddd11457114601083e810c432f047bf05`; không có DB/live write, staging, deploy hoặc thay đổi tasks/design/contract trong artifact này.
- Không reopen historical worker handoff, canary `535`, hoặc DB `FAILED/INCOMPLETE` waiver.
- Parent review/commit là bước tiếp theo; không đánh dấu toàn bộ Phase 7B/Phase 8 hoàn tất từ evidence này.
