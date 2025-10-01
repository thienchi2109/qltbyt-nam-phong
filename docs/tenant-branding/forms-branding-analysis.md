# Phân tích tenant branding trên biểu mẫu

## Hiện trạng triển khai
- `useTenantBranding` đọc session NextAuth để xác định `don_vi` và gọi RPC `don_vi_branding_get`; global/admin không có `don_vi` nên key truy vấn là `'none'` và RPC chạy với `p_id = null`.【F:src/hooks/use-tenant-branding.ts†L13-L43】
- `FormBrandingHeader` gọi trực tiếp hook ở trên, render skeleton khi đang tải và fallback về "Nền tảng QLTBYT" khi không có dữ liệu; mọi biểu mẫu React đều dùng component này ở phần đầu.【F:src/components/form-branding-header.tsx†L9-L76】【F:src/app/(app)/forms/handover/page.tsx†L10-L40】【F:src/components/handover-template.tsx†L70-L135】【F:src/components/maintenance-form.tsx†L37-L143】【F:src/components/repair-result-form.tsx†L80-L156】
- Các biểu mẫu nhận dữ liệu nghiệp vụ (mã yêu cầu, thiết bị, người ký, v.v.) thông qua props hoặc state cục bộ, nhưng không truyền thông tin branding riêng của từng tenant vào `FormBrandingHeader`, do đó branding luôn phụ thuộc vào session hiện tại của người dùng.

## Vấn đề cần giải quyết
- Global/admin mở biểu mẫu thuộc một tenant cụ thể sẽ nhìn thấy branding của session (thường là mặc định nền tảng) thay vì tên/logo gốc của tenant của biểu mẫu. Điều này trái với yêu cầu "global nhìn thấy tên/logo gốc của tenant khi mở biểu mẫu của tenant đó".
- Hook hiện tại không phân biệt được ngữ cảnh "đang xem dữ liệu tenant khác" vì chỉ dựa vào `don_vi` trong session và không hỗ trợ truyền brand từ dữ liệu biểu mẫu.

## Định hướng refactor đề xuất
1. **Tách nguồn dữ liệu branding cho biểu mẫu**
   - Bổ sung API/props để các biểu mẫu nhận `tenantBranding` (ví dụ `{ id, name, logo_url }`) từ dữ liệu server (thông tin của tenant sở hữu biểu mẫu).
   - Truyền dữ liệu đó xuống `FormBrandingHeader` thông qua prop mới (`brandingOverride` hoặc tương tự).
2. **Điều kiện áp dụng dynamic branding**
   - Tạo helper/hook mới (ví dụ `useFormBranding`) kiểm tra `role` trong session.
   - Nếu `role` là global/admin và có `brandingOverride`, render trực tiếp thông tin override, bỏ qua `useTenantBranding` để tránh thay đổi động theo session.
   - Đối với user thường, tiếp tục dùng `useTenantBranding` như hiện tại để hưởng lợi từ cache và invalidate theo sự kiện `tenant-switched`.
3. **Cập nhật component dùng chung**
   - Mở rộng `FormBrandingHeader` để chấp nhận prop cấu hình: `tenantId`, `brandingOverride`, `disableDynamicForGlobal`.
   - Tối ưu để chỉ khởi tạo `useTenantBranding` khi cần (lazy hook hoặc branch trước khi gọi) nhằm tránh vi phạm Rules of Hooks.
4. **Luồng dữ liệu biểu mẫu**
   - Khi render biểu mẫu dựa trên dữ liệu thực (ví dụ `HandoverTemplate`, `MaintenanceForm`, `RepairResultForm`), đảm bảo đối tượng dữ liệu chứa tenant owner (`don_vi_id`) và branding gốc.
   - Với global/admin, truyền `brandingOverride` vào form header; với user tenant, bỏ trống để fallback về hook hiện có.
5. **Tài liệu & kiểm thử**
   - Cập nhật hướng dẫn trong `docs/tenant-branding/branding_forms_plan.md` với yêu cầu mới.
   - Viết test mô tả (tối thiểu là story hoặc unit) để xác nhận global hiển thị brand gốc trong khi user thường vẫn thấy brand theo session.

## Bước tiếp theo đề xuất
- Bổ sung pipeline lấy `tenantBranding` trong các API/form loader (ví dụ RPC trả về thêm trường brand).
- Implement `FormBrandingHeader` mới và refactor các biểu mẫu sử dụng.
- Thực hiện smoke test với 3 trường hợp: user tenant, global xem form tenant A, global xem form tenant B.
