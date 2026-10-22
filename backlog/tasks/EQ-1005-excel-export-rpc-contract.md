# EQ-1005 — Khôi phục xuất Excel danh sách thiết bị

- Status: Done
- Completed: 2026-10-22
- Issue: [#1005](https://github.com/thienchi2109/qltbyt-nam-phong/issues/1005)
- Regression commit: `c37f9f43`
- Fix commit: `3a19156b`
- Integration: fast-forward vào `main`.

## Root cause

Sau khi tách dataset `regular` / `placed`, luồng xuất gửi 12 named arguments cho `equipment_list_enhanced`, thiếu `p_liquidation_last`. Overload tương thích trong migration `20261015110000_equipment_list_enhanced_frontend_compatibility.sql` yêu cầu đủ 13 arguments và không có defaults. Commit `c08e9913` khôi phục tải danh sách nhưng bỏ sót payload xuất.

Kiểm tra chỉ đọc trên live bằng `EXPLAIN` không có `ANALYZE`: payload 12 arguments trả SQLSTATE `42883`; thêm `p_liquidation_last => false::boolean` thì phân giải được hàm. Hàm không được thực thi trong phép kiểm tra này.

## Resolution

- `src/app/(app)/equipment/_hooks/useEquipmentExport.ts`: gửi tường minh `p_liquidation_last: false`, khớp default lịch sử của export.
- `src/app/(app)/equipment/__tests__/useEquipmentExport.full-export.test.ts`: kiểm tra chính xác payload 13 arguments ở cả `regular` và `placed`.

## Verification

- RED trước fix: 2 regression cases fail vì thiếu đúng `p_liquidation_last`.
- GREEN sau fix: 27/27 tests PASS trong 3 file test xuất, không sửa assertion.
- Format, no-explicit-any, diff-only dedupe, typecheck: PASS.
- React Doctor: 92/100, không findings.
- Review: không findings.
- Chạy lại: `node scripts/npm-run.js npx vitest run 'src/app/(app)/equipment/__tests__/useEquipmentExport.full-export.test.ts' 'src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts' 'src/app/(app)/equipment/__tests__/useEquipmentExport.print.test.ts'`.

## Limits

Không thay đổi SQL hoặc ghi live DB. Chưa xác minh tải file bằng trình duyệt production; kết quả GREEN là kiểm thử local, không chứng nhận deployment.
