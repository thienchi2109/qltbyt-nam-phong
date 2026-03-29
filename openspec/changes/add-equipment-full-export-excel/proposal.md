## Why
Hiện tại chức năng "Tải về file Excel" trong trang Equipment chỉ xuất các thiết bị **trên trang hiện tại** (do sử dụng `data.data` đã phân trang). User cần xuất **toàn bộ danh sách theo filter** để báo cáo và quản lý, không chỉ 20-50 record đang hiển thị.

Ngoài ra, cần thông báo rõ ràng cho user biết số lượng thiết bị sẽ được tải và các filter đang active trước khi bắt đầu tải.

**GitHub Issue:** #170

## What Changes
- Thay đổi `handleExportData` để fetch toàn bộ data theo filter (không phân trang) thay vì dùng `data.data` hiện có.
- Hiển thị toast xác nhận trước khi tải với số lượng thiết bị và trạng thái filter.
- Thêm loading state và disable nút export trong khi đang fetch/tải.
- Xử lý edge case khi danh sách quá lớn (>5000 items) - hiện cảnh báo cho user.

## Impact
- Affected specs: `equipment-export` (new capability spec).
- Affected code:
  - `src/app/(app)/equipment/_hooks/useEquipmentExport.ts` - Main export logic
  - `src/app/(app)/equipment/_hooks/useEquipmentData.ts` - May need helper for full fetch
  - `src/app/(app)/equipment/use-equipment-page.tsx` - Pass filter context to export hook
  - Possibly new RPC or reuse `equipment_list_enhanced` with `p_page_size = NULL`
