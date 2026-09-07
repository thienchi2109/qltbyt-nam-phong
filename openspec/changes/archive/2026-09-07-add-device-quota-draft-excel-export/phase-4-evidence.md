# Bằng chứng Phase 4 — Visual, print và hồi quy coexistence

## Trạng thái

- Status: `COMPLETE` — Phase 4 được explicit approve để land với maintainer
  waiver cho print renderer độc lập không khả dụng.
- Phạm vi thực hiện: Phase 4.1–4.7; toàn bộ checkbox Phase 4 đã tick. Không
  thay đổi checkbox Phase 3.5; Phase 3.5 vẫn unchecked và không phải PASS.
- Base/starting `HEAD`: `7dcbfbb67ef144f73398d04451e2e233d1b7bf3e`.
- Historical exact implementation/gate SHA: `4df2aea2dad41bccc3f40f6d4117141c72f525a0`
  (preserved below for traceability).
- Current exact implementation/gate SHA:
  `ac702788beb615014a7e5809ce10957da3d9223a`.
- Ordered final gates trên current exact SHA: format `0`, no-explicit-any `0`,
  dedupe `0`, typecheck `0`, focused matrix `6 files / 88 tests` exit `0`
  (duration `16.93s`), React Doctor `100/100` exit `0`, OpenSpec strict valid
  exit `0`, `git diff --check` `0`; working tree clean tại thời điểm run.
- Không có migration, SQL, live DB write hoặc thay đổi production runtime trong
  lượt này. `callRpc` chỉ được mock/capture trong coexistence test để khóa
  payload; không có RPC mutation thật.

## Red diagnosis và minimal Green

### Red ban đầu

Lệnh tái hiện nhóm năm file:

```text
node scripts/npm-run.js run test:run -- "src/lib/__tests__/excel-workbook.test.ts" "src/lib/__tests__/category-excel.test.ts" "src/lib/__tests__/device-quota-excel.test.ts" "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx" "src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx"
```

Kết quả trước sửa là `Test Files 1 failed | 4 passed`, `Tests 1 failed | 77
passed`, exit `1`. Failure xuất hiện như timeout mặc định `5000ms` tại
`DeviceQuotaPageCoexistence.integration.test.tsx:197`.

Chẩn đoán không nới timeout/assertion:

```text
node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx" --testTimeout=20000 --reporter verbose
```

Với timeout chẩn đoán dài hơn, test thực sự hoàn tất sau khoảng `5.19s` và
không bị treo; failure hành vi được lộ rõ ở `waitFor` line 260 vì không tìm
thấy `Máy X quang`. Nguyên nhân là fixture coexistence không còn khớp contract
strict catalog identity của Phase 3.5: `draft.catalog_version_id` dùng
`catalog-1`, còn `catalog_version.id` bị thiếu; kể cả khi thêm field, giá trị
đó vẫn không phải UUID hợp lệ nên `rows` bị fail-closed thành rỗng.

### Minimal Green

Chỉ cập nhật fixture tại
`src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx`:

- thêm `catalog_version.id`;
- dùng cùng canonical UUID hợp lệ cho `draft.catalog_version_id` và
  `catalog_version.id`.

Không thay đổi guard, timeout, assertion hay production runtime code.

Focused Green diagnostic:

```text
node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx" --testTimeout=20000 --reporter verbose
```

Kết quả: `1 file / 2 tests PASS`, exit `0`, test chính `3050ms`.

Focused Green mặc định (không override timeout):

```text
node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx"
```

Kết quả: `1 file / 2 tests PASS`, exit `0`, test chính `2725ms`.

### Finding 4.4 — coexistence test Red → Green

Sau khi thêm desired user-event assertions, Red được tái hiện khi test còn
dùng placeholder `SuggestedMappingPreviewDialog` cũ (chỉ render một `div`,
không drive/capture dialog thật):

```text
node scripts/npm-run.js run test:run -- --reporter=verbose "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx"
```

Kết quả Red: exit `1`, `Test Files 1 failed (1)`, `Tests 1 failed | 1 passed
(2)`, `TestingLibraryElementError: Unable to find role="dialog"` sau khi
click `Gợi ý phân loại hàng loạt`. Đây là failure của harness chưa expose
interaction cần kiểm chứng, không phải test giả định feature thiếu trong
runtime.

Green tối thiểu giữ test trong cùng file: bỏ placeholder dialog, mock hook
`useSuggestMapping` với một suggested group và spy `saveBatch`, mock
`readExcelFile`/`worksheetToJson` bằng một row có quota, rồi drive toàn bộ
user-event flow. Test khóa các bằng chứng sau:

- `admin` thấy `Tạo danh mục`, menu `Sửa`/`Xóa`, `Gợi ý phân loại hàng loạt`,
  hai nút import và draft route; mapping dialog hiển thị `Gợi ý phân loại
thiết bị`, click `Áp dụng 1 gợi ý phân loại` gọi đúng
  `saveBatch([{ nhom_id: 1, thiet_bi_ids: [101] }])`.
- Upload một file `.xlsx` với `Ma nhom=G2`, `Ten nhom=Nhóm siêu âm`,
  `Dinh muc=5`, `Toi thieu=1`, rồi click `Nhập (1)` gọi đúng
  `dinh_muc_nhom_bulk_import` với `p_don_vi=1` và row đầy đủ; đồng thời gọi
  `dinh_muc_unified_import` với
  `[{ ma_nhom: "G2", so_luong_dinh_muc: 5, so_luong_toi_thieu: 1 }]`.
- Click `Nhập định mức từ file Excel` gọi `openImportDialog` đúng một lần;
  draft Save khóa đầy đủ `p_draft_id`, `p_expected_revision=1` và item
  payload, sau đó reopen đọc lại quantity `3`.
- `technician` không thấy category CRUD/import, mapping bulk action hoặc draft
  route; đây là negative manager-authorization assertion.

Focused Green sau khi tháo placeholder và giữ setup tối thiểu:

```text
node scripts/npm-run.js run test:run -- --reporter=verbose "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx"
```

Kết quả: exit `0`, `Test Files 1 passed (1)`, `Tests 2 passed (2)`, duration
`6.37s` (test execution `3.18s`).

## Regression evidence — observed and approved

Lệnh hồi quy focused sáu file chạy trên current finding-fix worktree:

```text
node scripts/npm-run.js run test:run -- "src/lib/__tests__/excel-workbook.test.ts" "src/lib/__tests__/category-excel.test.ts" "src/lib/__tests__/device-quota-excel.test.ts" "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx" "src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx" "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts"
```

Kết quả trên current exact SHA: `Test Files 6 passed (6)`, `Tests 88 passed
(88)`, exit `0`, duration `16.93s`. Đây là evidence regression đã được duyệt
trong phạm vi Phase 4; không hạ kết quả thành provisional vì Phase 3.5 không
nằm trong phạm vi acceptance này.

### Historical parent final matrix (exact SHA, preserved)

- Exact SHA: `4df2aea2dad41bccc3f40f6d4117141c72f525a0`.
- Ordered gates: format `0`, no-explicit-any `0`, dedupe `0`, typecheck `0`,
  React Doctor `100/100` exit `0`, OpenSpec strict valid exit `0`, và
  `git diff --check` `0`.
- Focused final matrix: `6 files / 88 tests`, exit `0`, duration `18.24s`.
- Đây là evidence lịch sử được giữ để trace exact SHA; chứng nhận current exact
  SHA và kết quả final gates được ghi ở phần Trạng thái.

- `src/lib/__tests__/excel-workbook.test.ts`: observed `3` tests, exit `0`.
- `src/lib/__tests__/category-excel.test.ts`: observed `24` tests, exit `0`.
- `src/lib/__tests__/device-quota-excel.test.ts`: observed `23` tests, exit `0`.
- `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx`:
  current `2` tests, exit `0`; user-event drive category CRUD/menu, mapping
  dialog + exact `saveBatch`, cả hai import entry points + exact category and
  unified import payloads, manager authorization, Save và reopen.
- `src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx`:
  observed `26` tests, exit `0`; các guard export hiện hữu không bị ảnh hưởng.
- `src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts`:
  observed `10` tests, exit `0`; layout và builder được kiểm tra.

## Sample artifact và workbook read-back

Artifact được kiểm tra là
`openspec/changes/add-device-quota-draft-excel-export/artifacts/device-quota-draft-export-sample.xlsx`.
SHA-256 hiện tại:
`3bb72b74b02038f4e5360c21dcb94eacdee5da45c2b6830ef657d6076bf8707b`;
size `11,457` bytes.

Lệnh read-back bằng ExcelJS đã đối chiếu trực tiếp sample với
`thong-tu-10-2026-appendix.json`, kết quả `sourceRows=42` và
`mismatchCount=0`. Read-back xác nhận:

- một worksheet `Danh mục dự thảo`, `columnCount=7`, `rowCount=55`, header row
  9 đúng thứ tự bảy cột;
- 42 data rows gồm 5 section và 37 item; source order, tên, đơn vị và quota
  multiline khớp source JSON; 32 item có quota multiline;
- ba footnotes nằm ở rows 53–55, đúng thứ tự/nguyên văn; merge count `15`
  gồm metadata, section và footnotes; không có hidden column;
- `paperSize=9`, `orientation=landscape`, `fitToPage=true`, `fitToWidth=1`,
  `fitToHeight=0`, `printTitlesRow="9:9"`, freeze `ySplit=9`/`topLeftCell=A10`,
  và không có print area;
- row source `1a` có wrap ở cột quota và height `105`; các row multiline được
  tính dynamic height; null/zero/excluded semantics đã được khóa bởi focused
  builder tests;
- excluded source `5a` tại worksheet row `23` giữ source cells không strike,
  proposal cells E:G strike, toàn row fill `FFE5E7EB`, note giữ
  `Ghi chú cũ [Đã loại khỏi đề xuất]` đúng một marker;
- metadata rows 1–7 giữ title, tên đơn vị, draft status, revision và saved
  timestamp; technical source identity không xuất hiện trong visible cells.

## Visual/print limitation

Structural `pageSetup`, wrap, row height và artifact read-back đã được quan sát.
Tuy nhiên, môi trường worktree không có `libreoffice` hoặc `soffice`, và lượt này
không có browser/Excel print-preview renderer để mở/in sample thực tế. Vì vậy
không claim rằng title/footnotes/multiline text không bị cắt khi print; visual
acceptance 4.1 được ghi là structural PASS với explicit maintainer
acceptance/waiver ngày 2026-09-07 cho renderer không khả dụng. Đây là residual
concern đã được duyệt để land, không phải bằng chứng independent render.

## Acceptance mapping

| Task | Evidence                                                                                                              | Trạng thái               |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 4.1  | ExcelJS structural print read-back PASS; independent renderer unavailable and explicitly waived, no no-clipping claim | `PASS WITH PRINT WAIVER` |
| 4.2  | Builder tests + sample row 23 style/marker/source read-back PASS                                                      | `PASS`                   |
| 4.3  | 3 Excel regression files included in current 6-file matrix, exit `0`                                                  | `PASS`                   |
| 4.4  | Coexistence 2 tests: exact mapping/import/save payloads and manager authorization, exit `0`                           | `PASS`                   |
| 4.5  | Ordered format/no-any/dedupe/typecheck, 6-file matrix, React Doctor, OpenSpec và diff check PASS trên `ac702788`      | `PASS`                   |
| 4.6  | Acceptance and this evidence updated with structural limitation and exact interaction/payload records                 | `PASS`                   |
| 4.7  | Explicit USER REVIEW approval on 2026-09-07 authorizes waiver and direct land                                         | `APPROVED`               |

## Diff and scope audit

- Changed test: `DeviceQuotaPageCoexistence.integration.test.tsx` now replaces
  the placeholder mapping dialog with a minimal hook/import harness, drives
  mapping and both import interactions, captures exact payloads, and asserts
  manager authorization. The file remains below the 450-line ceiling; no
  reusable helper was added, so `code-deduplication` does not apply.
- Changed docs: `tasks.md`, `acceptance.md` and this Phase 4 evidence file;
  sample workbook was read-only inspected and not rewritten.
- No migration/SQL/live DB scope and no production RPC/runtime changes;
  database quality gate is not applicable. Mocked `callRpc` assertions are
  test evidence only.
- Historical exact-SHA evidence and current focused matrix are recorded above;
  current exact SHA `ac702788beb615014a7e5809ce10957da3d9223a` is certified.
  The print-renderer waiver is explicit and does not claim independent
  rendering/no-clipping.
- Phase 3.5 checkboxes and status remain unchanged/unchecked and are not
  retroactively converted to PASS.

## Review gate disposition

- The Phase 4.4 finding (workspace evidence claimed mapping support while the
  coexistence test only used a placeholder dialog) was fixed by test-only
  user-event coverage and exact payload/authorization assertions; no runtime
  refactor was needed.
- The residual Phase 4.1 limitation is the unavailable independent print
  renderer. The maintainer/user explicitly accepted that waiver on 2026-09-07,
  so Phase 4 is approved for direct land with `COMPLETE` status.
- Phase 3.5 aggregate/static and USER REVIEW remain unchanged and are not
  retroactively PASS.
