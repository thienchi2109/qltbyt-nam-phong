## Why

Hệ thống hiện chỉ cho `global/admin` truy cập Cấu hình kỹ thuật, buộc chuyên gia
nghiệp vụ phải nhận quyền quản trị rộng hơn nhu cầu. Cần một role chuyên biệt có
toàn quyền trong workspace này nhưng không thấy hoặc thao tác Dashboard và mọi
module khác.

## What Changes

- Bổ sung role canonical `chuyen_gia`, hiển thị là `Chuyên gia`, do
  `global/admin` quản lý và không được normalize thành `global`. Account phải
  được gán đơn vị hiện tại; địa bàn phải resolve được từ account hoặc đơn vị đã
  gán, nhưng các metadata này không giới hạn data scope trong Cấu hình kỹ thuật.
- Bổ sung landing route theo role, route policy và navigation policy để
  `chuyen_gia` chỉ vào `/technical-configurations`; mọi app route bị cấm dùng
  shared `/access-denied`.
- Ẩn và tắt data fetching cho các app-shell feature không thuộc Cấu hình kỹ
  thuật, chỉ giữ nhận diện ứng dụng, thông tin account, đổi mật khẩu và đăng
  xuất; nhận diện ứng dụng tiếp tục lấy branding của đơn vị đã gán qua
  `don_vi_branding_get`.
- Chặn `chuyen_gia` tại mọi standalone feature API không thuộc Cấu hình kỹ
  thuật; việc thêm role vào canonical role constants không được tự động mở rộng
  allowlist dùng toàn bộ `ROLES`.
- Thêm allowlist RPC fail-closed riêng cho `chuyen_gia` tại Next.js RPC proxy;
  phân loại toàn bộ `ALLOWED_FUNCTIONS` để chỉ RPC của Cấu hình kỹ thuật và hạ
  tầng shell/account/session tối thiểu được phép đi qua.
- Mở toàn bộ read/write capability của Cấu hình kỹ thuật cho `chuyen_gia` ở
  data/action boundary bằng authorization helper riêng của module, không mở
  quyền ở RPC hoặc route khác.
- Làm session profile refresh lấy role hiện tại từ database và cập nhật
  JWT/session fail-closed trong cadence tối đa 60 giây khi role thay đổi; RPC
  proxy chấp nhận `khoa_phong = null` chỉ cho đúng role `chuyen_gia`, đồng thời
  scope claim mới phải thay thế authoritative thay vì fallback về token cũ.
- Bảo vệ invariant đơn vị của account chuyên gia tại mọi luồng thay đổi
  membership/current unit: hoặc thay thế nguyên tử bằng đơn vị hợp lệ, hoặc từ
  chối mà không làm account mất `don_vi`, membership hay `dia_ban_id`; luồng
  thay thế dùng RPC transaction riêng `user_reassign_expert_scope`.
- Lập kế hoạch migration append-only, TDD coverage và Database Quality Gate;
  proposal này không apply migration lên live database.

## Impact

- Affected specs: `technical-configuration-expert-access` (new capability)
- Affected code:
  - `src/lib/rbac.ts`
  - `src/lib/app-route-access.ts`
  - `src/middleware.ts`
  - `src/components/app-navigation.tsx`
  - `src/app/page.tsx`
  - `src/app/_components/LoginForm.tsx`
  - `src/app/(app)/_components/AppLayoutShell.tsx`
  - `src/app/api/rpc/[fn]/route.ts`
  - `src/app/api/rpc/[fn]/allowed-functions.ts`
  - `src/app/api/chat/route.ts`
  - `src/app/api/device-quota/mapping/suggest/**`
  - `src/app/api/tenants/memberships/route.ts`
  - `src/app/api/tenants/switch/route.ts`
  - `src/auth/next-auth-callbacks.ts`
  - `src/auth/session-profile-refresh.ts`
  - `src/auth/types.ts`
  - `src/types/database.ts`
  - canonical RPC-name collections under `src/lib/technical-configuration-*-rpcs.ts`
  - `docs/RBAC.md`
  - role/helper and standalone-API regression tests
  - user-management dialogs/hooks under `src/app/(app)/users` and
    `src/components`
  - append-only Supabase migrations and focused SQL tests
- Related active changes:
  - `add-technical-configuration-comparison`
  - `harden-technical-configuration-baseline-copy-and-excel`

## Wayfinder Traceability

- Map: https://github.com/thienchi2109/qltbyt-nam-phong/issues/951
- Source decision: https://github.com/thienchi2109/qltbyt-nam-phong/issues/952
- Decision status: Resolved
- Promoted on: 2026-08-23
- Review clarification on 2026-08-23: `chuyen_gia` will always have assigned
  `don_vi` and resolvable `dia_ban_id`; this supersedes only the tenantless
  account detail in #952. Technical Configurations access remains system-wide
  and tenant switching remains denied.
