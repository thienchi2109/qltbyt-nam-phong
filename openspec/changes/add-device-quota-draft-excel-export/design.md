# Thiết kế xuất Excel danh mục định mức dự thảo

## Context

Nguồn pháp quy là PDF
`docs/device-quota/source-artifacts/thong-tu-10-2026/757_Thong-tu-10-2026-TT-BYT_88e68354fb.pdf`.
Manifest và các bản transcription trong cùng thư mục là nguồn repository-owned
đã freeze: phụ lục bắt đầu ở trang 6, gồm 42 structural rows (5 section rows
và 37 item rows), có quan hệ parent do nguồn khai báo, thứ tự nguồn và 3 chú
thích. Nội dung quota nhiều dòng phải được giữ nguyên, không suy ra một số
định mức mới.

Editor hiện tại hiển thị bảng appendix và cho phép staged edits. Nhu cầu export
là một read-only projection của saved draft, không phải một trạng thái mới của
domain. Bản export được dựng trong trình duyệt và không làm thay đổi dữ liệu
server.

## Goals

- Tạo artifact `.xlsx` dễ đọc, in được và truy nguyên về đúng snapshot pháp quy
  cùng bản lưu của đơn vị.
- Tách rõ cột pháp quy với cột đề xuất của đơn vị.
- Bảo toàn source order, section hierarchy, multiline rule, footnotes và
  excluded semantics.
- Giữ contract quyền và session-unit hiện tại, không tạo đường đọc mới.
- Tận dụng helper ExcelJS dùng chung nhưng giữ logic domain trong module draft.

## Non-Goals

- Thao tác xuất không ghi database, gọi RPC/mutation, refetch, Save hoặc publish.
  Branding được tải bằng query đọc hiện có khi chuẩn bị màn hình, không phải lúc nhấn xuất.
- Không cho export từ dirty staged state hoặc từ branding của tenant khác.
- Không làm thay đổi `exportToExcel` phẳng, các luồng import hiện hữu hoặc
  shared hierarchical editor.

## Existing seams and ownership

| Seam                                                                                                    | Vai trò hiện tại                                                     | Cách dùng trong export                                                                                                                            |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/device-quota/categories/_hooks/useDeviceQuotaDraftCatalog.ts`                            | Ghép query draft/catalog, staged `rows`, `lastSavedRows` và metadata | Thêm context nội bộ tối thiểu; snapshot phải lấy `draftQuery.data` và `catalogQuery.data` khớp, không lấy local revision thay cho server revision |
| `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogPageClient.tsx` | Nối hook với editor                                                  | Truyền export context/callback nội bộ cùng state hiện có                                                                                          |
| `DeviceQuotaDraftCatalogEditor.tsx`                                                                     | Sở hữu toolbar, table và trạng thái mutation                         | Render nút qua `HierarchicalEditorToolbar.actions`; không sửa shared toolbar                                                                      |
| `src/components/hierarchical-editor/HierarchicalEditorToolbar.tsx`                                      | `actions` đã render ngay trước nút Lưu                               | Đặt `Xuất Excel` vào slot này để giữ thứ tự và layout hiện tại                                                                                    |
| `src/lib/excel-workbook.ts`                                                                             | Lazy-load ExcelJS, tạo workbook và tải Blob                          | Gọi `createExcelWorkbook` và `downloadBlob`, không sao chép helper                                                                                |
| `useTenantBranding({ formTenantId, useFormContext: true })`                                             | Lấy `{ id, name }` cho đơn vị                                        | Dùng `formTenantId: snapshot.unitId`; chỉ chấp nhận id khớp và name không trắng                                                                   |
| `docs/device-quota/source-artifacts/thong-tu-10-2026/`                                                  | PDF, manifest, JSON/Markdown source freeze                           | Lấy title, source order, row text, source pages/references và 3 notes                                                                             |

Các module mới nên nằm gần draft catalog, chẳng hạn
`src/app/(app)/device-quota/categories/draft-catalog/device-quota-draft-catalog-excel-export.ts`
và test tương ứng trong thư mục `__tests__`. Đây là module hữu hạn cho
workbook export, không phải tiện ích export dùng chung. Nếu module hoặc editor
đạt khoảng 350 dòng, phải tách types/mapper/table helpers; không file nguồn nào
được vượt 450 dòng.

## Export snapshot contract

### Identity and coherence

`DeviceQuotaDraftCatalogExportSnapshot` là context nội bộ, immutable sau khi
được tạo. Nó tối thiểu chứa:

- `unitId` và `unitName` đã xác thực;
- `draftStatus`, `revision` và `lastSavedAt` lấy từ saved draft server;
- document number/version, appendix title, source PDF marker và source hash;
- 42 saved rows đã merge với cùng regulatory catalog;
- ba footnotes nguồn, giữ đúng thứ tự và text;
- identity của user/unit dùng để hủy tác vụ nếu session đổi trong lúc tạo Blob.

Identity authoritative của export là cùng authenticated session đã được
`useDeviceQuotaDraftCatalog` chấp nhận: `userId` hợp lệ của session và
`resolvedUnitId = current_don_vi ?? don_vi`, trong đó `resolvedUnitId` phải là
số dương. Nếu thiếu `userId` hợp lệ hoặc `resolvedUnitId` không dương, hook/page
không tạo export context và builder không được gọi. Khi access contract chưa
cho phép truy cập, action được ẩn; nếu quyền đã được xác định nhưng identity
tạm thời không còn, action bị khóa với trạng thái thiếu identity. Nếu identity
biến mất trong lúc tạo Blob, phải hủy tác vụ trước khi tải xuống và không dùng
Blob cũ. Không tạo tenant selector mới hoặc public API cho việc này.

Snapshot chỉ hợp lệ khi `draftQuery.data` và `catalogQuery.data` cùng
`catalog_version_id`, cùng unit và cùng lần accepted server state. `revision` và
`updated_at` phải lấy trực tiếp từ saved draft response; không dùng
`localRevision`, local staged `rows` hoặc metadata của một cache mới hơn để ghép
với `lastSavedRows`. `lastSavedRows` vẫn là seam hiển thị saved rows đã được
chấp nhận, nhưng context export phải giữ cặp rows/metadata/footnotes nguyên tử.

Tên đơn vị không lấy từ session `don_vi` vì session không có tên tin cậy.
`useTenantBranding` có thể giữ dữ liệu cũ trong `keepPreviousData`, do đó builder
chỉ nhận tên khi `branding.id === snapshot.unitId` và `name.trim()` không rỗng.
Thiếu hoặc mismatch branding là trạng thái không thể export, có status và
retry rõ ràng.

Khi bắt đầu export, đóng băng identity `(userId, unitId, revision, savedAt)`.
Nếu session, đơn vị hoặc accepted snapshot thay đổi trước khi `downloadBlob`
được gọi, hủy tác vụ và không tải file cũ. Việc này không refetch để tự sửa.

### Eligibility and state

| State                                                     | Nút `Xuất Excel`                                        | Hành vi                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Có quyền, saved snapshot sạch                             | Bật                                                     | Tạo đúng một workbook từ snapshot đã đóng băng                                            |
| `global`/`admin`/`to_qltb` nhưng dirty                    | Khóa                                                    | Không Save, không refetch, giải thích cần lưu trước                                       |
| Đang save/exclude/restore/recover                         | Khóa                                                    | Chờ mutation hiện tại hoàn tất                                                            |
| Thiếu snapshot/catalog/branding                           | Khóa                                                    | Hiện trạng thái thiếu dữ liệu và retry query hiện tại                                     |
| Thiếu `userId` xác thực hoặc `resolvedUnitId` không dương | Ẩn khi access chưa được cấp; khóa khi quyền đã xác định | Không tạo export context/builder; nếu mất identity lúc pending thì hủy trước khi download |
| Đang tạo hoặc tải file                                    | Khóa                                                    | Một lượt duy nhất; không duplicate download                                               |
| Unauthorized hoặc mode read-only theo access contract     | Ẩn                                                      | Không tạo context và không rò rỉ dữ liệu                                                  |
| Builder/download lỗi                                      | Mở lại nếu đủ điều kiện                                 | Toast lỗi; nhấn Xuất Excel để thử lại trên snapshot đang hiển thị                         |

Nút dùng label user-facing `Xuất Excel`, `type="button"`, trạng thái disabled
đúng với lý do và không chặn nút Lưu. `actions` đứng bên trái nút Lưu theo
contract của toolbar hiện hữu.

## Workbook contract

### Sheet and metadata

Workbook có đúng một worksheet tên `Danh mục dự thảo`. Tên file cố định theo
mẫu `danh-muc-du-thao-don-vi-{unitId}-r{revision}-{savedUtc}.xlsx`, trong đó
`savedUtc` là thời điểm lưu dạng `YYYYMMDDTHHmmssZ`, không phải thời điểm xuất.
Không cần tạo thêm helper slug tên đơn vị.

Hàng 1 là `PHỤ LỤC`; hàng 2 giữ nguyên tiêu đề phụ lục; hàng 3 giữ dòng dẫn
Thông tư số 10/2026/TT-BYT ngày 14 tháng 5 năm 2026 từ PDF. Các hàng 1–7 gộp
A:G. Hàng 4 ghi tên đơn vị; hàng 5 ghi `Bản nháp — Chưa hoàn thiện` hoặc
`Bản nháp — Đã đủ dữ liệu`, tính từ các hàng đã lưu bằng completeness helper
hiện có (không tính mục đã loại là mục thiếu). Hàng 6 ghi revision; hàng 7 ghi
thời điểm lưu theo `dd/MM/yyyy HH:mm:ss (Asia/Ho_Chi_Minh)`. Hàng 8 trống,
hàng 9 là header bảng, dữ liệu bắt đầu ở hàng 10. Không thêm khối ký duyệt
hoặc cột metadata ẩn. Source marker giữ trong context kiểm chứng, không đưa
hash kỹ thuật vào phần tiêu đề người dùng.

Bảng dữ liệu bắt đầu sau metadata block, có đúng bảy header theo thứ tự:

| Vị trí | Header              | Nguồn                                |
| ------ | ------------------- | ------------------------------------ |
| 1      | `TT`                | Appendix row ordinal                 |
| 2      | `Chủng loại`        | Regulatory item/section name         |
| 3      | `Đơn vị tính`       | Regulatory unit                      |
| 4      | `Số lượng định mức` | Full source rule, multiline          |
| 5      | `ĐVT áp dụng`       | Saved unit proposal, nullable        |
| 6      | `SL đề xuất`        | Saved non-negative integer, nullable |
| 7      | `Ghi chú`           | Saved notes and exclusion marker     |

### Rows and source fidelity

Builder phải ghi đủ 42 rows theo `appendix.json.rows`, gồm 5 section rows và 37
item rows. Section rows giữ TT/name/hierarchy và các ô còn lại trống hoặc
trình bày theo style section, nhưng vẫn thuộc cùng bảy-column worksheet. Item
rows giữ source page/reference, source-declared parent và thứ tự gốc. Các
`sourcePages`, `sourceReference`, `parentSourceIdentifier` và identity của
source/order/catalog chỉ là input để validate snapshot/fixture, bảo đảm thứ tự,
hierarchy và coherence; chúng không được ghi thành cột worksheet bổ sung, cột
ẩn, comment, sheet phụ hoặc ô user-facing. Chỉ bốn cột source hợp lệ là
`TT`, `Chủng loại`, `Đơn vị tính` và `Số lượng định mức` được render nội dung
pháp quy.

`Số lượng định mức` là text nhiều dòng đúng source, gồm mọi điều kiện và ghi
chú inline. Không parse thành formula, không rút gọn điều kiện và không dùng
giá trị đề xuất để ghi đè cột này. `Chủng loại` và `Đơn vị tính` pháp quy cũng
giữ source text; display-name override không thay legal title trong file.

`ĐVT áp dụng` có giá trị rỗng khi saved value là `null`; tuyệt đối không ghi
regulatory unit làm fallback vào ô này. `SL đề xuất` có giá trị rỗng khi
`appliedQuantity` là `null`; số 0 phải là numeric zero để Excel không coi như
blank. `Ghi chú` giữ text đã lưu.

### Excluded rows

Excluded rows vẫn nằm đúng source order và giữ nguyên các proposal values.
Toàn bộ row có style nền xám; chỉ các ô proposal (`ĐVT áp dụng`, `SL đề xuất`,
`Ghi chú`) được gạch ngang. Cột source (`TT`, `Chủng loại`, `Đơn vị tính`,
`Số lượng định mức`) không gạch để người đọc vẫn thấy căn cứ pháp quy.

`Ghi chú` phải chứa marker chính xác `[Đã loại khỏi đề xuất]` và không làm mất
ghi chú cũ. Builder cần tránh thêm marker lặp lại khi input đã có marker.

### Footnotes and print layout

Sau bảng và một hàng trống, ghi ba chú thích nguồn trong một vùng riêng, mỗi
chú thích một hàng gộp A:G, đúng thứ tự và nguyên văn từ `catalog.footnotes`.
Fixture đối chiếu JSON nguồn; không parse Markdown hoặc PDF lúc export.
Chú thích không bị strike và không bị cắt khỏi sample artifact.

Worksheet đặt paper A4 landscape, fit-to-width một trang và chiều cao không
giới hạn. Header của bảng lặp lại trên các trang in. Chiều rộng cột ưu tiên
đọc được `Chủng loại` và quota multiline; wrap text, vertical top và row height
phải phục vụ text nguồn. Style section/header giữ tinh thần appendix gốc,
nhưng không hy sinh bảy-column contract. Không đặt print-area khiến mất title,
metadata hoặc footnotes.

Dùng Times New Roman 11pt, tiêu đề 13pt đậm căn giữa, dòng dẫn 11pt nghiêng;
header đậm, kẻ bảng mảnh. Độ rộng A:G ban đầu là `7, 32, 13, 64, 15, 14, 32`.
Các hàng nhóm gộp A:G, giữ TT và tên nhóm gốc. Freeze đến hàng 9, lặp hàng 9
khi in (`printTitlesRow: "9:9"`), `fitToWidth: 1`, `fitToHeight: 0`,
`paperSize: 9`, `orientation: "landscape"`. Chiều cao hàng phải theo nội dung
đã wrap, không cắt text bằng một chiều cao tối đa cố định. Phase 2 phải kiểm
tra sample thực tế để điều chỉnh chiều cao mà không đổi hợp đồng nội dung.

## Interaction and error flow

1. Page client nhận saved export context và branding đã khớp từ hook.
2. Editor tính `canExport` từ access, `isDirty`, mutation state và snapshot
   readiness.
3. Click `Xuất Excel` khóa nút, đóng băng identity và gọi builder thuần
   workbook; không gọi `onSave`.
4. Builder tạo workbook với helper chung, ghi metadata/table/notes và trả Blob.
5. Nếu identity còn hợp lệ, gọi `downloadBlob` đúng một lần rồi mở khóa.
6. Nếu có lỗi, không tải Blob dở dang; hiện toast retry và giữ snapshot đã
   chấp nhận. Retry không được tự động lấy revision mới.

Thiết kế phải xử lý lỗi thiếu snapshot/branding, ExcelJS import failure,
serialization failure và download failure. Thông báo user-facing bằng tiếng
Việt, không lộ raw error/SQL/secret.

## Component and module boundaries

- `useDeviceQuotaDraftCatalog`: giữ query/mutation hiện tại; expose context
  export nội bộ read-only được tạo từ cùng server snapshot, cùng `lastSavedRows`
  và regulatory footnotes.
- `DeviceQuotaDraftCatalogPageClient`: truyền context và branding status xuống
  editor; không chứa logic workbook.
- `DeviceQuotaDraftCatalogEditor`: chỉ điều phối button/state/callback; dùng
  `actions` của toolbar và không sửa `HierarchicalEditorToolbar`.
- `device-quota-draft-catalog-excel-export.ts`: chứa type nội bộ, row mapper,
  workbook builder và filename helper nếu cần. Không gọi RPC, query hook hoặc
  mutation.
- `__tests__/device-quota-draft-catalog-excel-export.test.ts`: test builder,
  schema, styles, source order và snapshot rules.
- `__tests__/DeviceQuotaDraftCatalogExport.test.tsx`: test user-event cho
  editor/page wiring, permission, lock, retry và no-refetch/no-save.

Mỗi module có một owner rõ ràng. Không copy `createExcelWorkbook`,
`downloadBlob`, logic permission hoặc unit branding. Nếu cần utility mới, phải
chứng minh không có seam tương đương qua `rg`/Code Review Graph trước khi tạo.

## Verification strategy

Phase 2 chứng minh builder thuần bằng fixture/source artifact và sample
`.xlsx`; Phase 3 chứng minh interaction bằng `@testing-library/user-event` cho
cả role được phép và các ca âm unauthorized/read-only, thiếu identity
(`userId` hoặc `current_don_vi ?? don_vi` không hợp lệ), không tạo context/
builder/download; ca mất identity khi đang pending phải hủy download cũ;
Phase 4 kiểm tra mở/in và hồi quy. Với TypeScript/React, gate bắt buộc theo
thứ tự là format, no-explicit-any, diff dedupe, typecheck, focused Vitest,
react-doctor. Không chạy database quality gate vì change này không có SQL.

Phase 4 cần bằng chứng giao diện trên trình duyệt và mở/print-preview file
trong ứng dụng đọc `.xlsx`. DOM và `pageSetup` chỉ là kiểm tra bổ trợ, không
chứng minh text không bị cắt khi in. Nếu chưa có môi trường kiểm tra trực
quan, ghi INCOMPLETE và giữ checkpoint chưa hoàn tất; không tự suy diễn waiver.

## Risks and mitigations

| Rủi ro                                       | Giảm thiểu                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Background refetch làm trộn rows và metadata | Snapshot nguyên tử từ cùng `draftQuery.data` + `catalogQuery.data`, dùng server revision/updated_at |
| `keepPreviousData` trả branding tenant cũ    | Kiểm tra `branding.id` với snapshot unit trước khi enable export                                    |
| Export dirty draft bị hiểu là đã lưu         | Khóa khi `isDirty`; chỉ dùng saved rows                                                             |
| File in mất rule/footnotes                   | Fixture multiline, footnotes, fit width và sample artifact trong acceptance                         |
| Excluded row làm mất căn cứ pháp quy         | Chỉ strike cột proposal; source text luôn đọc được                                                  |
| Export button phá toolbar chung              | Chỉ dùng `actions` slot; không sửa shared component                                                 |
| Logic export phình thành utility chung       | Giữ module gần draft, áp dụng ngưỡng 350/450 dòng                                                   |

## Quyết định và điểm dừng

Thiết kế không còn câu hỏi sản phẩm mở. Phase 2 kiểm chứng workbook độc lập;
Phase 3 kiểm chứng tích hợp; Phase 4 kiểm chứng trình bày thực tế. Sau mỗi
phase phải có bằng chứng và được người dùng duyệt trước khi đi tiếp.
