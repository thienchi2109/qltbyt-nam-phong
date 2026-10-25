# RPT-1006 — Đồng bộ bộ lọc khoa/phòng trong Báo cáo tồn kho

- Status: Todo
- Issue: [#1006](https://github.com/thienchi2109/qltbyt-nam-phong/issues/1006)
- Updated: 2026-10-25
- Branch: `test/reports-department-filter-red`
- Dependency: chốt phương án trước khi triển khai GREEN; chưa sửa implementation.

## Vấn đề và root cause

Với `to_qltb`, đổi khoa/phòng ở bộ lọc trên nhưng khối tổng hợp phân bố và biểu đồ “Phân bố Thiết bị theo Khoa/Phòng” vẫn hiển thị toàn đơn vị. `InventoryReportTab` không truyền bộ lọc vào `EquipmentDistributionSummary` và `InteractiveEquipmentChart`; hai widget giữ query key cũ và gửi `p_khoa_phong: null`.

RPC `equipment_status_distribution` đã hỗ trợ lọc khoa/phòng. Thẻ tổng hợp tồn kho và bảng chính có truyền bộ lọc; phạm vi sửa là hai widget trên.

## Phương án đề xuất

Truyền bộ lọc của trang qua prop tùy chọn vào hai widget, chuẩn hóa `all` thành không giới hạn khoa/phòng và dùng hook/query key hiện có. Reset drill-down của biểu đồ khi bộ lọc trên đổi. Không cần migration hoặc dependency mới.

## Acceptance

- [x] Chạy RED cho từng widget bằng component, hook phân bố và QueryClient thật; mock tại ranh giới RPC và phần vẽ chart.
- [ ] Giữ nguyên regression và làm GREEN cho chuỗi tất cả → Khoa A → Khoa B → tất cả ở cả hai widget.
- [ ] Drill-down cũ không tồn tại sau khi đổi khoa/phòng ở bộ lọc trên.
- [ ] Giữ tenant scope của `to_qltb` và hành vi các nơi dùng component không truyền bộ lọc ngoài.
- [ ] Chạy format, no-explicit-any, dedupe diff-only, typecheck, focused tests và React Doctor theo thứ tự repo.

## RED evidence

Regression: [inventory-report-department-filter.test.tsx](<../../src/app/(app)/reports/components/__tests__/inventory-report-department-filter.test.tsx>).

Fixture: Khoa A = 10, Khoa B = 20, toàn đơn vị = 30. Khi chọn A, tổng hợp vẫn trả 30 thay vì 10; biểu đồ vẫn chứa cả A:10 và B:20. Hai regression FAIL đúng assertion; 10 test hiện có liên quan PASS. Test thao tác bộ lọc Radix Select thật; RPC được giả lập, chưa phải browser/live verification.

Review độc lập không còn blocker. No-explicit-any, dedupe diff-only và typecheck PASS. React Doctor đã chạy và SKIP vì chỉ thay đổi test/documentation.

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/reports/components/__tests__/inventory-report-department-filter.test.tsx'
```

Trạng thái bàn giao: RED đã chứng minh; GREEN và triển khai chưa thực hiện.
