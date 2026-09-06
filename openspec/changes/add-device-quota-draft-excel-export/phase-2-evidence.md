# Bằng chứng Phase 2 — Workbook Excel danh mục dự thảo

## Phạm vi và ref

- Ngày kiểm tra: 2026-09-06.
- Required base và starting `HEAD`: `0b88ec9e8331c511b35884513d0d262e9af81d7f`.
- Starting review-failed implementation `HEAD`: `ec7652c13d708c00868c704dc3cbfc66cc582db3`.
- Code/sample verification commit (đích của final gate chain): `8cb16c44ed0ed0e695f327e5b8f7450bd845fec1`.
- Forward remediation commits: Cycle 1 Red `050fdf0223605ce4a0017ff39c6b9f7bbf31fdea` / Green `7394067351f64e5a54b473b3c14939bd12af5d37`; Cycle 2 Red `3cb5c0de57178153589a7888f42b1a9e55602587` / Green `3a63f97d04e1df5966389e10db688eaa6028edcb`; Cycle 3 Red `3442ad19c1e6865620f566ec2b74df3734162998` / Green `25e532f3c3bc2a87789e3ce0d058694849155ae4`.
- Post-Green size refactor: `b955c850cb66a775757f927047e6794b5d590e01`; sample regeneration: `8cb16c44ed0ed0e695f327e5b8f7450bd845fec1`.
- Boundary: chỉ builder/module/test/validation helper/sample/evidence/task checkboxes; không nối UI/editor, không RPC/query/mutation/SQL và không thay đổi Phase 3.

## Fixture và baseline

- Fixture dùng trực tiếp `docs/device-quota/source-artifacts/thong-tu-10-2026/manifest.json` và `thong-tu-10-2026-appendix.json`; không parse PDF/Markdown lúc export.
- Manifest xác nhận source PDF SHA-256 `04186bd3cc50cf541f5e481d25480741412cfe3c899040c35713d4eeda24fd8f`, 42 structural rows, 5 sections, 37 items, 3 footnotes và 32 item có quota multiline.
- Baseline trước sửa: `node scripts/npm-run.js run test:run -- src/lib/__tests__/excel-workbook.test.ts` — PASS, 1 file/3 tests, exit 0.

## TDD audit

### Historical implementation run (không tính là ba cycle remediation)

Lịch sử Phase 2 ban đầu chỉ có một Red command và một Green command; không relabel
run này thành ba cycle. Ở implementation commit `f4cacf238fd675fc6feccce5788c82ca04e4891e`,
focused Red có 4 tests, 3 failed, 1 mapper assertion pass, exit 1; sau builder,
focused Green có 1 file/4 tests pass, exit 0. Các cycle dưới đây là ba cycle mới,
tiến hành forward trên `ec7652c1` và được lưu bằng các commit incremental riêng.

### Cycle 1 — cấu trúc/nội dung: source hierarchy validation

- Contract gap hợp lệ: design yêu cầu `parentSourceIdentifier` là input validation
  để bảo đảm hierarchy/coherence, nhưng builder trước remediation chỉ kiểm tra số
  dòng và source order, chấp nhận parent không tồn tại.
- Red test commit: `050fdf0223605ce4a0017ff39c6b9f7bbf31fdea` chỉ thêm assertion
  `rejects incoherent source parent identity before rendering`.
- Red command chính xác: `rtk node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts"`.
- Red expected: snapshot có parent `missing-source-row` phải bị từ chối với
  `Invalid source hierarchy`, không render workbook.
- Red actual: builder vẫn resolve workbook; test này fail, tổng cộng 1 failed/4
  passed trong 5 tests, exit 1 (lỗi hành vi, không phải import/setup).
- Green runtime commit: `7394067351f64e5a54b473b3c14939bd12af5d37` thêm đúng kiểm tra
  parent phải thuộc tập `sourceIdentifier` của snapshot.
- Green command chính xác: cùng focused command ở trên — 1 file/5 tests pass,
  exit 0.

### Cycle 2 — null/zero/excluded: saved quantity validation

- Contract gap hợp lệ: workbook contract quy định `appliedQuantity` là nullable
  non-negative integer; builder trước remediation chỉ giữ nguyên mọi số, nên
  nhận giá trị âm.
- Red test commit: `3cb5c0de57178153589a7888f42b1a9e55602587` chỉ thêm assertion
  `rejects negative saved proposal quantities before rendering` với `-1`.
- Red command chính xác: `rtk node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts"`.
- Red expected: snapshot có `appliedQuantity: -1` phải bị từ chối với
  `Invalid applied quantity`.
- Red actual: builder vẫn resolve workbook; test này fail, tổng cộng 1 failed/5
  passed trong 6 tests, exit 1 (lỗi hành vi, không phải import/setup).
- Green runtime commit: `3a63f97d04e1df5966389e10db688eaa6028edcb` thêm kiểm tra
  mọi item chỉ nhận `null` hoặc số nguyên từ 0 trở lên; null/zero/excluded hiện
  hữu vẫn giữ nguyên semantics.
- Green command chính xác: cùng focused command ở trên — 1 file/6 tests pass,
  exit 0.

### Cycle 3 — layout/serialization: actual column-width row height

- Contract gap hợp lệ theo review P2: row height phải theo width thực tế từng cột;
  code cũ dùng width 32 cho mọi cell ngoài D, dù widths A:G là
  `7,32,13,64,15,14,32`.
- Red test commit: `3442ad19c1e6865620f566ec2b74df3734162998` thêm long value 104
  ký tự vào cột C (width 13) và yêu cầu ít nhất 8 dòng x 15 = 120 points.
- Red command chi tiết chính xác: `rtk proxy node scripts/npm-run.js run test:run -- --reporter verbose "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts" 2>&1`.
- Red expected: chiều cao hàng phải >= 120 để không cắt text khi wrap theo cột C.
- Red actual: Vitest ghi `expected 105 to be greater than or equal to 120`, 1
  failed/5 passed trong 6 tests, exit 1.
- Green runtime commit: `25e532f3c3bc2a87789e3ce0d058694849155ae4` thay estimate
  hard-coded bằng `DEVICE_QUOTA_DRAFT_EXPORT_COLUMN_WIDTHS[index]` cho cả A:G.
- Green command chính xác: `rtk proxy node scripts/npm-run.js run test:run -- --reporter verbose "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts" 2>&1` — 1 file/6 tests pass, exit 0; narrow-column height assertion pass.
- Refactor sau Green: `b955c850cb66a775757f927047e6794b5d590e01` tách
  `device-quota-draft-catalog-excel-export-validation.ts`; focused test chạy lại
  1 file/6 tests pass, exit 0. Module builder còn 301 dòng, helper 58 dòng và
  test 445 dòng; mọi file dưới hard ceiling 450.

## Builder contract đã thực hiện

- `DeviceQuotaDraftCatalogExportSnapshot` là `Readonly` snapshot; mapper chỉ trả tuple bảy cell và chỉ dùng bốn cột source A:D cùng ba cột proposal/notes E:G.
- Builder dùng `createExcelWorkbook` từ `src/lib/excel-workbook.ts`; không sửa `exportToExcel`, không copy helper và không import/call RPC/query/mutation.
- Snapshot validation kiểm tra metadata, 42 rows (5 section/37 item), source order, parent identity coherence, nullable non-negative quantity và 3 non-blank footnotes.
- Workbook có đúng một sheet `Danh mục dự thảo`, metadata A:G rows 1–7, row 8 blank, header row 9 và data từ row 10.
- Source order/hierarchy giữ nguyên 5 section + 37 item; source name/quota multiline đầy đủ; `sourcePages`, `sourceReference`, `parentSourceIdentifier`, `sourceIdentifier`, source order và catalog/PDF identity chỉ được validation/fixture, không render.
- Null applied unit/quantity là blank; zero là numeric `0`; notes giữ text. Excluded row giữ vị trí/values, fill `FFE5E7EB`, strike chỉ E:G và marker `[Đã loại khỏi đề xuất]` không lặp.
- Sau table có một blank row và đúng ba footnote merged A:G. Layout đặt A4 landscape, paper size 9, fit width 1/height 0, repeat row `9:9`, no print area, freeze row 9, widths `7,32,13,64,15,14,32`, wrap/top alignment và dynamic row height theo chính width của từng cột.
- Filename helper khóa mẫu `danh-muc-du-thao-don-vi-23-r4-20260901T083000Z.xlsx`, lấy `lastSavedAt` UTC thay vì thời điểm export.

## Sample artifact read-back

Artifact: `openspec/changes/add-device-quota-draft-excel-export/artifacts/device-quota-draft-export-sample.xlsx`.

Regenerate command: `DEVICE_QUOTA_WRITE_SAMPLE=1 rtk proxy node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts"` — 1 file/6 tests pass, exit 0.

- ExcelJS `readFile` PASS; size 11,457 bytes; SHA-256 `c658456dacae9f318007b2691b860a41dc22cfffc6ee8ab52098c57d137df823`.
- 1 worksheet `Danh mục dự thảo`; row count 55; column count 7; headers đúng thứ tự; 42 data rows gồm 5 section/37 item; source order match `true`.
- Merge count 15 = 7 metadata + 5 section + 3 footnote; blank rows 8 và 52; footnotes row 53–55 đúng source order/text.
- Null row `1a`: E/F `""`; zero row `1b`: E `Máy`, F numeric `0`; excluded row `5a` row 23: gray fill `FFE5E7EB`, A:D not strike, E:G strike, note `Ghi chú cũ [Đã loại khỏi đề xuất]`.
- Print read-back: landscape, paperSize 9, fitToWidth 1, fitToHeight 0, `printTitlesRow: "9:9"`, no print area; view frozen `ySplit:9`, `topLeftCell:A10`, `activeCell:A10`.
- Widths `[7,32,13,64,15,14,32]`; row 11 (source `1a`) height 105; excluded row 23 height 120 after width-aware calculation; Times New Roman 11/13 title, italic lead-in, bold header/thin border và wrapped top alignment được read-back; technical sentinel không xuất hiện trong visible cells.

## Reuse và deduplication evidence

Đã kiểm tra theo thứ tự Code Review Graph → GitNexus → `rg` backstop.

- Code Review Graph incremental check tại review-failed `HEAD` `ec7652c1` báo `No changes detected`, graph up to date; `createExcelWorkbook` và `downloadBlob` đã có trong `src/lib/excel-workbook.ts`; không có caller của module mới cần bảo vệ.
- GitNexus repo `qltbyt-nam-phong` đang index ở base `0b88ec9e`; query tìm thấy các renderer ExcelJS hiện có và shared `createExcelWorkbook`, nhưng index không chứa module remediation mới nên không dùng nó để claim impact caller. `getDeviceQuotaDraftCompleteness` là helper completeness hiện có và được tái sử dụng.
- `rg` backstop xác nhận không có builder draft tương đương; các renderer hiện có tiếp tục dùng `createExcelWorkbook`; `downloadBlob` vẫn là browser seam dành cho Phase 3. Không tạo utility shared mới.

## Gates và scope audit

Final chain chạy trong **một `ctx_batch_execute`**, `concurrency: 1`, trên exact code/sample commit `8cb16c44ed0ed0e695f327e5b8f7450bd845fec1`, đúng thứ tự sau; tất cả exit 0:

1. `rtk node scripts/npm-run.js run format:check` — PASS, exit 0.
2. `rtk node scripts/npm-run.js run verify:no-explicit-any` — PASS, exit 0.
3. `rtk node scripts/npm-run.js run verify:dedupe` — PASS, diff-only, không có SonarJS duplicate-code findings, exit 0.
4. `rtk node scripts/npm-run.js run typecheck` — PASS, exit 0.
5. `rtk node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts" "src/lib/__tests__/excel-workbook.test.ts"` — PASS, 2 files/9 tests, exit 0.
6. `rtk node scripts/npm-run.js run react-doctor` — PASS, diff scan 3 files, score 100/100, no issues, exit 0.

`git diff --check` và Lefthook pre-commit cũng pass cho các commit remediation; module builder còn 301 dòng, validation helper 58 dòng và test 445 dòng, mọi file dưới hard ceiling 450. Không có UI/editor/page/hook/RPC/query/mutation/SQL diff. `downloadBlob` không được gọi vì Phase 2 không có browser download; serializer trả Buffer và để Phase 3 nối `downloadBlob` sau session checks.

Tasks 2.1–2.7 được đánh dấu sau evidence này; mục `2.8 USER REVIEW — Phase 2 approval` vẫn unchecked. Không thay đổi checkbox Phase 3.
