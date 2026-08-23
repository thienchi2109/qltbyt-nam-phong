## Why

Hệ thống hiện chỉ cho `global/admin` truy cập Cấu hình kỹ thuật, buộc chuyên gia
nghiệp vụ phải nhận quyền quản trị rộng hơn nhu cầu. Cần một role chuyên biệt có
toàn quyền trong workspace này nhưng không thấy hoặc thao tác Dashboard và mọi
module khác.

## What Changes

- Bổ sung role canonical `chuyen_gia`, hiển thị là `Chuyên gia`, do
  `global/admin` quản lý và không được normalize thành `global`.
- Bổ sung landing route theo role, route policy và navigation policy để
  `chuyen_gia` chỉ vào `/technical-configurations`; mọi app route bị cấm dùng
  shared `/access-denied`.
- Ẩn và tắt data fetching cho các app-shell feature không thuộc Cấu hình kỹ
  thuật, chỉ giữ nhận diện ứng dụng, thông tin account, đổi mật khẩu và đăng
  xuất.
- Mở toàn bộ read/write capability của Cấu hình kỹ thuật cho `chuyen_gia` ở
  data/action boundary bằng authorization helper riêng của module, không mở
  quyền ở RPC hoặc route khác.
- Làm session profile refresh lấy role hiện tại từ database và cập nhật
  JWT/session fail-closed trong cadence tối đa 60 giây khi role thay đổi.
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
  - `src/auth/next-auth-callbacks.ts`
  - `src/auth/session-profile-refresh.ts`
  - `src/auth/types.ts`
  - `src/types/database.ts`
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
