# Review — Issue #366 Auth Lifecycle Observability TDD Plan

- Plan reviewed: `docs/plans/20260503-issue-366-auth-lifecycle-observability-tdd-plan.md`
- Reviewer context: Devin, 2026-05-03
- Scope: gap analysis + risk surfacing before RED step. Does not modify the plan.

## Điểm tốt đã bắt đúng
- Taxonomy 7 event + 3 signout reason cover hầu hết lifecycle trong issue.
- Tách bảng riêng `auth_audit_log` khỏi `audit_logs` v2 là đúng (khác retention, khác PII policy).
- Tái sử dụng sanitizer của RPC proxy (`src/app/api/rpc/[fn]/route.ts` lines 29–56) cho redaction.
- Fail-safe DB insert, không break auth flow — đồng nhất với pattern `emitAuthJwtTelemetry` hiện tại (`src/auth/telemetry.ts`).
- TDD order đúng convention repo: `verify:no-explicit-any` → `typecheck` → focused tests → react-doctor.

## Gap / rủi ro cần xử lý trước khi qua RED

### 1. Thiếu "emission channel matrix" — event nào bắn từ đâu
Plan chưa quy định rõ mỗi event được emit ở server hay client. Đây là input để quyết grant và dedup.

| Event | Context hiện tại | Caller DB sink đề xuất |
|---|---|---|
| `login_success` / `login_failure` / `tenant_inactive` | `authorize()` server, chưa có user JWT | service_role client |
| `token_invalidated_password_change` / `profile_refresh_failed` | `jwt` callback server | service_role client |
| `signout` (user menu) | Client `AppLayoutShell` → `signOut()` | NextAuth `events.signOut` (server) |
| `forced_signout` (session_expired) | Client effect khi `status === "unauthenticated"` | NextAuth `events.signOut` (server) |
| `forced_signout` (forced_password_change) | Client `change-password-dialog` | NextAuth `events.signOut` (server) |

**Đề xuất:** dùng NextAuth built-in `events.signIn` / `events.signOut` trong `authOptions` thay vì wire từ `LoginForm.tsx` + `AppLayoutShell.tsx`. Lý do:
- `events.signIn` chỉ fire khi `authorize` thành công → không miss case "login OK nhưng client navigation lỗi".
- Chạy server-side, không bị user tamper.
- Deduplicate tự nhiên: 1 `signIn` ↔ 1 log line.
- Client chỉ gửi "reason hint" (query param trong `callbackUrl` hoặc short-lived cookie) để server phân biệt trong `events.signOut`.

### 2. Grant cho `auth_audit_log_insert` đang có lỗ hổng spoofing
Plan ghi *"Grants: authenticated, service_role; revoke PUBLIC"*.  
Nếu grant `authenticated`, mọi user đã đăng nhập có thể insert hàng audit giả qua PostgREST, spoof event login của user khác. `SECURITY DEFINER` không đủ nếu không ép check `request.jwt.claims.user_id = input.user_id`.

**Đề xuất:**
- Grant **chỉ** `service_role`. Tất cả event gọi từ Next server dùng service-role client (cùng kiểu `authorize` đang dùng ở `src/auth/config.ts:102`).
- Không event nào cần client gọi DB sink trực tiếp; client signout đi qua `events.signOut`.

### 3. Double-log risk trong flow đổi mật khẩu
Flow sau khi áp plan:
1. Change-password success → emit `forced_signout/forced_password_change` (client).
2. → `signOut()` → NextAuth xóa session.
3. → `AppLayoutShell` thấy `status === "unauthenticated"` → có thể emit `forced_signout/session_expired` (❌ dup + sai reason).
4. Đồng thời `jwt` callback lần cuối có thể trigger `jwt_token_invalidated_password_change` (đã có sẵn).

Plan nhắc "no double-log on single exit path" nhưng chưa chỉ cơ chế.

**Đề xuất chốt một trong các cách:**
- Truyền reason qua `signOut({ callbackUrl: "/?auth=forced_password_change" })`; `events.signOut` đọc query → emit đúng reason; `AppLayoutShell` không tự emit.
- Hoặc short-lived cookie `auth_signout_reason` set trước `signOut()`.
- Lock behavior bằng test case (3 event, không dup) trong RED step 5.

### 4. Thiếu index / retention trên bảng mới
Repo có pattern sẵn:
- `supabase/migrations/20260204_audit_logs_brin_index.sql`
- `supabase/migrations/20260204_audit_logs_retention_secure.sql`
- `supabase/migrations/20260204_audit_cleanup_log.sql`

Plan schema thiếu:
- BRIN index trên `created_at`.
- btree index `(user_id, created_at desc)` và `(event, created_at desc)` cho forensic query.
- Retention policy (180–365d cho yêu cầu audit bệnh viện) — cùng migration hoặc follow-up.

### 5. Sanitizer không import được cross-layer
`sanitizeForLog` đang nằm trong `src/app/api/rpc/[fn]/route.ts`. Auth code `src/auth/config.ts` không nên import từ route handler. Plan nói "reuse shared sanitizer" nhưng chưa chỉ nơi ở mới.

**Đề xuất:** refactor thành `src/lib/log-sanitizer.ts`; route.ts và audit-logger cùng import. Commit tách riêng, làm như bước 0 trước RED.

### 6. Coverage so với bảng 9 event trong issue
Plan map được 7, còn hai dòng cần ghi chú rõ:
- **"Supabase env not configured"** (`config.ts:104`): hiện log `console.error`. Map vào `login_failure` với `reason_code: "config_error"` — OK nhưng cần ghi rõ.
- **"dia_ban lookup failure"** (issue nhắc `config.ts:129/145`): code hiện tại không còn path này sau refactor JWT callback (`src/auth/config.ts:229-285`). Nên note trong plan "issue stale on this item; skip".

### 7. Schema cần cân nhắc thêm
- `ip_address INET NULL`, `user_agent TEXT NULL` (truncate ~512): phục vụ đúng acceptance criteria "investigate brute-force / credential stuffing" trong issue. Plan đang thiếu → không đạt ý định nguyên gốc.
- `source TEXT NOT NULL` nên có CHECK constraint với enum đóng, ví dụ `('authorize','jwt_callback','events_signin','events_signout','change_password','app_layout')`.
- `reason_code` nên có CHECK với taxonomy đóng: `('invalid_credentials','rpc_error','tenant_inactive','authorize_exception','config_error')`.
- `tenant_id TEXT` (plan chọn) vs `BIGINT` (`don_vi.id` là bigint): dùng text để mềm cho `regional_leader` multi-tenant context là OK, nhưng nên ghi justification.

### 8. TDD — bổ sung test cases quan trọng
- **DB sink down**: mock insert throw → stdout log vẫn ra đủ, auth flow không fail (guard theo pattern try/catch của `emitAuthJwtTelemetry`).
- **Correlation id fallback**: request có `x-request-id` → event gắn đúng; không có → `request_id = null`. Lock bằng test.
- **Redaction sâu**: payload chứa `password`, `token`, `mat_khau` (bao gồm nested) → JSON output không còn — giống assertion hiện có ở `src/auth/__tests__/auth-config.jwt-cooldown.test.ts:325-327`.
- **Dedup signout**: một lần change-password success chỉ tạo đúng 1 `forced_signout/forced_password_change` + 1 `jwt_token_invalidated_password_change`; không có `session_expired` ghost.
- **`events.signIn` emission**: assert `login_success` phát ra từ server event, không phụ thuộc client route.

### 9. Nhỏ nhưng nên chốt
- Migration name: theo pattern mới nhất `YYYYMMDDHHMMSS_auth_audit_log_init.sql`.
- `verify:no-explicit-any`: cấm `any` trong logger types — dùng `unknown` + narrow giống `emitAuthJwtTelemetry`.
- `events.signIn` sẽ fire cho mọi provider (future magic link / OAuth) → quyết định trước: type-guard chỉ log credentials, hay log generic.
- Nếu chọn channel qua NextAuth events, có thể bỏ `LoginForm.tsx` khỏi scope plan.

## Checklist acceptance criteria (từ issue)
- [x] Every auth-lifecycle event sinh 1 dòng structured log — plan đã cover.
- [x] No PII / secrets leak, assert bằng test — plan đã cover.
- [x] Optional: persistent critical events vào bảng — plan đã cover.
- [x] Update `scripts/test_session_management.md` — plan đã cover.
- [ ] `ip_address` / `user_agent` để investigate brute-force — **plan thiếu**, nên thêm.

## Summary
Plan chắc về khung TDD và tách bảng, nhưng cần bổ sung: emission channel matrix, siết grant chỉ `service_role`, dedup reason signout, index + retention, refactor sanitizer thành `src/lib/log-sanitizer.ts`, và dời `login_success/signout` sang NextAuth `events.*` để bỏ client wiring. Nếu giải quyết 5 gap ở mục 1–5 trước khi viết test, RED step sẽ ổn định và không phải sửa ngược schema ở GREEN.
