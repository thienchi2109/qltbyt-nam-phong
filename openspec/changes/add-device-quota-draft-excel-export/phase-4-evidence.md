# Bằng chứng Phase 4 — Visual, print và hồi quy coexistence

## Trạng thái

- Status: `DONE_WITH_CONCERNS`.
- Phạm vi thực hiện: chỉ Phase 4.1–4.6; không tick `4.7 USER REVIEW` và
  không thay đổi checkbox Phase 3.5.
- Base/starting `HEAD`: `7dcbfbb67ef144f73398d04451e2e233d1b7bf3e`.
- Exact implementation/gate SHA: `4df2aea2dad41bccc3f40f6d4117141c72f525a0`.
- Ordered final gates trên exact SHA: format `0`, no-explicit-any `0`, dedupe
  `0`, typecheck `0`, focused matrix `6 files / 88 tests` exit `0` (duration
  `18.24s`), React Doctor `100/100` exit `0`, OpenSpec strict valid exit `0`,
  `git diff --check` `0`; working tree clean tại thời điểm run.
- Không có migration, SQL, RPC, live DB write hoặc thay đổi runtime export trong
  lượt này.

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

## Regression evidence — observed / provisional

Lệnh hồi quy năm file chạy lại sau fixture fix:

```text
node scripts/npm-run.js run test:run -- "src/lib/__tests__/excel-workbook.test.ts" "src/lib/__tests__/category-excel.test.ts" "src/lib/__tests__/device-quota-excel.test.ts" "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx" "src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx"
```

Kết quả raw: `Test Files 5 passed (5)`, `Tests 78 passed (78)`, exit `0`, tổng
duration `17.95s`. Đây là `OBSERVED / PROVISIONAL`, không phải acceptance PASS:
Phase 3.5 aggregate/static và USER REVIEW vẫn hard-block change closeout.

### Parent final matrix (exact SHA, observed / provisional)

- Exact SHA: `4df2aea2dad41bccc3f40f6d4117141c72f525a0`.
- Ordered gates: format `0`, no-explicit-any `0`, dedupe `0`, typecheck `0`,
  React Doctor `100/100` exit `0`, OpenSpec strict valid exit `0`, và
  `git diff --check` `0`.
- Focused final matrix: `6 files / 88 tests`, exit `0`, duration `18.24s`.
- Đây là raw observed evidence ở mức provisional; 4.3/4.4 không được coi là
  acceptance PASS khi Phase 3.5 aggregate/static và USER REVIEW còn hard-block.

- `src/lib/__tests__/excel-workbook.test.ts`: observed `3` tests, exit `0`.
- `src/lib/__tests__/category-excel.test.ts`: observed `24` tests, exit `0`.
- `src/lib/__tests__/device-quota-excel.test.ts`: observed `23` tests, exit `0`.
- `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx`:
  observed `2` tests, exit `0`; flow giữ category CRUD/menu, mapping toolbar,
  cả hai entry point import Excel, Save và reopen.
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
acceptance 4.1 vẫn `INCOMPLETE` chờ môi trường/browser của parent.

## Acceptance mapping

| Task | Evidence                                                                                                             | Trạng thái               |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 4.1  | ExcelJS structural print read-back PASS; visual/print renderer unavailable                                           | `INCOMPLETE`             |
| 4.2  | Builder tests + sample row 23 style/marker/source read-back observed                                                 | `OBSERVED / PROVISIONAL` |
| 4.3  | 3 Excel regression files, 50 tests observed exit `0`                                                                 | `OBSERVED / PROVISIONAL` |
| 4.4  | `DeviceQuotaPageCoexistence.integration.test.tsx`, 2 tests observed exit `0`                                         | `OBSERVED / PROVISIONAL` |
| 4.5  | Ordered final TypeScript/React gates observed on exact SHA; Phase 3.5 aggregate/static và USER REVIEW vẫn hard-block | `OBSERVED / PROVISIONAL` |
| 4.6  | This evidence file plus acceptance/evidence updates, pending hard-blocked closeout                                   | `OBSERVED / PROVISIONAL` |
| 4.7  | Explicit USER REVIEW is outside this implementer turn                                                                | `UNCHANGED`              |

## Diff and scope audit

- Changed code/test: one fixture-only identity correction; no reusable helper
  added, so `code-deduplication` does not apply.
- Changed artifact/docs: `acceptance.md` and this Phase 4 evidence file; sample
  workbook was read-only inspected and not rewritten, and `tasks.md` has no
  remaining diff.
- No migration/SQL/RPC/live DB scope; database quality gate is not applicable.
- Parent's ordered final gates and exact SHA are recorded above. Do not convert
  `INCOMPLETE` or provisional observations to PASS from commit existence alone;
  visual inspection/USER REVIEW remain open.
- The current user request authorizes performing Phase 4 verification only; it
  does not retroactively convert Phase 3.5 aggregate/static results or its USER
  REVIEW state into PASS.

## Review gate disposition

- One Important acceptance-gating finding was accepted and fixed by downgrading
  provisional evidence and unticking the affected Phase 4 checkboxes; no second
  reviewer round was run per user instruction.
- Phase 4 verification is authorized and recorded as observed, but Phase 3.5
  aggregate/static and USER REVIEW remain hard-blocked and are not retroactively
  PASS.
