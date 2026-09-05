# Bằng chứng Phase 2 — Workbook Excel danh mục dự thảo

## Phạm vi và ref

- Ngày kiểm tra: 2026-09-05.
- Required base và starting `HEAD`: `0b88ec9e8331c511b35884513d0d262e9af81d7f`.
- Verification tree trước commit implementation: `c521c63c2fde0eabf1a4bc3f41c31dcd4b1217d7` (`git write-tree` sau khi stage module, test và sample).
- Implementation commit (module, test và sample): `f4cacf238fd675fc6feccce5788c82ca04e4891e`; không push/merge.
- Boundary: chỉ builder/module/test/sample/evidence/task checkboxes; không nối UI/editor, không RPC/query/mutation/SQL.

## Fixture và baseline

- Fixture dùng trực tiếp `docs/device-quota/source-artifacts/thong-tu-10-2026/manifest.json` và `thong-tu-10-2026-appendix.json`; không parse PDF/Markdown lúc export.
- Manifest xác nhận source PDF SHA-256 `04186bd3cc50cf541f5e481d25480741412cfe3c899040c35713d4eeda24fd8f`, 42 structural rows, 5 sections, 37 items, 3 footnotes và 32 item có quota multiline.
- Baseline trước sửa: `node scripts/npm-run.js run test:run -- src/lib/__tests__/excel-workbook.test.ts` — PASS, 1 file/3 tests, exit 0.

## TDD Red → Green

Test bắt hành vi sau khi có snapshot fixture hợp lệ; không có test chỉ chứng minh module chưa tồn tại.

- Red focused command: `node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts"`.
- Red runtime là scaffold tối thiểu không render contract, không phải lỗi import/setup: 4 tests, 3 failed, 1 mapper assertion pass (exit 1).
  - Cấu trúc/nội dung: workbook không có sheet đúng tên/7 cột/metadata/42 rows/footnotes; assertion nhận worksheet undefined.
  - Null/zero/excluded: proposal null phải serialize thành blank nhưng scaffold trả `null`; excluded marker/style chưa tồn tại.
  - Layout/serialization: scaffold không có page setup/freeze/width/style contract nên assertion layout failed.
- Green focused command: cùng test path sau builder — PASS, 1 file/4 tests, exit 0.
- Regression focused command: `node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts" "src/lib/__tests__/excel-workbook.test.ts"` — PASS, 2 files/7 tests, exit 0.

## Builder contract đã thực hiện

- `DeviceQuotaDraftCatalogExportSnapshot` là `Readonly` snapshot; mapper chỉ trả tuple bảy cell và chỉ dùng bốn cột source A:D cùng ba cột proposal/notes E:G.
- Builder dùng `createExcelWorkbook` từ `src/lib/excel-workbook.ts`; không sửa `exportToExcel`, không copy helper và không import/call RPC/query/mutation.
- Workbook có đúng một sheet `Danh mục dự thảo`, metadata A:G rows 1–7, row 8 blank, header row 9 và data từ row 10.
- Source order/hierarchy giữ nguyên 5 section + 37 item; source name/quota multiline đầy đủ; `sourcePages`, `sourceReference`, `parentSourceIdentifier`, `sourceIdentifier`, source order và catalog/PDF identity chỉ được validation/fixture, không render.
- Null applied unit/quantity là blank; zero là numeric `0`; notes giữ text. Excluded row giữ vị trí/values, fill `FFE5E7EB`, strike chỉ E:G và marker `[Đã loại khỏi đề xuất]` không lặp.
- Sau table có một blank row và đúng ba footnote merged A:G. Layout đặt A4 landscape, paper size 9, fit width 1/height 0, repeat row `9:9`, no print area, freeze row 9, widths `7,32,13,64,15,14,32`, wrap/top alignment và dynamic row height.
- Filename helper khóa mẫu `danh-muc-du-thao-don-vi-23-r4-20260901T083000Z.xlsx`, lấy `lastSavedAt` UTC thay vì thời điểm export.

## Sample artifact read-back

Artifact: `openspec/changes/add-device-quota-draft-excel-export/artifacts/device-quota-draft-export-sample.xlsx`.

- ExcelJS `readFile` PASS; size 11,458 bytes; SHA-256 `69886fb6986695545359ca3a1152293f29592f4c15e800a3758ea64e21e2589a`.
- 1 worksheet `Danh mục dự thảo`; row count 55; column count 7; headers đúng thứ tự; 42 data rows gồm 5 section/37 item; source order match `true`.
- Merge count 15 = 7 metadata + 5 section + 3 footnote; blank rows 8 và 52; footnotes row 53–55 đúng source order/text.
- Null row `1a`: E/F `""`; zero row `1b`: E `Máy`, F numeric `0`; excluded row `5a`: gray fill, A:D not strike, E:G strike, note `Ghi chú cũ [Đã loại khỏi đề xuất]`.
- Print read-back: landscape, paperSize 9, fitToWidth 1, fitToHeight 0, `printTitlesRow: "9:9"`, no print area; view frozen `ySplit:9`, `topLeftCell:A10`, `activeCell:A10`.
- Widths, Times New Roman 11/13 title, italic lead-in, bold header/thin border, wrapped top alignment và multiline height được read-back; technical sentinel không xuất hiện trong visible cells.

## Reuse và deduplication evidence

Đã kiểm tra theo thứ tự Code Review Graph → GitNexus → `rg` backstop.

- Code Review Graph full build ở exact base: 2,583 files, 17,456 nodes, 203,498 edges, errors 0. `createExcelWorkbook` và `downloadBlob` đã có trong `src/lib/excel-workbook.ts`; không có builder draft tương đương. Impact của file mới khi còn untracked trả `target not indexed`, nên không dùng kết quả đó để khẳng định callers.
- GitNexus repo `qltbyt-nam-phong` đã index ở base; query tìm thấy các renderer ExcelJS hiện có và shared `createExcelWorkbook`. Impact shared helper là CRITICAL (18 upstream impacted), nên helper không bị sửa; module chỉ gọi seam hiện có. `getDeviceQuotaDraftCompleteness` là helper completeness hiện có và được tái sử dụng.
- `rg` backstop xác nhận không có `device-quota-draft-catalog-excel-export`/builder tương đương; các renderer hiện có tiếp tục dùng `createExcelWorkbook`; `downloadBlob` vẫn là browser seam dành cho Phase 3.
- Giới hạn: graph/GitNexus index ban đầu ở base không chứa file untracked mới; đây là lý do evidence dùng `rg` cho cross-file duplicate và không claim impact caller của module mới.

## Gates và scope audit

Chuỗi bắt buộc chạy một `ctx_batch_execute`, đúng thứ tự và có exit code:

1. `format:check` — exit 0.
2. `verify:no-explicit-any` — exit 0.
3. `verify:dedupe` — exit 0; diff-only SonarJS, không chạy full-repo scan.
4. `typecheck` — exit 0.
5. Focused Vitest (Phase 2 + `src/lib/__tests__/excel-workbook.test.ts`) — exit 0, 2 files/7 tests.
6. `react-doctor` — exit 0; script báo không có changed source để scan trước commit vì implementation còn staged/uncommitted, không coi đây là full React scan.

Line count sau Prettier: module 322 dòng, test 403 dòng; module dưới ngưỡng extraction 350 và cả hai dưới hard ceiling 450. Không có UI/editor/page/hook/RPC/query/mutation/SQL diff. `downloadBlob` không được gọi vì Phase 2 không có browser download; serializer trả Buffer và để Phase 3 nối `downloadBlob` sau session checks.

Tasks 2.1–2.7 được đánh dấu sau evidence này; mục `2.8 USER REVIEW — Phase 2 approval` vẫn unchecked. Không thay đổi checkbox Phase 3.
