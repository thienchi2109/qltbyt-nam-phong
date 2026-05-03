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

---

# Round 2 — Re-review sau commit `eb963ab`

- Plan version reviewed: commit `eb963ab docs(plan): refine issue 366 auth observability tdd plan`
- Date: 2026-05-03

## Đã giải quyết từ Round 1
- **Emission channel matrix** (plan §21–32) + idempotency key note.
- **Grant `service_role` only**, revoke PUBLIC, không grant `authenticated` (§45).
- **Dedup password-change** test "no ghost `session_expired`" (§66).
- **BRIN + btree indexes** (§46–48); retention có path follow-up.
- **Sanitizer extraction step 0** sang `src/lib/log-sanitizer.ts` (§35).
- **`events.signIn` cho `login_success`**, `LoginForm.tsx` UX-only (§25, §32).
- **Config error → `login_failure + config_error`** (§59); `dia_ban` stale noted (§77).
- **`ip_address inet`, `user_agent text`** (§38); CHECK enum cho `source` + `reason_code` (§40–41).
- **DB sink down không vỡ auth** (§62); correlation fallback (§67–69).
- **`unknown` + narrow, no any** (§79).

## Gap mới / còn sót

### R2-1. `session_expired` không có identity để gọi signout-intent endpoint (quan trọng)
Plan nói "client intent + server-side write endpoint **before** `signOut()`" (§27). Vấn đề: `session_expired` phát hiện passive trong `AppLayoutShell.useEffect` khi `status === "unauthenticated"` — lúc đó cookie session có thể đã chết → client không còn auth để gọi endpoint. Hai đường:

- **A. Endpoint chấp nhận unauthenticated cho `session_expired`** → spoof vector (ai cũng POST log flood được).
- **B. Dùng NextAuth `events.signOut`** — fire server-side với `token` còn truy cập được ngay trước khi bị xoá; client chỉ cần `signOut({ callbackUrl: "/?reason=..." })` để truyền reason.

**Khuyến nghị B**: gộp `events.signIn` + `events.signOut` thành cặp đối xứng, bỏ custom endpoint. Idempotency tự nhiên nhờ NextAuth debounce. Nếu giữ A, cần rate-limit + không cho phép user-controlled `user_id` trong payload unauthenticated.

### R2-2. `source` enum bất đối xứng
§40: `authorize | jwt_callback | events_signin | signout_intent`. Nếu chọn ngả B ở R2-1 thì thêm `events_signout`. Nếu giữ A, bỏ `events_signin` cho đối xứng, hoặc document vì sao bất đối xứng.

### R2-3. Idempotency key chưa có cơ chế cụ thể
§31 nhắc idempotency cho signout-intent nhưng không nói sinh ở đâu, lưu ở đâu, scope thế nào:
- Client-generated `crypto.randomUUID()` per click? Server dedup bằng gì (unique constraint / TTL cache)?
- Nếu chọn B ở R2-1, mục này biến mất.

Chốt một câu trong plan.

### R2-4. Retention "follow-up issue before implementation completes" còn mơ hồ
§50: lock hơn → "quyết định tại GREEN; nếu defer, mở issue + link trong PR description **trước khi merge**." Nếu không, dễ trôi thành tech debt câm.

### R2-5. Thiếu RED test cho `login_success` emission
Step 2 (§56–59) chỉ cover failure cases. Thêm bullet: `events.signIn` handler emit `login_success` với `user_id`, `username` lowercased, không chứa password/token.

### R2-6. UX của forced signout sau đổi mật khẩu
§73: "immediate signout." User cần thấy toast "Đã đổi mật khẩu thành công" trước khi bị kick. Thêm AC: delay ~1.5–2s sau toast rồi `signOut()`, hoặc toast nằm trên trang `/?reason=forced_password_change` sau redirect.

### R2-7. Migration apply channel chưa nhắc
Repo rule (CLAUDE.md "Supabase CLI vs MCP"): agent phải dùng Supabase MCP `apply_migration`, không CLI. Thêm một dòng trong §88 assumptions để người thực thi không quên.

### R2-8. `metadata jsonb` không có key taxonomy
Free-form dễ drift. Soft-contract bằng cách liệt kê các key dự kiến: `attempt_count`, `failed_rpc_code`, `session_duration_ms`, `previous_don_vi`, `user_agent_family`. Không CHECK, chỉ document → tránh dump PII mới sau này.

## Rủi ro residual
- Ngả A (signout-intent endpoint): R2-1 + R2-3 là rủi ro thiết kế thật sự, phải decide trước RED.
- Ngả B (events.signOut): R2-2 + R2-3 biến mất; chỉ còn R2-1 ghi chú nhỏ + R2-4..R2-8 là polish.

## Recommendation
Chốt ngả A hay B → cập nhật §27 + §40. Các mục R2-4..R2-8 có thể gộp chung commit refine kế tiếp.
