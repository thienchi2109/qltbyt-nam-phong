# Runbook: JWT refresh telemetry va revoke latency

Ap dung cho issue #374, sau cac thay doi #365, #371 va PR #373.

## Muc tieu

- Do ty le `get_session_profile_for_jwt` refresh so voi tong so lan NextAuth `jwt` callback chay.
- Xac nhan steady session dat muc `profile_refresh_rpc / jwt_callback <= 0.05`.
- Smoke-test password-change revocation latency theo cooldown 60 giay.
- Dam bao routine refresh path khong quay lai `SUPABASE_SERVICE_ROLE_KEY` hoac chained table SELECT.

## Telemetry format

Auth refresh path ghi log JSON mot dong qua `console.info`:

```json
{"scope":"auth.jwt","event":"jwt_callback_invoked","userId":"42","refreshDue":false,"refreshReason":"cooldown"}
```

Event can quan sat:

- `jwt_callback_invoked`: moi lan NextAuth goi `jwt` callback cho token co `id`.
- `jwt_refresh_skipped_cooldown`: callback bi skip vi chua het cooldown.
- `jwt_refresh_forced_update_trigger`: refresh duoc ep boi `trigger === "update"`.
- `jwt_refresh_attempted`: bat dau goi `get_session_profile_for_jwt`.
- `jwt_refresh_succeeded`: RPC thanh cong va JWT duoc sync profile.
- `jwt_refresh_failed`: refresh path loi hoac RPC khong tra ve profile.
- `jwt_token_invalidated_password_change`: token bi revoke vi `password_changed_at > loginTime`.

Khong duoc log raw JWT, password, username, full name, secret, service-role key, hoac profile payload day du.

## Do refresh rate

1. Chay app trong moi truong can do va dang nhap bang user test.
2. Mo nhieu trang protected hoac thuc hien thao tac tao nhieu `getServerSession` / RPC calls trong it nhat 2-3 phut.
3. Loc log co `"scope":"auth.jwt"`.
4. Dem:
   - `jwt_callback_count`: so dong co `event = jwt_callback_invoked`
   - `profile_refresh_count`: so dong co `event = jwt_refresh_attempted`
5. Tinh:

```text
profile_refresh_count / jwt_callback_count
```

Ket qua mong doi trong steady session: `<= 0.05`.

Neu ty le cao hon:

- Kiem tra co qua nhieu `jwt_refresh_forced_update_trigger` khong.
- Kiem tra token co mat `lastRefreshAt` khong.
- Kiem tra code co bi doi mat cooldown `PROFILE_REFRESH_INTERVAL_MS = 60_000` khong.
- Mo follow-up fix rieng, khong mo rong #374 thanh refactor lon neu chua co root cause ro.

## Smoke password-change revocation latency

1. Tao hai phien A va B cho cung mot user test.
   - A: browser hoac profile browser thu nhat.
   - B: browser hoac incognito/profile thu hai.
2. O ca A va B, vao mot trang protected de dam bao session dang song.
3. O A, doi mat khau thanh cong.
4. O B, tiep tuc goi trang protected hoac mot thao tac co server session/RPC.
5. Theo doi log `"scope":"auth.jwt"` cua user do.
6. Ket qua mong doi:
   - Co `jwt_callback_invoked` cho B khi B tao request moi.
   - Khi refresh path den han cooldown hoac co trigger update, co `jwt_refresh_attempted`.
   - Neu `password_changed_at` sau `loginTime`, co `jwt_token_invalidated_password_change`.
   - B bi mat session trong khoang thiet ke 60 giay sau khi callback refresh thay doi mat khau.

Luu y: #374 chi xac minh latency theo thiet ke cooldown hien tai. Immediate cross-tab logout, client polling, BroadcastChannel, hoac force signout fan-out thuoc scope #364.

## Regression guard

Khi sua auth refresh ve sau, phai giu cac rang buoc:

- Routine refresh chi goi `get_session_profile_for_jwt`.
- Khong quay lai chained `.from("nhan_vien")`, `.from("don_vi")`, `.from("dia_ban")` reads trong `jwt` callback.
- Khong dung `SUPABASE_SERVICE_ROLE_KEY` cho routine refresh hot path.
- Fail closed khi refresh JWT env hoac `app_role` khong hop le.
- Truyen `p_user_id` dang string de giu tuong thich bigint RPC.

## Lenh kiem chung lien quan

```bash
node scripts/npm-run.js run test:run -- src/auth/__tests__/auth-config.jwt-cooldown.test.ts src/auth/__tests__/auth-config.jwt-rpc.test.ts
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
```
