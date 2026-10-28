# WP-07 — Kiểm chứng tương thích QLTBYT và an toàn cutover

- Status: To Do
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-06
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu bằng chứng regression cho QLTBYT và các điều chỉnh adapter tối thiểu
nếu kiểm chứng cho thấy cần. Điểm chạm: `src/app/api/web-push/`,
`src/lib/web-push/`, `src/sw.ts`, lifecycle opt-in và Go contract tests.
Giữ UI/route/browser contract khi backend refactor không đòi thay đổi chúng.

## Acceptance criteria

- [ ] Public key, register và revoke giữ cùng-origin/session owner,
      validation, UUID/revision và lỗi versioned; payload/deep link vẫn hợp lệ.
- [ ] Browser permission, local subscription và server registration được
      kiểm chứng riêng; bật push và tự khôi phục không gây xin quyền ngoài ý muốn.
- [ ] Đổi tài khoản chỉ giao cho account đang hoạt động, giữ consent riêng;
      forced-password signout thu hồi đúng; race đăng ký/thu hồi không bật lại
      consent hoặc làm sống lại registration cũ.
- [ ] Recipient config, tenant, quyền đọc và authorization epoch được kiểm
      tra tại nguồn trước dispatch; revoke hoặc revision cũ không bị bỏ qua.
- [ ] Lộ trình mặc định giữ kho subscription và VAPID. Nếu cần đổi kho/key,
      kiểm chứng import/mapping hoặc reconciliation: local `enabled` có thể bỏ
      qua POST nên backend rỗng không được coi là đã đăng ký thành công.
- [ ] Bảo toàn outbox/retry và không chạy hai consumer cạnh tranh ngoài
      lease contract; báo cáo rõ rủi ro gửi lặp vốn có và hành vi rollback.
- [ ] Evidence tách automated local/disposable với browser/device smoke;
      phần chưa kiểm chứng được ghi INCOMPLETE và có follow-up rõ.

## Xác minh

Go contract/integration tests và focused browser lifecycle tests. Nếu sửa
JS/TS, chạy đủ gate theo AGENTS.md; UI tests đi qua tương tác thực tế.
Nếu phát sinh SQL, static và Oracle baseline-forward phải PASS cùng exact
commit trước live review; task không tự cấp phép live write/cutover.
