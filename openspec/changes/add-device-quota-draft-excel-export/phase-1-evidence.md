# Bằng chứng Phase 1 — Đặc tả xuất Excel danh mục dự thảo

## Phạm vi thực hiện

- Ngày khảo sát: 2026-09-05.
- Base: `fa600e00b7c98950768b81560ab429229f165142`.
- Nhánh: `docs/device-quota-draft-excel-export`.
- Phase 1 chỉ tạo tài liệu OpenSpec, thiết kế, checklist và tiêu chí nghiệm thu.
- Chưa triển khai workbook, nút xuất, test runtime hoặc migration.
- Người dùng đã chốt thiết kế và yêu cầu duyệt riêng sau từng phase. Trong lượt
  này, người dùng explicit ủy quyền fast-forward to main; theo đó Phase 1 được
  duyệt và parent được ủy quyền land/closeout Phase 1. Không có ủy quyền Phase 2.

## Nguồn và baseline đã kiểm tra

- `openspec validate add-device-quota-draft-catalog --strict --no-interactive`:
  PASS trên base nêu trên.
- PDF người dùng chỉ định tại
  `/root/docs/thong-tu-10-2026/757_Thong-tu-10-2026-TT-BYT_88e68354fb.pdf`
  trùng từng byte với PDF đã đóng băng trong
  `docs/device-quota/source-artifacts/thong-tu-10-2026/`.
- SHA-256 được manifest nguồn ghi nhận:
  `04186bd3cc50cf541f5e481d25480741412cfe3c899040c35713d4eeda24fd8f`.
- Phụ lục ở trang PDF 6–12; manifest ghi 42 hàng cấu trúc, gồm 5 hàng nhóm,
  37 mục thiết bị và 3 chú thích. Đây là baseline của fixture nghiệm thu,
  không phải quy tắc đếm cứng cho mọi phiên bản văn bản tương lai.

## Quyết định tái sử dụng đã đối chiếu với code

| Nhu cầu             | Khả năng hiện có                                                    | Quyết định cho phase triển khai                                                    |
| ------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Tạo workbook        | `src/lib/excel-workbook.ts`: `createExcelWorkbook`                  | Tái sử dụng ExcelJS và factory hiện có.                                            |
| Tải file            | Cùng module: `downloadBlob`; Equipment export đang sử dụng          | Dùng lại vòng đời Blob/URL/download, không sao chép.                               |
| Bảng Excel phẳng    | `src/lib/excel-utils.ts`: `exportToExcel`                           | Giữ hợp đồng bảng phẳng; không thêm cờ nghiệp vụ phụ lục.                          |
| Đặt nút cạnh Lưu    | `HierarchicalEditorToolbar` đã có slot `actions` ngay trước nút Lưu | Truyền nút xuất qua slot; không cần đổi toolbar dùng chung.                        |
| Hàng dữ liệu đã lưu | `useDeviceQuotaDraftCatalog`: `lastSavedRows` từ `serverItems`      | Bổ sung đầu vào xuất nhất quán với metadata của cùng snapshot.                     |
| Tên đơn vị          | `useTenantBranding`, RPC đọc `don_vi_branding_get`                  | Chỉ nhận tên khi ID khớp đơn vị của snapshot; không dùng placeholder đơn vị trước. |
| Nội dung nguồn      | Regulatory catalog query có thứ tự, điều kiện và chú thích          | Dùng catalog khớp phiên bản snapshot, giữ nguyên nội dung nguồn.                   |

Điểm cần bảo vệ bằng TDD: metadata hiện dùng biến `revision` cục bộ trong khi
`lastSavedRows` lấy hàng server. Phần triển khai phải công bố hàng và metadata
cùng snapshot đã được hiển thị; không ghép revision cũ với hàng mới do refetch.

## Validation và review của change mới

- `openspec validate add-device-quota-draft-excel-export --strict
--no-interactive`: PASS (exit 0), change hợp lệ.
- `node scripts/npm-run.js run format:check`: PASS (exit 0), tất cả file được
  kiểm tra dùng đúng Prettier.
- `git diff --cached --check`: PASS (exit 0), không có whitespace error.
- `git diff --cached --name-only`: PASS (exit 0), đúng sáu file thuộc change:
  `acceptance.md`, `design.md`, `phase-1-evidence.md`, `proposal.md`,
  `specs/device-quota-category-workspace/spec.md` và `tasks.md`; không có
  runtime/SQL/test path trong staged diff.
- Docs-only boundary: PASS; Phase 1 chỉ thay đổi sáu tài liệu OpenSpec nêu trên.
- Reuse/source evidence: PASS; các symbol/helper/seam trong bảng reuse đã được
  đối chiếu tại source code. PDF chỉ định tồn tại, trùng byte với artifact repo
  và cùng SHA-256
  `04186bd3cc50cf541f5e481d25480741412cfe3c899040c35713d4eeda24fd8f`.
- Independent review: một reviewer đã rà soát tính đúng đặc tả và chất lượng
  tài liệu. Kết quả là 0 Critical và 3 Important; cả ba finding đều được triage
  là hợp lệ và đã sửa:
  1. Bổ sung identity contract cho authenticated `userId` và
     `resolvedUnitId = current_don_vi ?? don_vi`, trạng thái thiếu identity và
     hủy export khi identity mất trong lúc pending.
  2. Bổ sung Red/Green user-event cases cho unauthorized role và read-only mode,
     bảo đảm action ẩn và không tạo context/builder/download; giữ nguyên các
     role được phép `global`/`admin`/`to_qltb`.
  3. Làm rõ `sourcePages`, `sourceReference`, `parentSourceIdentifier` cùng
     source/order/catalog identity chỉ là input validation/fixture, không render
     ngoài bốn cột source hợp lệ của worksheet.
- Task 1.6 được đánh dấu sau khi các sửa đổi và fresh gates pass.
- `USER REVIEW — Phase 1 approval`: APPROVED trong lượt này theo explicit
  authorization fast-forward to main; mục 1.7 và acceptance Phase 1 đã checked.
  Phase 2–4 vẫn unchecked.

## Điểm dừng

Phase 2 chỉ được bắt đầu sau một explicit approval riêng của người dùng; lượt
duyệt này chỉ cho phép parent land/closeout Phase 1. Các bước Red–Green–Refactor
và nghiệm thu file/UI thuộc Phase 2–4 chưa được thực hiện và vẫn unchecked.
