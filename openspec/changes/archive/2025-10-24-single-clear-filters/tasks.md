## 1. Implementation
- [x] Make FilterChips onClearAll optional and hide if not provided
- [x] Remove chips onClearAll usage from page; keep single toolbar clear
- [x] Clear handler resets: table column filters, uiFilters, search, facility to null (all)

## 2. Validation & QA
- [x] After clicking "Xóa", list shows all results for the current user scope (tenant/region)
- [x] Chips disappear; facility dropdown shows "Tất cả" if available
- [x] Typecheck passes