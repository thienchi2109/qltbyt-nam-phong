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

---

# Round 3 — Re-review sau commit `2ce77b1`

- Plan version reviewed: commit `2ce77b1 docs(plan): apply round-2 review for issue 366`
- Date: 2026-05-03

## Đã giải quyết từ Round 2
- **R2-1**: chọn ngả B (NextAuth `events.signOut`); custom signout-intent endpoint bị loại (§27, §31–34).
- **R2-2**: `source` enum đối xứng `authorize | jwt_callback | events_signin | events_signout` (§43).
- **R2-3**: idempotency endpoint không còn cần (theo R2-1).
- **R2-4**: retention quyết tại GREEN, có path defer + link issue trước merge (§54–56).
- **R2-5**: bổ sung Step 3 RED cho `events.signIn`/`events.signOut` (§66–68).
- **R2-6**: UX delay/redirect cho password-change toast (§83).
- **R2-7**: migration apply via Supabase MCP (§101).
- **R2-8**: metadata soft taxonomy (§45).

## Gap mới do mechanism `session.update + events.signOut` introduce

### R3-1. Token invalidation clobbers `pending_signout_reason` (CRITICAL)
Sequence dự kiến cho forced password change:
1. Dialog gọi `session.update({ pending_signout_reason: 'forced_password_change' })`.
2. JWT callback fire với `trigger === 'update'`, force-refresh profile (`src/auth/config.ts:165, 195–203`).
3. Profile-refresh path detect `password_changed_at > loginTime` → return `{}` (`src/auth/config.ts:267–268`). **`pending_signout_reason` bị xoá sạch.**
4. `signOut()` → `events.signOut` đọc token rỗng → fallback `session_expired`. ❌

Test §75 "no ghost `session_expired`" sẽ fail. Phải xử lý:
- **Option 1:** giữ `pending_signout_reason` trong token bị invalidate: `return { pending_signout_reason: token.pending_signout_reason }` thay vì `{}`.
- **Option 2:** trong dialog, gọi `signOut()` luôn không qua `session.update`; truyền reason qua `signOut({ redirect: false })` rồi tự navigate `/?reason=forced_password_change` — nhưng `events.signOut` không đọc được callbackUrl.
- **Option 3:** dialog set một short-lived HttpOnly cookie `auth_signout_reason` qua một route nhỏ trước khi `signOut()`; `events.signOut` đọc cookie qua `cookies()` từ `next/headers`. Cần kiểm chứng cookies được expose trong events callback context.

Khuyến nghị Option 1 (đơn giản nhất, chỉ ~3 dòng code). Plan cần nói rõ.

### R3-2. Race giữa `session.update()` Promise và `signOut()`
`session.update()` resolve khi JWT callback hoàn tất + cookie flush. Nếu dialog code không `await` đầy đủ rồi gọi `signOut()` ngay, có race: token mới chưa kịp set cookie thì cookie bị `signOut` xoá.

Plan §82 chỉ nói "set `pending_signout_reason` via `session.update(...)` before `signOut()`." Lock tighter:
- Phải `await session.update(...)`.
- Recommend thêm bước verify (e.g. `await getSession()`) trước `signOut()`.
- RED test §75 nên mock `session.update` trả về Promise và assert `signOut` chỉ được gọi sau khi resolved.

### R3-3. Extra DB RPC + telemetry mỗi lần signout do `trigger='update'`
`session.update({ pending_signout_reason })` chạy qua jwt callback → force-refresh profile (1 extra RPC `get_session_profile_for_jwt`) + emit `jwt_refresh_forced_update_trigger`, dù chỉ inject một field UI-only. Cost = 1 RPC/signout, chấp nhận được nhưng:
- Plan nên ghi rõ trade-off này trong §29–35 (decision notes), tránh ngạc nhiên ở GREEN.
- Hoặc gate: trong jwt callback, nếu update payload **chỉ** chứa `pending_signout_reason`, skip profile refresh. Phức tạp hơn — chỉ làm nếu telemetry/RPC noise đủ lớn.

Khuyến nghị: ghi nhận chi phí, không tối ưu sớm.

### R3-4. `request_id` capture path trong NextAuth callbacks chưa rõ
§77–78 test correlation header. NextAuth v4 callbacks (`jwt`, `events.signIn`, `events.signOut`) không nhận `req` trực tiếp. Hai options:
- Đọc `headers().get('x-request-id')` từ `next/headers` trong logger helper. Phải verify hoạt động trong NextAuth callback context (nó chạy trong route handler stack).
- Generate UUID fallback trong logger nếu header context không khả dụng.

Plan cần chốt cách hiện thực + test verify. Hiện đang nói "fallback null" (§99) nhưng implementation path chưa cụ thể. Nếu thực tế header không reach được callback, mọi event sẽ luôn `request_id = null` và test §77 sẽ fail → blocker GREEN.

### R3-5. Cross-tab forced password change emit `session_expired`, không phải `forced_password_change`
Khi tab A đổi mật khẩu thành công và bị forced signout với `forced_password_change`, các tab B/C khác sẽ:
- Lần next request → jwt callback detect password_changed_at > loginTime → token invalidate.
- AppLayoutShell thấy `unauthenticated` → gọi `signOut()` (không qua dialog) → `events.signOut` không có `pending_signout_reason` → emit `forced_signout/session_expired`.

By design OK, nhưng forensic correlation phải dựa vào `token_invalidated_password_change` event (1 lần, từ jwt callback) + `password_changed_at` timestamp + chuỗi `session_expired` events trong window. Plan nên document hành vi này (1 dòng trong Decision notes) để reviewer/forensics biết model dữ liệu là đủ.

### R3-6. Thiếu RED test cho contract `session.update → events.signOut`
Đây là backbone của mechanism mới. Test phải khẳng định:
- `session.update({ pending_signout_reason: 'X' })` → token sau callback có `pending_signout_reason: 'X'`.
- `events.signOut` đọc đúng reason từ token và emit `signout|forced_signout` với reason map đúng.
- Token không mang reason → emit `session_expired`.

Step 3 (§66–68) chỉ test isolated, chưa cover propagation chain.

### R3-7. `events.signOut` trên probe unauthenticated
NextAuth fire `events.signOut` cả khi client gọi `/api/auth/signout` không có session hợp lệ. Tránh log flood:
- Test: probe call → 1 event `forced_signout/session_expired` với `user_id=null` (acceptable nhưng phải predictable).
- Hoặc skip emit khi token rỗng và không có session — quyết tùy quan điểm forensic.

Plan chưa đề cập, dễ rơi vào edge case khi GREEN.

### R3-8. Migration apply path: assumption hay constraint?
§101 đặt ở Assumptions. Theo CLAUDE.md ("Supabase CLI vs MCP MANDATORY"), đây là **constraint** cho agent, không phải assumption. Đổi tone hoặc move lên một mục `## Constraints` riêng để agent thực thi không skip.

## Mức độ ưu tiên
- **Phải fix trước RED**: R3-1 (lỗi bug thật trong logic), R3-4 (nếu sai approach thì test §77–78 không pass).
- **Nên lock cùng phase**: R3-2 (race), R3-6 (test backbone).
- **Document, không cần code**: R3-3, R3-5, R3-7, R3-8.

## Recommendation
Chỉ R3-1 và R3-4 là blocker thiết kế. Sửa hai dòng quyết định (token preservation + request_id capture method) là plan có thể đi RED. Còn lại bổ sung notes trong Decision notes hoặc Assumptions là đủ.

---

# Round 4 — Re-review sau commit `7c06b9f`

- Plan version reviewed: commit `7c06b9f docs(plan): apply round-3 review for issue 366`
- Date: 2026-05-03

## Đã giải quyết từ Round 3
- **R3-1**: preserve `pending_signout_reason` khi invalidate token (§34) + RED test §80.
- **R3-2**: strict `await session.update(...)` trước `signOut()` (§33) + RED test §89.
- **R3-3**: trade-off 1 RPC extra được ghi nhận (§38).
- **R3-4**: request_id capture path — `authorize(..., req)` cho login, `headers()` fallback null cho jwt/events (§40–42) + RED test §91–92.
- **R3-5**: cross-tab behavior documented, forensic correlation qua `token_invalidated_password_change` window (§39).
- **R3-6**: propagation chain test `session.update → events.signOut` — Step 6 §86–89.
- **R3-7**: probe guard: skip DB sink nếu neither identity nor pending reason (§36) + test §77.
- **R3-8**: migration apply upgraded lên Constraints (§111–112).

Plan đã stable. Các mục dưới đây là polish-level; không có blocker.

## Gap polish

### R4-1. Thiếu type augmentation cho `pending_signout_reason`
Repo có file `src/types/next-auth.d.ts` augment `JWT` interface:
```ts
declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT, Partial<NextAuthUserFields> {
    loginTime?: number
    lastRefreshAt?: number
  }
}
```
`session.update({ pending_signout_reason: 'X' })` + `events.signOut({ token })` đọc `token.pending_signout_reason` sẽ fail typecheck nếu không thêm field này. Developer sẽ bị cám dỗ `(token as any)` → `verify:no-explicit-any` chặn.

Plan cần thêm bullet vào Step 0 (§46) hoặc Step 8 GREEN:
> Augment `src/types/next-auth.d.ts` JWT/Session with `pending_signout_reason?: 'user_initiated' | 'forced_password_change'`.

### R4-2. IP / user-agent capture mechanism chưa được document
§49 có schema cột `ip_address inet`, `user_agent text`; §53 metadata taxonomy có `user_agent_family`. Nhưng Decision notes §40–42 chỉ cover `request_id`, không nói IP/UA lấy từ đâu.

Tương tự request_id:
- `authorize(credentials, req)`: đọc `req.headers['x-forwarded-for']`, `req.headers['user-agent']`.
- `jwt` / `events.*`: `headers()` fallback null.

Thêm 1–2 dòng trong Decision notes để symmetry với §40–42.

### R4-3. Thiếu test cho full chain "password change → invalidated token giữ reason → events.signOut emit đúng"
Step 4 §80 chỉ assert token shape sau invalidate ("preserves `pending_signout_reason` field"). Step 6 §86–89 chỉ cover happy path propagation. Missing: chain test kết hợp invalidation + reason propagation, đúng đường của R3-1 bug.

Đề xuất thêm bullet vào Step 6 hoặc Step 5:
> flow: `session.update(pending='forced_password_change')` + `password_changed_at > loginTime` → token sau jwt callback là `{ pending_signout_reason: 'forced_password_change' }` → `events.signOut` emit `forced_signout/forced_password_change` (không bị fallback session_expired).

### R4-4. `session_duration_ms` contract chưa locked
§53 liệt kê `session_duration_ms` trong metadata soft taxonomy nhưng không nói emit ở event nào. Logical: chỉ `events.signOut` có `loginTime` trong token → có thể tính `now - loginTime`. Nên:
- Lock trong Decision notes: "`events.signOut` computes `session_duration_ms = now - token.loginTime` when `loginTime` present."
- Thêm assertion trong Step 3 test §76 (hoặc Step 6).

Nếu không, soft taxonomy có mục không ai populate → noise trong contract.

### R4-5. LoginForm surface mapping cho `reason_code` mới
§15: "LoginForm.tsx stays UX-only." Nhưng `authorize` mới throw thêm `config_error`. Hiện LoginForm hiển thị message dựa vào `error.type` từ NextAuth signin — `config_error` sẽ fallback về generic message, làm người dùng bối rối trong dev env.

Không blocker; note:
> LoginForm may need follow-up to map `config_error` → user-facing Vietnamese message. Out of scope unless tests reveal gap.

Plan §15 đã có cụm "remains UX-only unless tests reveal gap" — đủ, chỉ cần chốt `config_error` là một trigger cụ thể để reviewer không bỏ sót.

### R4-6. Header nguồn cho request_id
§42: "try `headers().get('x-request-id')`". Vercel prod set `x-vercel-id` (format `iad1::sfo1::xxx-ts-hash`), không phải `x-request-id`. Nếu repo deploy trên Vercel và không có reverse proxy/middleware tự set `x-request-id`, production sẽ luôn fallback null.

Khuyến nghị thứ tự đọc: `x-request-id` → `x-vercel-id` → null. Thêm vào Decision notes. Hoặc ghi nhận "production có thể luôn null cho đến khi middleware set header chuẩn" như trade-off.

## Mức độ ưu tiên
- **Nên thêm trước RED**: R4-1 (typecheck sẽ block khi viết test nếu thiếu augmentation).
- **Document trong cùng commit refine**: R4-2, R4-4, R4-6.
- **Optional polish**: R4-3 (strong-nicer test), R4-5 (follow-up hint).

## Recommendation
Plan đã sẵn sàng đi RED. R4-1 là thao tác kỹ thuật phải làm bằng mọi giá (kể cả không note vào plan thì dev GREEN cũng phải tự augment). Còn R4-2..R4-6 là polish mà có thể defer vào quá trình GREEN mà không làm sai thiết kế. Nếu bạn muốn plan tự-đủ (self-contained), áp các note này; nếu không, có thể đóng review ở đây.
