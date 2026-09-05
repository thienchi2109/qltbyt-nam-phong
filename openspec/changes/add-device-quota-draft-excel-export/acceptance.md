# Acceptance và ma trận evidence — Draft Excel Export

## Mục đích

Tài liệu này là checklist kiểm chứng cho change
`add-device-quota-draft-excel-export`. Phase 1 chỉ đóng băng contract và
evidence plan; các mục dưới đây phải còn unchecked cho tới khi lệnh/test/artifact
thật sự cung cấp bằng chứng. Commit hoặc việc file tồn tại không tự nó là
evidence.

## Source freeze và fixture baseline

| Hạng mục                   | Nguồn chuẩn                                                                                      | Acceptance                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| PDF pháp quy               | `docs/device-quota/source-artifacts/thong-tu-10-2026/757_Thong-tu-10-2026-TT-BYT_88e68354fb.pdf` | Byte hash khớp manifest `04186bd3cc50cf541f5e481d25480741412cfe3c899040c35713d4eeda24fd8f`            |
| Appendix title             | `thong-tu-10-2026-appendix.md`, dòng title đầu file                                              | Giữ nguyên `Phụ lục - Tiêu chuẩn, định mức sử dụng máy móc, thiết bị chuyên dùng trong lĩnh vực y tế` |
| Trang nguồn                | `manifest.json`                                                                                  | Appendix pages 6-12                                                                                   |
| Structural rows            | `thong-tu-10-2026-appendix.json`                                                                 | 42 rows = 5 section + 37 item                                                                         |
| Hierarchy                  | manifest + JSON rows                                                                             | 16 source-declared child, 21 top-level; source order giữ nguyên                                       |
| Rule text                  | JSON `quota` arrays/Markdown table                                                               | 32 multiline quota items, không suy ra formula                                                        |
| Footnotes                  | `thong-tu-10-2026-appendix.md` phần `## Chú thích`                                               | Đủ 3 note, đúng thứ tự và nguyên văn                                                                  |
| Repository/source identity | `manifest.json`                                                                                  | PDF/JSON/Markdown SHA và extraction revision dùng để trace                                            |

Các fixture Phase 2 phải đọc source artifact, không chép tay một subset làm
nguồn duy nhất. Fixture tối thiểu phải có một section row, một child row, một
top-level row, một rule nhiều điều kiện, một applied unit null, một quantity
null, quantity zero, một excluded row có proposal values và note cũ.

`sourcePages`, `sourceReference`, `parentSourceIdentifier` và identity của
source/order/catalog là input snapshot/fixture để kiểm tra thứ tự, hierarchy và
coherence. Chúng không được xuất hiện thành cột bổ sung, cột ẩn, comment, sheet
phụ hoặc ô user-facing; chỉ bốn cột source hợp lệ (`TT`, `Chủng loại`, `Đơn vị
tính`, `Số lượng định mức`) được render nội dung nguồn.

## Reuse và input coherence acceptance

| Contract                  | Evidence cần thu                                                                                                                      | Trạng thái ban đầu |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Toolbar placement         | `src/components/hierarchical-editor/HierarchicalEditorToolbar.tsx`: `actions` render ngay trước Save; editor không sửa shared toolbar | Chưa chạy          |
| Saved rows seam           | `useDeviceQuotaDraftCatalog.ts`: `lastSavedRows` merge từ catalog + server items                                                      | Chưa chạy          |
| Server metadata           | Cùng hook: export context phải dùng `draftQuery.data.revision`/`updated_at`, không dùng local revision                                | Chưa chạy          |
| Regulatory metadata       | `catalogQuery.data` cùng `catalog_version_id`, source title/hash/pages/references/footnotes                                           | Chưa chạy          |
| Unit branding             | `useTenantBranding({ formTenantId: snapshot.unitId, useFormContext: true })`; require id match và name nonblank                       | Chưa chạy          |
| Workbook helper           | `src/lib/excel-workbook.ts`: reuse `createExcelWorkbook` và `downloadBlob`                                                            | Chưa chạy          |
| No domain flag            | Search confirms no new flag in flat `exportToExcel`; builder module remains draft-local                                               | Chưa chạy          |
| No API/DB scope expansion | Diff and file ownership show no RPC, migration, grants or mutation change                                                             | Chưa chạy          |

Identity coherence acceptance phải chứng minh background refetch không ghép
`localRevision`/dirty rows với server `lastSavedRows`; branding giữ
`keepPreviousData` không được đi qua guard của tenant id. Khi user/unit đổi
trong lúc tạo Blob, download phải bị hủy.

## Fixture và focused test matrix

| Phase | Test/artifact                                                                                                   | Cases bắt buộc                                                                                                                                                                                   | Lệnh/evidence                                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Source artifact inspection                                                                                      | 42 rows, 5 sections, 37 items, 3 notes, source order, pages 6-12, hashes                                                                                                                         | `rg`/script read-only + recorded output; chưa đánh dấu trước khi chạy                                                                                     |
| 2     | `src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts` | One sheet, exact seven headers, title/metadata, 42 rows, section hierarchy, multiline source, 3 notes                                                                                            | `node scripts/npm-run.js run test:run -- "src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export.test.ts"` |
| 2     | Same focused test                                                                                               | null applied unit blank/no fallback; null quantity blank; zero numeric 0                                                                                                                         | Read worksheet cells with ExcelJS                                                                                                                         |
| 2     | Same focused test                                                                                               | Excluded gray row, proposal-only strike, source cells readable, marker + old note                                                                                                                | Assert cell styles/values                                                                                                                                 |
| 2     | Sample artifact                                                                                                 | `.xlsx` opens, one sheet, print setup, repeat headers, all notes visible                                                                                                                         | `openspec/changes/add-device-quota-draft-excel-export/artifacts/device-quota-draft-export-sample.xlsx` + manual/ExcelJS read-back                         |
| 3     | `src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx`          | global/admin/to_qltb, current unit, action order, one download                                                                                                                                   | Vitest + `@testing-library/user-event`                                                                                                                    |
| 3     | Same user-event test                                                                                            | dirty/mutation/missing snapshot/exporting locks; no Save/refetch/RPC; error toast retry                                                                                                          | Focused user-event command from `tasks.md`                                                                                                                |
| 3     | Same user-event test                                                                                            | branding id mismatch/blank; identity change aborts stale download; coherent revision/time                                                                                                        | Mock branding/query and inspect builder input                                                                                                             |
| 3     | Same user-event test                                                                                            | unauthorized role và read-only mode: action ẩn, không tạo export context/builder/download                                                                                                        | Mock access/session; assert action absent and builder/download không được gọi                                                                             |
| 3     | Same user-event test                                                                                            | thiếu authenticated `userId` hoặc `resolvedUnitId = current_don_vi ?? don_vi` không dương: action ẩn/khóa nhất quán, không context/builder/download; mất identity khi pending hủy download stale | Mock session/unit identity và builder promise                                                                                                             |
| 4     | `src/lib/__tests__/excel-workbook.test.ts`                                                                      | Shared helper behavior remains intact                                                                                                                                                            | Focused Vitest                                                                                                                                            |
| 4     | `src/lib/__tests__/category-excel.test.ts`                                                                      | Category import contract remains intact                                                                                                                                                          | Focused Vitest                                                                                                                                            |
| 4     | `src/lib/__tests__/device-quota-excel.test.ts`                                                                  | Quota import contract remains intact                                                                                                                                                             | Focused Vitest                                                                                                                                            |
| 4     | `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaPageCoexistence.integration.test.tsx`               | Existing category/import/mapping actions coexist                                                                                                                                                 | Focused Vitest                                                                                                                                            |

Không dùng full test corpus indiscriminately để thay cho các case trên. Nếu
runner hoặc browser timeout, ghi `INCOMPLETE` và xử lý theo phase gate; timeout
không phải PASS.

## Layout và print acceptance

Tất cả checklist dưới đây phải được đánh dấu khi có artifact/evidence tương
ứng. Các yêu cầu này áp dụng cho workbook cuối cùng, không chỉ DOM preview.

- [ ] Workbook có đúng một worksheet và phần bảng có đúng bảy cột theo thứ tự
      `TT`, `Chủng loại`, `Đơn vị tính`, `Số lượng định mức`, `ĐVT áp dụng`,
      `SL đề xuất`, `Ghi chú`.
- [ ] `sourcePages`, `sourceReference`, `parentSourceIdentifier` và identity
      source/order/catalog chỉ dùng để validate fixture/snapshot; không có cột
      bổ sung, cột ẩn, comment, sheet phụ hoặc ô user-facing nào chứa chúng,
      và chỉ bốn cột source hợp lệ render nội dung nguồn.
- [ ] Tiêu đề appendix giữ nguyên source title; metadata block riêng chứa tên
      đơn vị, draft status, revision và saved timestamp.
- [ ] Metadata không tạo thêm cột, chữ ký, approval field hoặc import marker.
- [ ] 42 dòng source xuất hiện đủ, đúng thứ tự, section rows và quan hệ
      top-level/child được giữ; không có row ngoài appendix.
- [ ] `Số lượng định mức` giữ toàn bộ điều kiện multiline; wrap text và chiều
      cao dòng đủ đọc khi mở worksheet và khi in.
- [ ] `ĐVT áp dụng = null` là blank, không có regulatory fallback; quantity null
      là blank; quantity 0 là numeric zero.
- [ ] Excluded row ở đúng vị trí, giữ proposal values và note cũ; nền xám,
      strike chỉ ba proposal cells, source cells không strike.
- [ ] Marker `[Đã loại khỏi đề xuất]` xuất hiện đúng một lần trong notes của
      excluded row.
- [ ] Ba footnotes nguồn xuất hiện sau bảng, đúng thứ tự, nguyên văn, không bị
      strike/cắt.
- [ ] Worksheet A4 landscape, fit-to-width một trang, fit-to-height unlimited;
      header bảng lặp trên trang tiếp theo.
- [ ] Filename không có ký tự Excel cấm, không lộ secret, và xác định được
      document/unit/revision theo quy ước đã duyệt.
- [ ] Khi branding thiếu/mismatch, export bị khóa và có status/retry; không
      dùng tên đơn vị từ tenant trước.
- [ ] Click liên tiếp trong lúc pending chỉ tạo tối đa một Blob/download; không
      gọi Save, mutation hoặc refetch.
- [ ] Lỗi builder/download cho toast retry tiếng Việt; retry không tải stale
      snapshot và không tự động mutate/refetch.

## Phase gate evidence

### Phase 1

- [x] Strict OpenSpec validation pass:
      `openspec validate add-device-quota-draft-excel-export --strict --no-interactive`.
- [x] Prettier docs và `git diff --cached --check` pass.
- [x] Chỉ các file docs của change xuất hiện trong diff; không runtime/SQL/test
      edit.
- [x] Reuse table và source hash/page/row/note evidence đã được đối chiếu với
      source/code.
- [x] Independent review evidence: một reviewer đã rà soát tính đúng đặc tả và
      chất lượng tài liệu; kết quả 0 Critical, 3 Important, cả ba finding hợp
      lệ đã được triage và sửa trong design/tasks/acceptance.
- [ ] `USER REVIEW — Phase 1 approval` nhận explicit approval.

Exit: parent có thể đánh dấu các mục Phase 1 đã có evidence; checkbox approval
vẫn phải unchecked nếu chưa có phê duyệt trực tiếp.

### Phase 2

- [ ] Red test fail vì contract chưa implement, sau đó Green focused test pass.
- [ ] Sample `.xlsx` read-back pass toàn bộ fixture/style/layout matrix.
- [ ] Builder module không gọi query/RPC/mutation và không vượt 450 dòng.
- [ ] `USER REVIEW — Phase 2 approval` nhận explicit approval.

### Phase 3

- [ ] User-event Red → Green pass cho role/unit/dirty/pending/missing/error/
      retry/duplicate/identity cases.
- [ ] Snapshot coherence chứng minh server revision/updated_at và matched
      catalog/footnotes dùng chung; branding id guard pass.
- [ ] Required format, no-explicit-any, diff dedupe, typecheck, focused Vitest
      và react-doctor pass trên cùng commit.
- [ ] `USER REVIEW — Phase 3 approval` nhận explicit approval.

### Phase 4

- [ ] Visual/print inspection pass theo layout checklist.
- [ ] Excel helper, category import, quota import và page coexistence regression
      pass.
- [ ] Evidence gắn exact commit; mọi timeout/baseline noise được ghi trạng thái
      riêng, không hạ thành PASS.
- [ ] `USER REVIEW — Phase 4 closeout` nhận explicit approval.

## Out of scope confirmation

- [ ] Không sửa migration/RPC/database hoặc ghi live DB.
- [ ] Không thay đổi D1-D3 draft catalog, active category CRUD hoặc hai import
      flow.
- [ ] Không thêm publish/approval/signature/import roundtrip.
- [ ] Không mở rộng generic workbook helper bằng domain flag.
