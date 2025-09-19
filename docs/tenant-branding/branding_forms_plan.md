# Kế hoạch chèn Tên/Logo Đơn Vị vào các Biểu Mẫu (reuse components)

## Mục tiêu
- Non‑global user luôn nhìn thấy tên và logo đúng đơn vị (theo don_vi trong session) trên mọi biểu mẫu.
- Tái sử dụng hook/components hiện có (useTenantBranding, TenantLogo, TenantName) để tránh tăng call RPC và đảm bảo UX mượt.
- Không ảnh hưởng tới RPC gateway, NextAuth, server‑side filtering hay các trang hiện hữu.

## Phạm vi
- Biểu mẫu tĩnh (HTML thuần):
  - handover_demo.html, handover_template.html, handover_update.html
  - log_template.html, login_page_template.html
  - maintainance-html-form.html, repair_result_form.html
- Biểu mẫu được hard‑code trong React (nếu có) dưới src/app/(app)/** và src/components/**.

## Giải pháp tổng quát
1) Dùng hook `useTenantBranding` (đã có) để lấy `{ id, name, logo_url }` theo don_vi từ session (JWT claims được gateway đảm bảo).
2) Tạo component tái sử dụng cho biểu mẫu:
   - `FormBrandingHeader` (dùng TenantLogo/TenantName) kèm skeleton, props: `align`, `size`, `showDivider?`.
3) Tối ưu cache/calls:
   - Prefetch branding tại App Layout (hoặc TenantBrandingProvider optional), reuse qua context để tránh gọi lại.
   - TanStack Query: `staleTime 5m`, `gcTime 15m`, `keepPreviousData`.
4) Chiến lược tích hợp:
   - Form React: chèn `<FormBrandingHeader />` ở đầu; loại bỏ footer text cố định.
   - Form HTML tĩnh:
     - Phương án A (sẽ thực hiện sau - note TODO): migrate sang page React tương ứng (JSX), chèn `<FormBrandingHeader />` → đồng nhất hạ tầng cache/UX.
     - Phương án B (chọn phương án này): thêm `<div id="tenant-branding"></div>` + script nhỏ gọi `/api/rpc/don_vi_branding_get` và inject logo/tên; loại bỏ footer bằng CSS/DOM.

## Tiêu chí chấp nhận
- Non‑global user luôn thấy đúng tên/logo đơn vị của họ; không leakage giữa tenants.
- Dùng Query cache (prefetch, context) để giảm call RPC; UX mượt (skeleton, no flash).
- Không tác động RPC gateway, NextAuth, server‑side filtering, hoặc các trang khác.

## Kiến trúc/Thành phần dùng lại
- Hook: `useTenantBranding(overrideDonViId?)` – queryKey `['tenant_branding', {tenant}]`, invalidate trên `tenant-switched`.
- UI: `TenantLogo`, `TenantName` (đã có); mới: `FormBrandingHeader`.
- Optional: `TenantBrandingProvider` (Context) ở AppLayout để feed branding cho form pages.

## Kế hoạch thực thi theo pha
- P0 (Core):
  - Tạo `FormBrandingHeader` tại `src/components/form-branding-header.tsx` (dùng TenantLogo/TenantName; skeleton; responsive).
  - (Optional) `src/contexts/tenant-branding-provider.tsx` – wrap tại AppLayout, invalidate trên `tenant-switched`.
  - Chèn header vào form React hiện có; loại bỏ footer text cố định.
- P1 (Migrate HTML ưu tiên):
  - Tạo pages React tương ứng: `src/app/(app)/forms/**/page.tsx`; copy nội dung HTML → JSX; chèn `<FormBrandingHeader />`.
  - Xóa hoặc disable các file HTML tương ứng khỏi luồng người dùng (để tránh double entry).
- P2 (Phần còn lại / tạm thời):
  - Nếu còn HTML chưa migrate: thêm placeholder + script inject branding (tạm), loại footer bằng CSS/DOM.

## Checklist thay đổi file (dự kiến)
- Thêm:
  - `src/components/form-branding-header.tsx`
  - (Optional) `src/contexts/tenant-branding-provider.tsx`
- Sửa (ví dụ):
  - `src/app/(app)/...` các form React: chèn header, bỏ footer.
  - Tạo `src/app/(app)/forms/.../page.tsx` để migrate các file HTML chính.

## Responsive & UX
- Breakpoints đề xuất (tham chiếu layout hiện tại):
  - ≤640px: logo 24px, name `text-sm`, align center.
  - 641–1024px: logo 32px, name `text-base`.
  - ≥1024px: logo 40px, name `text-lg`, align theo bố cục form.
- Skeleton khi branding đang load; giữ `keepPreviousData` để tránh nhấp nháy.

## Kiểm thử
- Matrix:
  - Non‑global user A/B: mở từng form → đúng logo/tên đơn vị tương ứng.
  - Global user: không override → platform branding (tài liệu hóa hành vi); (future) có override → đúng đơn vị.
  - Event `tenant-switched` → invalidate và cập nhật branding ngay.
- Regression:
  - Đăng nhập/out NextAuth OK; RPC gateway allow‑list không đổi.
  - Equipment server‑side filtering hoạt động bình thường.

## Lộ trình triển khai
1. P0: Tạo component + (optional) provider; tích hợp vào form React; xóa footer.
2. P1: Migrate 2–3 HTML biểu mẫu được dùng nhiều (handover, maintenance…).
3. P2: Migrate phần còn lại hoặc dùng giải pháp script tạm thời.

## Ghi chú hiệu năng
- Provider + query prefetch ở layout giúp 100% form đọc dữ liệu từ cache.
- Không lặp call RPC giữa nhiều form/page.
- Không can thiệp logic gateway/claims nên an toàn đa tenant.
