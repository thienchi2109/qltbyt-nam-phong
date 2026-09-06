# Bằng chứng Phase 2 — Workbook Excel danh mục dự thảo

## Phạm vi và ref

- Ngày kiểm tra: 2026-09-06.
- Required base và starting `HEAD`: `0b88ec9e8331c511b35884513d0d262e9af81d7f`.
- Starting review-failed implementation `HEAD`: `ec7652c13d708c00868c704dc3cbfc66cc582db3`.
- Code/sample verification commit (đích của final gate chain): `7a398fc1c72516ef55354d0cf71241816d68dcb9`.
- Forward remediation commits: Cycle 1 Red `050fdf0223605ce4a0017ff39c6b9f7bbf31fdea` / Green `7394067351f64e5a54b473b3c14939bd12af5d37`; Cycle 2 Red `3cb5c0de57178153589a7888f42b1a9e55602587` / Green `3a63f97d04e1df5966389e10db688eaa6028edcb`; Cycle 3 Red `3442ad19c1e6865620f566ec2b74df3734162998` / Green `25e532f3c3bc2a87789e3ce0d058694849155ae4`.
- Post-Green size refactor: `b955c850cb66a775757f927047e6794b5d590e01`; sample regeneration: `8cb16c44ed0ed0e695f327e5b8f7450bd845fec1`.
- Focused review-fix commits: browser serialization Red `2ab57cb9e9a509068d48278d984ebd62a68e48d9` / Green `ecad87759cbdab2e54fe693388dee1d462e3a4f1`; merged-section height Red `fb4a3d4e56233589431a8fd9176a5d1e52c8da40` / Green `577e344f5906d14a630a05ad76cbea26a56e6466`; post-Green fixture refactor `80e89031`; deterministic metadata Red `2c35c5938595b67cdfbdde82f1623b28a4343c33` / Green `23fa3e0be3e69b153419cd02313e6b3f4c28f2b2`; sample archive normalization `ff0787b02848ab12a883e9ed10c2bcc3fe5f07b0`; canonical sample `7a398fc1c72516ef55354d0cf71241816d68dcb9`.
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

### Focused review-fix cycles — browser serialization and merged sections

Hai contract gap dưới đây được phát hiện bởi focused review sau ba cycle
remediation trước. Mỗi gap được làm theo một Red → Green cycle mới bằng commit
incremental riêng; không relabel các run lịch sử.

#### Review fix 1 — browser-compatible serialization

- Contract gap hợp lệ: Phase 3 sẽ import builder vào client bundle, vì vậy
  serializer không được phụ thuộc `Buffer.from`; payload trả về phải dùng được
  trực tiếp làm browser bytes.
- Red test commit: `2ab57cb9e9a509068d48278d984ebd62a68e48d9` thêm assertion
  `serializes without requiring Node Buffer.from`, spy chỉ chặn nhánh
  `Buffer.from` nhận Buffer để giữ lỗi là lỗi hành vi runtime.
- Red command chính xác:
  `rtk proxy node scripts/npm-run.js run test:run -- --reporter verbose "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts" 2>&1`.
- Red expected: serializer resolve một `Uint8Array` browser-compatible ngay cả
  khi `Buffer.from` không khả dụng.
- Red actual: Vitest báo `promise rejected "Error: Buffer.from unavailable" instead of resolving`,
  1 failed/6 passed trong 7 tests, exit 1; failure xảy ra sau khi test đã
  render workbook nên không phải import/setup/type error.
- Green runtime commit: `ecad87759cbdab2e54fe693388dee1d462e3a4f1` trả trực
  tiếp bytes từ `writeBuffer()` qua `Uint8Array`, bỏ `Buffer.from` khỏi module
  production.
- Green command chính xác (cùng command trên): 1 file/7 tests pass, exit 0.

#### Review fix 2 — dynamic height for merged section rows

- Contract gap hợp lệ: section label dài là nội dung hợp lệ; merged A:G row
  phải tính wrapped height theo tổng width hiệu dụng, không được fixed-height
  override. Code cũ luôn ghi đè `row.height = 24`.
- Red test commit: `fb4a3d4e56233589431a8fd9176a5d1e52c8da40` thêm section label
  dài 400 ký tự và assertion height theo combined A:G widths.
- Red command chính xác:
  `rtk proxy node scripts/npm-run.js run test:run -- --reporter verbose "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts" 2>&1`.
- Red expected: merged section row phải có height tối thiểu 45 points (3 dòng
  theo tổng width 179).
- Red actual: Vitest báo `expected 24 to be greater than or equal to 45`,
  1 failed/7 passed trong 8 tests, exit 1; đây là lỗi height runtime thực sự.
- Green runtime commit: `577e344f5906d14a630a05ad76cbea26a56e6466` tính
  merged width từ A:G cộng 2 points padding, dùng `Math.max(24, computedHeight)`
  và không còn ghi đè một height lớn hơn do nội dung.
- Green command chính xác (cùng command trên): 1 file/8 tests pass, exit 0;
  long-section height assertion pass.
- Refactor sau Green: `80e89031` tách fixture/read-back helpers sang
  `device-quota-draft-catalog-excel-export.test-support.ts`; focused test chạy
  lại 1 file/8 tests pass, exit 0. Các file hiện tại lần lượt là builder 303,
  validation helper 58, test 319 và support 184 dòng, đều dưới hard ceiling 450.

#### Deterministic sample archive stabilization

- Sau khi Green, repeated sample writes cho cùng snapshot cho cùng worksheet
  XML nhưng khác hash vì JSZip ghi DOS timestamps hiện tại vào ZIP headers.
  Hai run trước khi canonicalize đều exit 0 nhưng hash khác nhau:
  `85aca6df2fe6b318bd7b3516a3aa1dffb309b5161f8906c2d7dddea8c583e624` và
  `3be9c0883e26fa15079fbb1e47d0c988b9cb85ccb874e83aab978f084743c7bc`.
- Test `pins workbook metadata to the saved snapshot time for deterministic
serialization` được Red trước tại commit `2c35c5938595b67cdfbdde82f1623b28a4343c33`: cùng focused command
  verbose ở trên báo `expected 2026-09-06T01:53:41.966Z to deeply equal
2026-09-01T08:30:00.000Z`, 1 failed/8 passed trong 9 tests, exit 1.
- Green runtime commit `23fa3e0be3e69b153419cd02313e6b3f4c28f2b2` pin `workbook.created` và `workbook.modified`
  theo `snapshot.lastSavedAt`; cùng command pass 1 file/9 tests, exit 0.
- Post-Green artifact contract commit `ff0787b02848ab12a883e9ed10c2bcc3fe5f07b0` canonicalize mọi ZIP entry
  date về `2000-01-01T00:00:00Z` trong test-only sample writer. Assertion
  `normalizes sample archive timestamps for stable repeated writes` pass; focused
  test pass 1 file/10 tests, exit 0. Cách này chỉ ổn định artifact mẫu, không
  thêm UI/download hoặc đổi browser serializer contract.

## Builder contract đã thực hiện

- `DeviceQuotaDraftCatalogExportSnapshot` là `Readonly` snapshot; mapper chỉ trả tuple bảy cell và chỉ dùng bốn cột source A:D cùng ba cột proposal/notes E:G.
- Builder dùng `createExcelWorkbook` từ `src/lib/excel-workbook.ts`; không sửa `exportToExcel`, không copy helper và không import/call RPC/query/mutation.
- Snapshot validation kiểm tra metadata, 42 rows (5 section/37 item), source order, parent identity coherence, nullable non-negative quantity và 3 non-blank footnotes.
- Workbook có đúng một sheet `Danh mục dự thảo`, metadata A:G rows 1–7, row 8 blank, header row 9 và data từ row 10.
- Source order/hierarchy giữ nguyên 5 section + 37 item; source name/quota multiline đầy đủ; `sourcePages`, `sourceReference`, `parentSourceIdentifier`, `sourceIdentifier`, source order và catalog/PDF identity chỉ được validation/fixture, không render.
- Null applied unit/quantity là blank; zero là numeric `0`; notes giữ text. Excluded row giữ vị trí/values, fill `FFE5E7EB`, strike chỉ E:G và marker `[Đã loại khỏi đề xuất]` không lặp.
- Sau table có một blank row và đúng ba footnote merged A:G. Layout đặt A4 landscape, paper size 9, fit width 1/height 0, repeat row `9:9`, no print area, freeze row 9, widths `7,32,13,64,15,14,32`, wrap/top alignment và dynamic row height theo chính width của từng cột; section merge dùng combined A:G width cộng padding và minimum hợp lý.
- Filename helper khóa mẫu `danh-muc-du-thao-don-vi-23-r4-20260901T083000Z.xlsx`, lấy `lastSavedAt` UTC thay vì thời điểm export.

## Sample artifact read-back

Artifact: `openspec/changes/add-device-quota-draft-excel-export/artifacts/device-quota-draft-export-sample.xlsx`.

Regenerate command (one intentional final write): `DEVICE_QUOTA_WRITE_SAMPLE=1 rtk proxy node scripts/npm-run.js run test:run -- --reporter verbose "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts" 2>&1` — 1 file/10 tests pass, exit 0.

- `sha256sum openspec/changes/add-device-quota-draft-excel-export/artifacts/device-quota-draft-export-sample.xlsx` and `wc -c openspec/changes/add-device-quota-draft-excel-export/artifacts/device-quota-draft-export-sample.xlsx` report size 11,457 bytes and SHA-256 `3bb72b74b02038f4e5360c21dcb94eacdee5da45c2b6830ef657d6076bf8707b`.
- Independent ExcelJS `readFile` read-back PASS (the `node -e` read-back command inspected workbook identity, merges, blank rows, widths, page setup, freeze pane, row heights, and excluded styles).
- 1 worksheet `Danh mục dự thảo`; row count 55; column count 7; headers đúng thứ tự; 42 data rows gồm 5 section/37 item; source order match `true`.
- Merge count 15 = 7 metadata + 5 section + 3 footnote; blank rows 8 và 52; footnotes row 53–55 đúng source order/text.
- Null row `1a`: E/F `""`; zero row `1b`: E `Máy`, F numeric `0`; excluded row `5a` row 23: gray fill `FFE5E7EB`, A:D not strike, E:G strike, note `Ghi chú cũ [Đã loại khỏi đề xuất]`.
- Print read-back: landscape, paperSize 9, fitToWidth 1, fitToHeight 0, `printTitlesRow: "9:9"`, no print area; view frozen `ySplit:9`, `topLeftCell:A10`, `activeCell:A10`.
- Widths `[7,32,13,64,15,14,32]`; row 11 (source `1a`) height 105; excluded row 23 height 120 after width-aware calculation; excluded style read-back has gray solid fill, A:D `strike=false`, E:G `strike=true`; Times New Roman 11/13 title, italic lead-in, bold header/thin border và wrapped top alignment được read-back; technical sentinel không xuất hiện trong visible cells.

## Reuse và deduplication evidence

Đã kiểm tra theo thứ tự Code Review Graph → GitNexus → `rg` backstop.

- Code Review Graph incremental check tại review-failed `HEAD` `ec7652c1` báo `No changes detected`, graph up to date; `createExcelWorkbook` và `downloadBlob` đã có trong `src/lib/excel-workbook.ts`; không có caller của module mới cần bảo vệ.
- GitNexus repo `qltbyt-nam-phong` đang index ở base `0b88ec9e`; query tìm thấy các renderer ExcelJS hiện có và shared `createExcelWorkbook`, nhưng index không chứa module remediation mới nên không dùng nó để claim impact caller. `getDeviceQuotaDraftCompleteness` là helper completeness hiện có và được tái sử dụng.
- `rg` backstop xác nhận không có builder draft tương đương; các renderer hiện có tiếp tục dùng `createExcelWorkbook`; `downloadBlob` vẫn là browser seam dành cho Phase 3. Không tạo utility shared mới.

## Gates và scope audit

Final chain chạy trong **một `ctx_batch_execute`**, `concurrency: 1`, trên exact code/sample commit `7a398fc1c72516ef55354d0cf71241816d68dcb9`, đúng thứ tự sau; tất cả exit 0:

1. `rtk node scripts/npm-run.js run format:check` — PASS, exit 0.
2. `rtk node scripts/npm-run.js run verify:no-explicit-any` — PASS, exit 0.
3. `rtk node scripts/npm-run.js run verify:dedupe` — PASS, diff-only, không có SonarJS duplicate-code findings, exit 0.
4. `rtk node scripts/npm-run.js run typecheck` — PASS, exit 0.
5. `rtk node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts" "src/lib/__tests__/excel-workbook.test.ts"` — PASS, 2 files/13 tests, exit 0.
6. `rtk node scripts/npm-run.js run react-doctor` — PASS, diff scan 4 files, score 100/100, no issues, exit 0.

- `rtk openspec validate add-device-quota-draft-excel-export --strict --no-interactive` — PASS, exit 0.
- `git diff --check` — PASS, exit 0. Lefthook pre-commit cũng pass cho các commit remediation.
- Module builder 306 dòng, validation helper 58 dòng, test 340 dòng và test support 200 dòng, mọi file dưới hard ceiling 450. Không có UI/editor/page/hook/RPC/query/mutation/SQL diff. `downloadBlob` không được gọi vì Phase 2 không có browser download; serializer trả `Uint8Array` browser-compatible và để Phase 3 nối `downloadBlob` sau session checks.

Tasks 2.1–2.7 được đánh dấu sau evidence này. Không thay đổi checkbox Phase 3.

## USER REVIEW và landing

- Ngày 2026-09-06, sau lượt review cuối trực tiếp và dynamic verification trên
  sample thật, người dùng xác nhận `Ok` và yêu cầu land trực tiếp vào `main`
  không qua PR.
- Mục `2.8 USER REVIEW — Phase 2 approval` được đánh dấu theo phê duyệt này;
  Phase 3 chưa bắt đầu.
