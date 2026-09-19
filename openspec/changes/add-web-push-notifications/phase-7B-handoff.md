# Phase 7B - Đối soát tích hợp

## Lịch sử: session persistence

### Behavior đã kiểm chứng

- Logout thường và session expiry giữ opted-in browser/PWA subscription cùng owner record; same-owner relogin/remount giữ delivery eligibility mà không cần enable lại.
- Khi chuyển A → B, persisted valid owner record của A được xử lý qua local discard/cleanup; B không revoke nhầm remote subscription của A.
- Cleanup probe thất bại là blocker nghiêm ngặt cho owner mới; preflight thường vẫn lenient. Disable và `forced_password_change` giữ cleanup/revoke behavior.

### Evidence và reuse decision

- Chi tiết RED → GREEN, validation counts/gates và giới hạn nằm trong [phase-7B-evidence.md](phase-7B-evidence.md).
- Reuse decision đã được kiểm tra bằng Code Review Graph/GitNexus exact relationships và `rg`: giữ ownership trong `browser-lifecycle.ts`, dùng lại record validation, discard, cleanup/revoke và probe contract; `session-provider.tsx` chỉ điều phối transition. Không tạo helper storage/revoke thứ hai.
- Graph semantic search không thấy câu mô tả nghiệp vụ vì chỉ index name/path/signature; artifact ghi rõ giới hạn này và không coi `0 node` là bằng chứng absence. GitNexus exact callers/impact và direct search là evidence chính.
- Graph không được rebuild trên runtime diff chưa commit; `readStoredBrowserSubscriptionOwnerIds` và `probeMatchingLocalBrowserSubscription` không có trong index (`0 node`) và được xác nhận bằng direct diff/`rg` cùng tests.

### Validation status

- Luna: `10` files, `76 PASS`; parent independent validation: `4` files, `27 PASS`.
- `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`, React Doctor `100/100` và `git diff --check` đều PASS.
- Không có real provider/logout E2E, full browser auth suite hoặc browser matrix; không ghi claim cho các lane này.

### Boundary cho lượt sau

- Đây là handoff tài liệu trên working tree tại HEAD `6049761ddd11457114601083e810c432f047bf05`; không có DB/live write, staging, deploy hoặc thay đổi tasks/design/contract trong artifact này.
- Không reopen historical worker handoff, canary `535`, hoặc DB `FAILED/INCOMPLETE` waiver.
- Parent review/commit là bước tiếp theo; không đánh dấu toàn bộ Phase 7B/Phase 8 hoàn tất từ evidence này.

## Cập nhật authoritative đối soát tích hợp ngày 2026-09-19

### Current state

- Basic Web Push hiện operational theo rollout live đã được authorize: 28 active
  units trong snapshot, flags bật và worker ready. Formal Phase 7 acceptance vẫn
  partial; Phase 8 checklist vẫn mở. Đây là hai trạng thái khác nhau.
- `6049761ddd11457114601083e810c432f047bf05` là subject historical của session
  evidence, không còn là trạng thái chờ commit. Session fix hiện landed ở
  `3bb87a015e843cc479ec9cecfc528feef530b4f0`; app/UX production source là
  `a653bb2033f41964634213c48177683d79f66cba`; Go worker image có lineage riêng,
  không được suy ra từ app SHA.
- Historical canary `535` accepted vẫn là evidence cũ; sau đó sample timing được
  authorize riêng là request `536`, accepted HTTP `201` ở attempt `1`. DB gate
  `FAILED/INCOMPLETE` vẫn giữ waiver, không được ghi thành `PASS`.

### Remaining decision frontier

- **Residual 7.1 boundary:** request `536` closes the maintainer-accepted
  checkbox with `4.028417s` terminal-minus-created and persisted `+86400s`
  deadline. Wire TTL, near-expiry/retry, max-24-hour behavior and separate
  claim/send timestamps remain unobserved; do not relabel those limits as `PASS`.
- **Planned tests:** 7.2 cần fault matrix bounded cho backend/Go/provider,
  partial delivery, credential failure, concurrent workers, expiry và
  revoke/session behavior.
- **ZBS decision:** 7.4 hiện `unknown`; chỉ khi có approval chunk tương lai mới
  chạy đối chiếu local/disposable về phone recipient, enqueue count, retry state
  với Web Push disabled. Nếu không lập kế hoạch test thì cần explicit waiver,
  không suy luận từ evidence hiện có.
- **Review decision:** 7.5 cần review retention và toàn bộ enable/pause/rollback
  blockers; 7.3 giữ checked theo waiver hiện có. Không tự tạo waiver cho 60
  seconds, fault injection, ZBS hoặc browser/provider E2E.

### Minimal next chunk

Giữ runtime hiện tại ở trạng thái operational và chỉ chuẩn bị một plan/evidence
matrix cho 7.2, 7.4 và 7.5. Nếu được giao chunk tiếp theo, bắt đầu bằng
local/disposable ZBS verification và fault evidence; không dùng live production
để tạo thêm acceptance traffic. Recipient config và user opt-in vẫn là điều kiện
cho event thật, còn future units giữ boundary ở [Issue #1003](https://github.com/thienchi2109/qltbyt-nam-phong/issues/1003).
