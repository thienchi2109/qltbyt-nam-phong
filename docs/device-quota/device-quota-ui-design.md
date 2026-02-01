# Thiết kế UI: Theo dõi định mức thiết bị

Tài liệu này bổ sung chi tiết UI/UX cho kế hoạch ở `docs/device-quota-compliance-plan.md` theo chuẩn dự án (Next.js 15 + Tailwind + Radix + React Query).

## Mục tiêu UX
- Nhìn nhanh trạng thái tuân thủ theo nhóm/hạng mục; nổi bật các hạng mục "vượt".
- Sửa/cập nhật định mức có kiểm soát, ghi lịch sử, kèm căn cứ pháp lý.
- Hỗ trợ tạo và duyệt đề nghị vượt định mức mạch lạc, tối thiểu thao tác.

## Định tuyến & cấu trúc trang
- Route: `/app/equipment/quotas`
  - `page.tsx` (server component): kiểm tra session, render shell.
  - Client components sử dụng React Query qua `rpcClient` để gọi `/api/rpc`.

## Thành phần chính
- `QuotaDashboard` (client):
  - Cards: Tổng số nhóm đạt/thiếu/vượt; số đề nghị đang chờ.
  - Bar chart: So sánh `thuc_te` vs `dinh_muc` theo nhóm chính (Sử dụng `@visx/xychart` hoặc đơn giản hóa với div progress).
  - Filter: `TenantSwitcher` (đã có), `DepartmentSelect` (tùy chọn), `AsOfDatePicker` (tính theo ngày).

- `QuotaTreeTable` (client):
  - Tree-table phẳng từ `vw_thiet_bi_dinh_muc_cay` với cột: STT | Tên hạng mục | Đơn vị tính | Định mức | Thực tế | Chênh lệch | Trạng thái | Ghi chú | Căn cứ.
  - Hỗ trợ expand/collapse; icon trạng thái Badge màu: xanh (đạt), vàng (thiếu), đỏ (vượt).
  - Tooltip căn cứ pháp lý: hiện `so_ky_hieu`, `trich_yeu`, `ngay_hieu_luc`.
  - Hàng có menu hành động (3 chấm): `Cập nhật định mức`, `Tạo đề nghị vượt`, `Xem lịch sử` — dùng `event.stopPropagation()` như mẫu thiết bị.

- Dialogs/Drawers:
  - `QuotaUpsertDialog`: Form cập nhật định mức với trường: pham_vi, khoa_phong (nếu có), so_luong_toi_da, effective_from/to, so_quyet_dinh, co_quan_phe_duyet, tệp căn cứ. Submit gọi `equipment_quota_upsert`.
  - `QuotaExceptionWizard`: Wizard 2-3 bước để tạo đề nghị vượt: chọn hạng mục (pre-filled), nhập số đề nghị, lý do, tệp minh chứng; review & submit.
  - `QuotaHistoryDrawer`: Timeline lịch sử từ `equipment_quota_audit_log` cùng diff trước/sau.

## API/RPC hook gợi ý
- `useQuotaTree({ tenantId, departmentId, asOf })`
- `useQuotaStatus({ tenantId, departmentId, nodeId, asOf })`
- `useUpsertQuota()` → mutation
- `useCreateException()` / `useApproveException()` → mutation

## Pha màu & biểu tượng
- Màu chuẩn dự án: primary `#438797`; accent `#58a7b3`.
- Trạng thái: `dat`→ xanh `emerald`, `thieu`→ vàng `amber`, `vuot`→ đỏ `rose`.
- Icons: Radix Icons (`CheckCircled`, `ExclamationTriangle`, `CrossCircled`).

## Khả năng truy cập
- Focus ring rõ ràng trên nút/row; aria-label cho menu hành động.
- Bàn phím: expand/collapse bằng phím mũi tên; Enter mở dialog; Esc đóng.

## Ràng buộc & bảo mật UI
- Ẩn/disable các nút chỉnh sửa nếu role không thuộc `global|to_qltb`.
- Không nhận `tenantId` từ client cho non-global; backend sẽ cưỡng chế theo JWT.

## Skeleton cấu phần (TSX mẫu)

```tsx
// src/components/quota/quota-dashboard.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
// ...
export function QuotaDashboard({ tenantId }: { tenantId: number | "all" }) {
  // const { data, isLoading } = useQuery(...);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Cards placeholder */}
      <div className="rounded-lg bg-white p-4 shadow">Tổng quan</div>
      <div className="rounded-lg bg-white p-4 shadow">Biểu đồ</div>
      <div className="rounded-lg bg-white p-4 shadow">Đề nghị chờ duyệt</div>
    </div>
  );
}
```

```tsx
// src/components/quota/quota-tree-table.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
// ...
export function QuotaTreeTable({ tenantId }: { tenantId: number | "all" }) {
  // const { data, isLoading } = useQuery(...);
  return (
    <div className="rounded-lg bg-white p-2 shadow">
      {/* Table header */}
      <div className="grid grid-cols-8 gap-2 border-b px-2 py-2 text-sm font-medium">
        <div>STT</div>
        <div className="col-span-2">Hạng mục</div>
        <div>ĐVT</div>
        <div>Định mức</div>
        <div>Thực tế</div>
        <div>Chênh lệch</div>
        <div>Trạng thái</div>
      </div>
      {/* Rows placeholder */}
    </div>
  );
}
```

## Theo dõi hiệu năng
- Sử dụng pagination/lazy expand cho cây lớn.
- React Query `select` để rút gọn payload; cân nhắc materialized view và cache.

## Lộ trình UI (gợi ý)
1. QuotaDashboard + TreeTable (read-only) → 2-3 ngày.
2. UpsertDialog + HistoryDrawer → 2-3 ngày.
3. ExceptionWizard + trang duyệt → 3-4 ngày.
4. Polish accessibility + export → 1-2 ngày.
