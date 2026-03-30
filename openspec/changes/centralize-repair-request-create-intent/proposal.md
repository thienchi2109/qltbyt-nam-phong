## Why

Luồng "Báo sửa chữa" hiện bị phân tán ở nhiều entry point: Equipment desktop, Equipment mobile, Dashboard, và QR scanner tự dựng deep-link riêng sang `/repair-requests`. Điều này đã tạo ra hành vi lệch nhau giữa desktop và mobile: có nơi mở được create sheet, có nơi chỉ điều hướng sang trang, và có nơi mở sheet nhưng không truyền/prefill thiết bị theo cùng một contract rõ ràng.

Chúng ta cần một API điều hướng duy nhất cho "mở form tạo yêu cầu sửa chữa" để mọi nguồn gọi cùng một contract, giảm drift giữa desktop/mobile, giữ khả năng deep-link/share URL, và khiến việc debug/prefill tập trung vào một sink duy nhất ở trang Repair Requests.

## What Changes

- Introduce a single shared helper/hook for opening the Repair Request create flow from anywhere in the app.
- Standardize all existing create-repair entry points to use the same intent contract, including optional `equipmentId` preselection.
- Keep the Repair Requests page as the single sink that resolves the deep-link, opens the create sheet, and applies equipment prefill.
- Preserve direct deep-link behavior so refresh, copy/paste URL, and cross-page navigation still open the same create flow.
- Remove per-surface URL string duplication for create-repair navigation in Dashboard, Equipment desktop/mobile, and QR scanner flows.
- Add regression tests covering shared navigation contract, create-sheet opening, and equipment prefill across representative entry points.
- Do not change repair request form fields, submission RPCs, or backend schema as part of this change.

## Capabilities

### New Capabilities
- `repair-request-create-intent`: Defines a single app-wide contract for opening the Repair Request create flow, including deep-link creation, sheet opening, and optional equipment prefill.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/components/equipment/equipment-actions-menu.tsx`
  - `src/components/mobile-equipment-list-item.tsx`
  - `src/app/(app)/dashboard/page.tsx`
  - `src/app/(app)/qr-scanner/page.tsx`
  - `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx`
  - `src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts`
  - `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`
  - `src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx`
  - New shared navigation helper/hook under `src/lib` or a nearby shared app module
  - Focused tests for entry points and repair-request deep-link behavior
- No backend migration or RPC contract change is expected.
- User-visible risk is low to medium because the flow is concentrated in a few UI entry points, but regressions would affect multiple high-traffic repair-request entry surfaces at once.
