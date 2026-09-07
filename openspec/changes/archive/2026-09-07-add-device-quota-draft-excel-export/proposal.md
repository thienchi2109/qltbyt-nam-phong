# Xuất Excel danh mục định mức dự thảo

Status: Proposed
Date: 2026-09-05
Change-id: `add-device-quota-draft-excel-export`

## Why

Danh mục định mức dự thảo hiện có thể được chỉnh sửa, lưu và mở lại trong
workspace `/device-quota/categories/draft-catalog`, nhưng chưa có bản xuất để
đơn vị gửi duyệt nội bộ hoặc lưu hồ sơ. Bản xuất phải phản ánh đúng bảng phụ
lục của Thông tư 10/2026, đồng thời giữ lại các giá trị đề xuất của đơn vị và
dấu vết của bản lưu đã được chấp nhận.

Nếu lấy dữ liệu từ trạng thái đang sửa hoặc từ một lần tải mới tại thời điểm
nhấn nút, file có thể trộn giá trị chưa lưu với revision và metadata khác. Vì
vậy bản export cần được tạo từ một saved snapshot nhất quán, được khóa theo
đơn vị trong session hiện tại, rồi mới tạo một workbook cục bộ trên trình
duyệt.

## What Changes

- Thêm nút `Xuất Excel` ngay cạnh nút `Lưu` trong toolbar của editor. Nút này
  dùng slot `actions` sẵn có của `HierarchicalEditorToolbar`, đứng ngay trước
  nút Lưu.
- Giữ nguyên quyền hiện tại của nhóm quản lý: `global`, `admin` và `to_qltb`;
  export luôn thuộc đơn vị của session hiện tại và không thêm lựa chọn đơn vị.
- Xuất đúng một file `.xlsx` có một worksheet và bảy cột theo thứ tự:
  `TT`, `Chủng loại`, `Đơn vị tính`, `Số lượng định mức`, `ĐVT áp dụng`,
  `SL đề xuất`, `Ghi chú`.
- Dùng dữ liệu đã lưu đang hiển thị (`lastSavedRows`) cùng revision,
  `updated_at`, catalog snapshot, metadata pháp quy và ba chú thích đã khớp
  trong cùng saved snapshot. Nhấn export không refetch, không tự động Lưu và
  không gọi mutation.
- Giữ nguyên tiêu đề, thứ tự dòng, hierarchy và nội dung nhiều dòng của phụ
  lục nguồn trong PDF cục bộ; bao gồm năm section row, 37 item row và ba chú
  thích nguồn.
- Đặt tên đơn vị, trạng thái dự thảo, revision và thời điểm lưu trong một
  vùng metadata riêng của worksheet; các giá trị này không thay thế bảy cột
  pháp quy/dự thảo và không tạo chữ ký.
- Khóa export khi bản dự thảo bẩn, đang mutation, thiếu saved snapshot, thiếu
  hoặc không khớp tên đơn vị, hoặc đang export. Lỗi tạo/tải file hiển thị
  toast có thể thử lại trên snapshot hiện tại; không cho phép hai lượt tải
  trùng nhau.
- Tái sử dụng `src/lib/excel-workbook.ts` (`createExcelWorkbook`,
  `downloadBlob`) và ExcelJS. Logic mapping workbook mới phải nằm trong module
  hữu hạn gần draft catalog, không mở rộng helper export phẳng chung bằng cờ
  domain.

## Non-Goals

- Không thêm RPC, migration, bảng, grant, mutation hoặc quyền mới.
- Không tạo read-only export riêng; mode read-only không được nhận thao tác
  export nếu không có quyền quản lý như contract hiện tại.
- Không thay đổi active category CRUD, hai luồng Excel import, mapping, báo
  cáo, compliance hoặc hành vi của draft catalog D1-D3.
- Không export trạng thái đang sửa, không refetch bản mới nhất tại click, không
  tự động Save, không import roundtrip và không publish/activate/approve.
- Không thêm chữ ký điện tử, trường phê duyệt hay hồ sơ pháp lý mới.
- Không bổ sung thiết bị ngoài appendix hoặc diễn giải `Số lượng định mức`
  thành một công thức số duy nhất.

## Impact

Đây là proposal tài liệu cho bốn phase độc lập. Phase 1 chỉ tạo và kiểm tra
proposal, design, spec delta, tasks và acceptance; không sửa runtime, SQL hay
test hiện hữu. Các phase sau dự kiến có phạm vi file hữu hạn:

- workbook mapper và builder gần module draft catalog;
- test workbook và sample artifact cho Phase 2;
- hook/editor wiring và user-event test cho Phase 3;
- kiểm tra visual/print và hồi quy import/workspace cho Phase 4.

Hook hiện có metadata kỹ thuật nhưng chưa có tên đơn vị và footnotes. Phase 3
chỉ được thêm một context nội bộ tối thiểu, tạo nguyên tử từ dữ liệu server của
draft và regulatory catalog đã khớp; không biến nó thành public API hoặc RPC
mới. Tên đơn vị lấy qua `useTenantBranding` với `formTenantId` bằng unit của
snapshot, và phải kiểm tra `branding.id` trước khi dùng tên.

## Delivery boundaries

### Phase 1 — Hồ sơ, đặc tả, reuse và acceptance

Đóng băng contract nguồn, chỉ ra seam tái sử dụng, ma trận fixture/test và
layout acceptance. Exit chỉ là tài liệu đã được validate; chưa có file tải.

### Phase 2 — Workbook độc lập

Tạo builder ExcelJS theo TDD Red → Green → Refactor, fixture 42 dòng và sample
`.xlsx`. Module phải kiểm tra schema bảy cột, giá trị null/zero, excluded row,
metadata, multiline source text, footnotes và page setup trước khi được nối vào
UI.

### Phase 3 — Tích hợp nút tải

Nối saved export context vào editor qua `actions`, khóa state và toast retry.
TDD user-event phải chứng minh quyền, session-unit, snapshot coherence, dirty /
mutation / duplicate lock, không refetch và không Save.

### Phase 4 — Visual, print và regression closeout

Kiểm tra worksheet khi mở/in trên A4 landscape, một trang theo chiều rộng,
header lặp và text nguồn đọc được. Chạy các hồi quy Excel hiện có và
`DeviceQuotaPageCoexistence` cùng các gate TypeScript/React cần thiết.

Mỗi phase có một điểm dừng `USER REVIEW` trong `tasks.md`; phase tiếp theo chỉ
bắt đầu sau khi người dùng duyệt rõ ràng phase trước.

## Success criteria

- Người có quyền tải được một workbook duy nhất từ saved snapshot đúng đơn vị.
- Workbook có đúng bảy cột, đủ 42 dòng theo source order, đủ ba source notes,
  giữ nguyên multiline rule và không biến bản export thành nguồn import.
- `appliedUnit = null` xuất ô trống, `appliedQuantity = null` xuất ô trống,
  còn số 0 vẫn là số 0; regulatory unit không được ghi thay vào ô applied.
- Dòng bị loại vẫn ở đúng vị trí, giữ proposal values, có nền xám, chỉ ô
  proposal bị gạch, và ghi `[Đã loại khỏi đề xuất]` mà không mất ghi chú cũ.
- Metadata snapshot, tên đơn vị và layout in đạt acceptance; không có mutation
  hoặc fetch mới khi export.
- Các luồng import và workspace hiện hữu vượt qua hồi quy; không có thay đổi
  SQL/RPC.

## Các quyết định đã chốt

Tên file, worksheet, metadata, vị trí header và thiết lập in được quy định tại
`design.md`; Phase 2 dùng sample để kiểm chứng các quyết định này. Không còn
quyết định sản phẩm mở. Bằng chứng thực hiện Phase 1 nằm trong
`phase-1-evidence.md`; việc người dùng duyệt để sang Phase 2 vẫn là checkpoint riêng.
