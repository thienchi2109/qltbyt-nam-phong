# Bằng chứng Phase 3 — Tích hợp download vào editor

## Phạm vi và commit

- Phase thực hiện: chỉ tasks 3.1–3.7. Không sửa RPC/API/SQL/migration/grants,
  không ghi live DB, không đổi category/import contract.
- Exact implementation commit: `5c71f61f503d8e90e0e253ef81b859a9d9e9aaee`.
- Implementation gồm 9 file code/test trong draft-catalog hook/page/editor và
  test support; docs/evidence được commit riêng sau khi gate trên exact SHA đã
  pass.

## TDD Red → Green → Refactor

### Red

Focused command đã chạy trước wiring runtime:

```text
node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx"
```

Kết quả Red là failure đúng nguyên nhân contract chưa được nối: toolbar chỉ có
`["Lưu"]` nhưng test yêu cầu `["Xuất Excel", "Lưu"]`; các wait cho export
không hoàn tất và harness timeout, quan sát được 19 failed/5 passed trong 24
cases. Đây là failure hành vi do wiring thiếu, không sửa assertion/spec để né
failure; harness Red lần đó không trả một mã exit số riêng.

### Green và refactor

- Sau khi nối runtime, focused user-event command ở trên pass `1 file / 24
tests`, `EXIT_CODE=0` trên exact implementation SHA.
- Regression matrix cùng scope pass `4 files / 57 tests`, `EXIT_CODE=0`:
  `DeviceQuotaDraftCatalogExport.test.tsx` (24),
  `useDeviceQuotaDraftCatalog.test.tsx` (13),
  `DeviceQuotaDraftCatalogEditor.test.tsx` (10), và
  `device-quota-draft-catalog-excel-export.test.ts` (10).
- Sau Green, fixture factories được tách khỏi user-event matrix thành
  `DeviceQuotaDraftCatalogExportTestSupport.ts`; matrix còn 292 dòng, support
  68 dòng. Việc tách không thay đổi test contract.

## User-event matrix

File: `src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx`

| Nhóm contract                                                                                 | Số case | Bằng chứng                                                              |
| --------------------------------------------------------------------------------------------- | ------: | ----------------------------------------------------------------------- |
| `global`, `admin`, `to_qltb`; current session unit; action ngay trước Save; đúng một download |       3 | Builder nhận snapshot unit hiện tại; Save không bị gọi                  |
| Role không được phép (`guest`, `analyst`)                                                     |       2 | Action ẩn; không gọi builder/download                                   |
| Read-only                                                                                     |       1 | Action ẩn; không chuẩn bị export                                        |
| Dirty, save/exclude/restore/recover pending, missing snapshot                                 |       6 | Action hiện nhưng disabled; không builder/download                      |
| Branding missing/mismatched/blank                                                             |       3 | Disabled, status tiếng Việt, retry branding; không builder/download     |
| Export đang pending                                                                           |       1 | Duplicate click không tạo generation/download thứ hai                   |
| Builder error và download error                                                               |       2 | Status `Không thể xuất file Excel. Vui lòng thử lại.`, retry thành công |
| User/unit/snapshot identity đổi khi builder pending                                           |       3 | Abort stale path trước `downloadBlob`; không tải Blob cũ                |
| Thiếu `userId` hoặc unit không hợp lệ                                                         |       2 | Action ẩn; không context/builder/download                               |
| `current_don_vi ?? don_vi` và branding options                                                |       1 | Ưu tiên `current_don_vi`; gọi `useTenantBranding` với unit hiện tại     |
| **Tổng**                                                                                      |  **24** | **24/24 pass**                                                          |

Không có refetch, Save/mutation hoặc RPC mới trong click export; test kiểm tra
trực tiếp `save`/`retry` không bị gọi và chỉ mock builder/download được phép
chạy.

## Coherence và implementation seam

- `useDeviceQuotaDraftCatalog` tạo export context từ accepted server draft/catalog
  snapshot. `revision` và `updated_at` lấy từ saved server response; rows là
  `lastSavedRows` merge từ server/catalog, không phải local staged rows.
- Catalog version, source metadata và footnotes đi cùng snapshot catalog. Test
  hook coherence chứng minh staged row thay đổi không làm thay đổi rows/revision
  trong export context; hook suite pass 13/13.
- Page gọi chính xác
  `useTenantBranding({ formTenantId: snapshot.unitId, useFormContext: true })`
  và chỉ nhận branding khi id khớp và tên sau `trim()` không rỗng.
- Role/unit gate giữ access helper hiện hữu (`isEquipmentManagerRole`, có
  normalization `global`/`admin`/`to_qltb`), authenticated user id và unit số
  dương; thiếu identity fail closed.
- Editor điều phối action qua `HierarchicalEditorToolbar.actions`, đặt ngay
  trước Save, giữ mutation state/Save hiện hữu. Không sửa shared toolbar.
- Hook export giữ một-download lock, stale identity check trước Blob và trước
  `downloadBlob`, mounted guard và retryable Vietnamese error state.

## Reuse và graph/dedupe review

- Code Review Graph đã current tại base
  `f22d2f58bcfe7d023d351999eee892ba24c5050e`; GitNexus cũng index cùng exact
  base; `rg` kiểm tra các seam liên quan trước khi thêm code.
- Reuse `createExcelWorkbook` và `downloadBlob` hiện hữu. Builder/context vẫn
  domain-local vì contract draft/catalog là đặc thù; không thêm domain flag vào
  generic helper, không tạo duplicate shared hook/service. `verify:dedupe` và
  pre-commit semantic review đều không phát hiện trùng lặp.

## File-size và scope audit

Tất cả source/test file Phase 3 dưới hard ceiling 450 dòng:

| File                                                 | Dòng |
| ---------------------------------------------------- | ---: |
| `useDeviceQuotaDraftCatalog.ts`                      |  356 |
| `DeviceQuotaDraftCatalogEditor.tsx`                  |  327 |
| `DeviceQuotaDraftCatalogPageClient.tsx`              |  145 |
| `useDeviceQuotaDraftCatalogExport.ts`                |  139 |
| `device-quota-draft-catalog-excel-export-context.ts` |   65 |
| `device-quota-draft-catalog-excel-export.ts`         |  312 |
| `DeviceQuotaDraftCatalogExport.test.tsx`             |  292 |
| `DeviceQuotaDraftCatalogExportTestSupport.ts`        |   68 |

## Full gate trên exact implementation SHA

Tất cả command chạy tuần tự trong **một** `ctx_batch_execute`,
`concurrency: 1`, trên `5c71f61f503d8e90e0e253ef81b859a9d9e9aaee`:

| Thứ tự | Command                                                                           |                                                                             Exit |
| -----: | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------: |
|      1 | `node scripts/npm-run.js run format:check`                                        |                                                                              `0` |
|      2 | `node scripts/npm-run.js run verify:no-explicit-any`                              |                                                                              `0` |
|      3 | `node scripts/npm-run.js run verify:dedupe`                                       |                                                                              `0` |
|      4 | `node scripts/npm-run.js run typecheck`                                           |                                                                              `0` |
|      5 | focused `DeviceQuotaDraftCatalogExport.test.tsx`                                  |                                                                      `0` — 24/24 |
|      6 | `node scripts/npm-run.js run react-doctor`                                        | `0` — score 93/100; còn 2 cảnh báo maintainability về complexity, không có error |
|      7 | `openspec validate add-device-quota-draft-excel-export --strict --no-interactive` |                                                                              `0` |
|      8 | `git diff --check`                                                                |                                                                              `0` |

Regression matrix 4 file ở trên cũng chạy `EXIT_CODE=0`; có warning `act(...)`
đã tồn tại trong một số hook test, không làm fail test.

## Trạng thái checkbox và user review

- Đã tick **chỉ** tasks `3.1`–`3.7` trong `tasks.md`.
- `3.8 USER REVIEW — Phase 3 approval` vẫn unchecked.
- Acceptance Phase 3 đã tick đúng ba mục có evidence: user-event Red→Green,
  snapshot/branding coherence, và required gates.
- Acceptance `USER REVIEW — Phase 3 approval` vẫn unchecked.
- Toàn bộ Phase 4 vẫn unchecked; không thực hiện visual/print closeout.
- Không có live write/database/API/RPC change trong Phase 3.
