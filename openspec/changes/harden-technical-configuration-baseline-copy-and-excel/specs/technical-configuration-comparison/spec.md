## ADDED Requirements

### Requirement: Cross-dossier locked baseline copy

Hệ thống SHALL cho phép người dùng `admin/global` sao chép một phiên bản cấu hình cơ
sở đã khóa từ hồ sơ khác vào bản nháp của hồ sơ đích bằng contract server
authoritative, có preview và concurrency guard.

#### Scenario: List eligible locked sources

- **WHEN** người dùng mở luồng chọn cấu hình nguồn cho một hồ sơ đích
- **THEN** backend trả danh sách phân trang các baseline `locked` thuộc hồ sơ khác hồ
  sơ đích
- **AND** mỗi item có loại thiết bị, tên hồ sơ, số phiên bản, thời điểm khóa và stable
  identity cần cho selector
- **AND** item cho biết hồ sơ nguồn đang active hay archived
- **AND** tìm kiếm được thực hiện set-based, không gọi version-list riêng cho từng hồ sơ

#### Scenario: Copy a locked source from an archived dossier

- **WHEN** baseline nguồn đã khóa thuộc một hồ sơ archived khác hồ sơ đích
- **THEN** source vẫn xuất hiện với archive state rõ ràng và có thể preview/apply
- **AND** target active vẫn chịu đầy đủ revision, confirmation và authorization guard

#### Scenario: Explain the locked-source restriction

- **WHEN** người dùng nhấn `Sao chép từ hồ sơ khác`
- **THEN** UI hiển thị cảnh báo
  `Chỉ có thể sao chép phiên bản cấu hình đã khóa. Phiên bản đang ở trạng thái bản
nháp không thể sao chép.`
- **AND** phiên bản `draft` không xuất hiện như một nguồn có thể chọn
- **AND** cảnh báo được hiển thị trước khi người dùng tìm kiếm hoặc xác nhận source

#### Scenario: Create a target draft from another dossier

- **WHEN** hồ sơ đích active chưa có draft và người dùng apply một preview còn hiệu lực
  từ baseline nguồn đã khóa
- **THEN** hệ thống tạo phiên bản draft kế tiếp trong hồ sơ đích
- **AND** sao chép toàn bộ aggregate baseline-owned bằng UUID mới trong phạm vi đích
- **AND** giữ hierarchy, mã tiêu chí, title, requirement text, canonical order và
  lineage tới baseline/criterion nguồn

#### Scenario: Preview replacement of an existing target draft

- **WHEN** hồ sơ đích đã có một draft
- **THEN** preview không mutation và báo rõ thao tác sẽ thay thế toàn bộ aggregate
  baseline-owned của draft đó
- **AND** preview trả số lượng entity nguồn, số lượng entity đích sẽ xóa, expected
  dossier revision, expected draft revision và yêu cầu xác nhận thay thế

#### Scenario: Confirm replacement of an existing target draft

- **WHEN** người dùng apply preview hợp lệ với xác nhận thay thế rõ ràng
- **THEN** hệ thống giữ identity của target draft, thay toàn bộ descendants
  baseline-owned bằng entity đích có UUID mới và cập nhật source lineage
- **AND** mutation tăng revision theo contract hiện có đúng một lần và commit atomically
- **AND** supplier, option, comparison set, option response và manual assessment không
  bị sao chép

#### Scenario: Preview dependent target data loss

- **WHEN** target draft có option response, option citation hoặc manual assessment gắn
  với criterion sắp bị thay thế
- **THEN** preview trả count riêng cho từng loại dữ liệu phụ thuộc sẽ bị xóa
- **AND** confirmation nói rõ các phản hồi, trích dẫn và đánh giá đó không thể giữ vì
  target criterion sẽ nhận UUID mới
- **AND** cancel không thay đổi bất kỳ target data nào

#### Scenario: Preserve dossier-scoped target working roots

- **WHEN** người dùng xác nhận thay target draft
- **THEN** supplier, option, option document và comparison-set root hiện có của target
  vẫn được giữ
- **AND** option response, option citation và manual assessment gắn với criterion cũ bị
  xóa atomically
- **AND** baseline-owned reference product/response, baseline/reference document và
  citation được thay bằng bản copy có target UUID mới

#### Scenario: Copy the complete baseline-owned aggregate

- **WHEN** apply tạo draft mới hoặc thay draft hiện có
- **THEN** main section, subgroup, criterion, reference product/response,
  baseline/reference document và citation đều được copy
- **AND** mọi entity target-owned nhận UUID mới và mọi foreign key được remap trong
  target aggregate
- **AND** criterion code, title, requirement text và canonical order bằng source

#### Scenario: Reject replacement without explicit confirmation

- **WHEN** target đã có draft nhưng apply không gửi xác nhận thay thế
- **THEN** backend từ chối fail-closed
- **AND** không xóa hoặc tạo bất kỳ entity nào

#### Scenario: Reject an ineligible source

- **WHEN** source không tồn tại, chưa khóa hoặc thuộc chính hồ sơ đích
- **THEN** preview và apply đều từ chối
- **AND** response lỗi không làm lộ dữ liệu ngoài access boundary

#### Scenario: Reject stale target state

- **WHEN** dossier revision, target draft identity hoặc target draft revision đã thay
  đổi sau preview
- **THEN** apply trả conflict và yêu cầu preview lại
- **AND** không ghi một phần dữ liệu

#### Scenario: Bind apply to the exact preview snapshot

- **WHEN** bất kỳ copied, deleted hoặc preserved row nào thay đổi sau preview
- **THEN** apply lock target dossier row rồi lock mọi target table tham gia fingerprint
  bằng `SHARE ROW EXCLUSIVE ... NOWAIT` theo canonical order trước khi recompute
- **AND** apply trả `stale_preview` nếu fingerprint đã đổi
- **AND** Boolean xác nhận hoặc count trùng nhau không được dùng để bỏ qua fingerprint
- **AND** người dùng phải preview lại trước khi apply

#### Scenario: Prevent a phantom dependent write during apply

- **WHEN** writer đã giữ conflicting table lock trước khi apply lấy đủ lock
- **THEN** apply fail-fast với `concurrent_write_retry` và không mutation
- **AND** nếu apply lấy đủ lock trước thì writer đến sau phải chờ apply commit
- **AND** không có row mới nào được tạo giữa fingerprint validation và replacement
- **AND** apply không chờ table lock nên không tạo deadlock wait-cycle với writer

#### Scenario: Preserve future criterion-code allocation

- **WHEN** target draft được tạo hoặc thay thế từ source
- **THEN** mã tiêu chí nguồn được giữ nguyên
- **AND** `next_criterion_number` của target nằm sau sequence đã copy để tiêu chí thêm
  sau đó không tái sử dụng mã hiện có

#### Scenario: Keep the existing same-dossier copy compatible

- **WHEN** người dùng dùng `Sao chép thành bản nháp` từ một baseline đã khóa trong cùng
  hồ sơ
- **THEN** contract và kết quả hiện có không thay đổi
- **AND** lineage mở rộng cho cross-dossier không làm suy yếu yêu cầu source phải khóa

## MODIFIED Requirements

### Requirement: Standard baseline Excel template

Hệ thống SHALL cho phép tải và import cấu hình cơ sở bằng contract XLSX chuẩn,
hướng người dùng và được gắn với đúng bản nháp hiện tại. Workbook SHALL không được
dùng làm cơ chế sao chép cấu hình giữa các hồ sơ.

#### Scenario: Download the current configuration

- **WHEN** người dùng chọn `Tải cấu hình hiện tại` trên một baseline draft
- **THEN** workbook chứa toàn bộ mục chính, nhóm con và tiêu chí theo thứ tự hiện tại
- **AND** chỉ `STT` và `NỘI DUNG YÊU CẦU` là các cột hiển thị để chỉnh sửa
- **AND** workbook giữ metadata và identity hiện có trong dữ liệu ẩn
- **AND** tên file theo
  `{Loai_Thiet_Bi}_{Ten_Ho_So}_Phien_Ban_{N}.xlsx`

#### Scenario: Download an empty template

- **WHEN** người dùng chọn `Tải mẫu trống`
- **THEN** sheet `Nhập cấu hình` chỉ có header và không có dòng ví dụ
- **AND** sheet `Hướng dẫn & Ví dụ` chứa hướng dẫn cùng ví dụ ngắn
- **AND** sheet `_meta` ẩn gắn file với dossier, baseline version và revision hiện tại
- **AND** tên file theo
  `Mau_{Loai_Thiet_Bi}_{Ten_Ho_So}_Phien_Ban_{N}.xlsx`

#### Scenario: Generate a filesystem-safe filename

- **WHEN** loại thiết bị hoặc tên hồ sơ có dấu, khoảng trắng, ký tự cấm hoặc quá dài
- **THEN** hệ thống normalize Unicode, map `Đ/đ` thành `D/d`, bỏ combining marks, thay
  mọi run ngoài `[A-Za-z0-9]` bằng `_`, collapse và trim `_`
- **AND** segment loại thiết bị và tên hồ sơ lần lượt fallback thành `Thiet_Bi` và
  `Ho_So` nếu rỗng
- **AND** mỗi dynamic segment bị cắt ở tối đa 60 ký tự ASCII rồi trim `_` cuối
- **AND** tên cuối không vượt 160 ký tự ASCII
- **AND** suffix phiên bản cùng extension `.xlsx` luôn được giữ

#### Scenario: Round-trip the serialized current workbook

- **WHEN** người dùng download cấu hình hiện tại rồi upload chính file bytes đó vào
  cùng draft chưa thay đổi
- **THEN** client parse thành công và gửi authoritative preview
- **AND** server chấp nhận metadata, hidden identity và expected revision
- **AND** preview không báo create, update, move hoặc delete ngoài thay đổi thực tế

#### Scenario: Infer rows from the two-column worksheet

- **WHEN** người dùng upload workbook hợp lệ
- **THEN** dòng STT La Mã trở thành mục chính
- **AND** dòng STT số nguyên dương trở thành nhóm con của mục chính gần nhất
- **AND** dòng STT trống trở thành tiêu chí của nhóm con gần nhất hoặc trực tiếp của
  mục chính nếu chưa có nhóm con
- **AND** số lượng dòng, mục chính, nhóm con và tiêu chí không phụ thuộc file ví dụ

#### Scenario: Map the visible content column

- **WHEN** hệ thống parse XLSX v2
- **THEN** `NỘI DUNG YÊU CẦU` của structural row trở thành tên mục chính hoặc nhóm con
- **AND** `NỘI DUNG YÊU CẦU` của criterion row trở thành `requirement_text`
- **AND** criterion title hiện có được giữ cho identity khớp, còn criterion mới có
  title rỗng

#### Scenario: Normalize imported numbering

- **WHEN** marker La Mã hoặc số nguyên trong file không liên tục nhưng vẫn nhận diện
  được loại dòng
- **THEN** preview và dữ liệu lưu dùng thứ tự dòng để đánh lại ordinal canonical
- **AND** literal STT nhập vào không trở thành identity

#### Scenario: Preview a complete replacement

- **WHEN** workbook parse thành công
- **THEN** hệ thống hiển thị authoritative preview trước mutation
- **AND** preview báo số mục chính, nhóm con, tiêu chí và số create, update, move,
  delete theo loại entity
- **AND** confirmation nói rõ import sẽ thay thế toàn bộ cấu hình của baseline draft

#### Scenario: Apply a valid replacement atomically

- **WHEN** người dùng xác nhận preview không có lỗi
- **THEN** hệ thống revalidate metadata, identity, hierarchy và expected revision
- **AND** reconcile toàn bộ cây bằng một atomic mutation
- **AND** giữ ID/code của entity tương thích, chỉ cấp code cho tiêu chí mới
- **AND** tăng baseline revision đúng một lần

#### Scenario: Reject a workbook from another dossier

- **WHEN** workbook metadata không khớp dossier, baseline version hoặc revision đang
  chọn
- **THEN** hệ thống từ chối với lỗi ownership hoặc stale cụ thể
- **AND** không remap hidden identity và không đề nghị cross-dossier import
- **AND** hướng người dùng sang chức năng sao chép server-side

#### Scenario: Report the root hierarchy error without cascades

- **WHEN** một structural row có metadata hoặc identity không hợp lệ
- **THEN** preview báo lỗi gốc tại dòng vật lý đó
- **AND** không phát sinh hàng loạt lỗi missing-parent cho các child row chỉ phụ thuộc
  vào structural row đã lỗi
- **AND** parser tiếp tục phát hiện các lỗi độc lập khác ở boundary hợp lệ tiếp theo

#### Scenario: Reject invalid hierarchy atomically

- **WHEN** file có nội dung trước mục chính, nhóm con không có mục chính, nội dung
  bắt buộc bị trống, marker STT ngoài La Mã/số nguyên dương/trống, depth như `1.1`,
  identity ngoại lai hoặc row shape không hợp lệ
- **THEN** preview trả lỗi theo dòng vật lý
- **AND** apply không ghi một phần dữ liệu

#### Scenario: Reject an oversized workbook safely

- **WHEN** workbook vượt giới hạn file-byte hoặc số dòng có nội dung đã cấu hình
- **THEN** hệ thống từ chối toàn bộ workbook mà không truncate
- **AND** không gọi preview/apply mutation

#### Scenario: Accept XLSX only

- **WHEN** người dùng chọn CSV, `.xls` hoặc định dạng khác
- **THEN** hệ thống từ chối trước khi parse hierarchy
- **AND** hướng dẫn người dùng dùng file `.xlsx` do hệ thống phát hành

#### Scenario: Preserve legacy baseline workbook compatibility

- **WHEN** người dùng upload baseline workbook canonical version trước đó trong thời
  gian tương thích
- **THEN** hệ thống đọc các group cũ thành mục chính và criteria cũ thành tiêu chí
  trực tiếp
- **AND** không tự tạo nhóm con
- **AND** các workbook tải mới chỉ dùng contract hướng người dùng mới
