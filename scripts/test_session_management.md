# Test Session Management va Signout Wiring

Tai lieu nay dung de test Batch 4 cua Issue #366/#379 sau khi backend auth observability da co san.

## Muc tieu

- Xac nhan user bam `Dang xuat` thi frontend seed `pending_signout_reason=user_initiated` truoc khi `signOut()`.
- Xac nhan doi mat khau thanh cong thi frontend seed `pending_signout_reason=forced_password_change`, giu toast thanh cong trong thoi gian ngan, roi moi `signOut()`.
- Ghi ro hanh vi cross-tab:
  - tab khoi tao doi mat khau se phat `forced_signout/forced_password_change`
  - tab khac co the phat `forced_signout/session_expired`
  - backend correlate bang `token_invalidated_password_change`

## Verification nhanh trong local

### 1. Chay cac gate bat buoc

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/app/'(app)'/__tests__/AppLayoutShell.test.tsx
node scripts/npm-run.js run test:run -- src/components/__tests__/change-password-dialog.signout.test.tsx
node scripts/npm-run.js run test:run -- src/lib/__tests__/auth-signout.test.ts
node scripts/npm-run.js run test:run -- src/auth/__tests__/auth-config.authorize-events.test.ts
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

### 2. Test `Dang xuat` tu user menu

1. Dang nhap vao app.
2. Mo user menu o header.
3. Bam `Dang xuat`.
4. Ky vong:
   - session bi xoa va quay ve `/`
   - chi co mot signout flow cho tab khoi tao
   - backend log event `signout` voi `signout_reason=user_initiated`

Neu can kiem tra bang test tu dong, xem:
- `src/app/(app)/__tests__/AppLayoutShell.test.tsx`
- `src/lib/__tests__/auth-signout.test.ts`
- `src/auth/__tests__/auth-config.authorize-events.test.ts`

### 3. Test doi mat khau thanh cong

1. Dang nhap vao app.
2. Mo user menu va chon `Thay doi mat khau`.
3. Nhap mat khau hien tai, mat khau moi, xac nhan mat khau moi.
4. Submit khi RPC `change_password` thanh cong.
5. Ky vong:
   - hien toast thanh cong
   - dialog dong lai
   - toast van con hien khoang 1.5 giay truoc khi bi logout
   - sau do app quay ve `/`
   - backend log `forced_signout` voi `signout_reason=forced_password_change`
   - khong co ghost `session_expired` tren tab khoi tao

Neu can kiem tra bang test tu dong, xem:
- `src/components/__tests__/change-password-dialog.signout.test.tsx`
- `src/lib/__tests__/auth-signout.test.ts`
- `src/auth/__tests__/auth-config.authorize-events.test.ts`

### 4. Test cross-tab sau doi mat khau

1. Mo cung mot tai khoan o 2 tab.
2. O tab A, doi mat khau thanh cong.
3. Quan sat tab B.
4. Ky vong:
   - tab A phat `forced_signout/forced_password_change`
   - tab B co the roi vao `session_expired` khi session bi vo hieu hoa
   - backend da co `token_invalidated_password_change` de correlate 2 su kien nay

Ghi chu:
- `session_expired` o tab khong khoi tao la hanh vi du kien, khong coi la bug cua Batch 4.
- Muc tieu cua Batch 4 la loai bo ghost `session_expired` tren tab khoi tao doi mat khau.

## Kiem tra log / audit sink

Neu Batch 3 da duoc apply, co the kiem tra them bang log hoac `auth_audit_log`:

- `signout` + `user_initiated`
- `forced_signout` + `forced_password_change`
- `forced_signout` + `session_expired` chi xuat hien o fallback/cross-tab path
- `token_invalidated_password_change` de correlate invalidation

Can doi chieu them voi:
- `src/auth/config.ts`
- `src/auth/logging.ts`
- `src/auth/persistence.ts`
