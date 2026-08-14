## ADDED Requirements

### Requirement: Independent technical configuration dossier

Hệ thống SHALL cung cấp hồ sơ phân tích cấu hình kỹ thuật độc lập, trong đó mỗi hồ sơ đại diện cho đúng một loại thiết bị và không phụ thuộc bản ghi trong bảng `thiet_bi`.

#### Scenario: Create a dossier for one device type

- **WHEN** người dùng có quyền tạo hồ sơ và nhập tên loại thiết bị cùng thông tin hồ sơ
- **THEN** hệ thống tạo một hồ sơ có ID ổn định cho đúng loại thiết bị đó
- **AND** không yêu cầu chọn hoặc tạo bản ghi `thiet_bi`

#### Scenario: Prevent multiple device configurations in one dossier

- **WHEN** người dùng đang làm việc trong một hồ sơ
- **THEN** mọi phiên bản cơ sở thuộc cùng một lineage cấu hình cho cùng loại thiết bị
- **AND** hệ thống từ chối tạo lineage cấu hình cơ sở thứ hai hoặc thêm loại thiết bị thứ hai vào hồ sơ

#### Scenario: Archive a dossier

- **WHEN** người dùng archive một hồ sơ
- **THEN** hồ sơ bị ẩn khỏi danh sách mặc định nhưng vẫn đọc được khi truy cập trực tiếp hoặc yêu cầu gồm hồ sơ đã archive
- **AND** backend từ chối mọi mutation đối với hồ sơ, phiên bản cơ sở, nhóm, tiêu chí, sản phẩm tham chiếu, tài liệu, trích dẫn, nhà cung cấp, phương án, phản hồi và đánh giá thuộc hồ sơ đó
- **AND** MVP không cung cấp thao tác restore

#### Scenario: Edit active dossier metadata

- **WHEN** người dùng `admin/global` mở thao tác sửa metadata của một hồ sơ active
- **THEN** người dùng có thể sửa loại thiết bị, tên hồ sơ và mô tả rồi explicit save với dossier revision hiện tại
- **AND** backend chưa nhận mutation trước khi người dùng bấm lưu
- **AND** việc sửa metadata không thay đổi nội dung hoặc trạng thái của bất kỳ phiên bản cơ sở đã khóa nào

#### Scenario: Permanently delete a never-locked dossier

- **WHEN** người dùng `admin/global` xác nhận xóa một hồ sơ active chưa từng có bất kỳ phiên bản cơ sở `locked` nào
- **THEN** backend hard-delete dossier aggregate root cùng toàn bộ dữ liệu nháp và dữ liệu làm việc phụ thuộc trong cùng transaction
- **AND** hồ sơ không còn đọc được qua list/get và không được chuyển sang trạng thái archived
- **AND** UI phải cảnh báo thao tác là vĩnh viễn và chỉ gửi mutation sau xác nhận rõ ràng

#### Scenario: Reject deletion after the first locked baseline

- **WHEN** UI hoặc caller trực tiếp yêu cầu hard-delete một hồ sơ đã có ít nhất một phiên bản cơ sở `locked`
- **THEN** backend từ chối với conflict `locked_dossier`
- **AND** dossier cùng toàn bộ dữ liệu con không thay đổi
- **AND** hồ sơ không bao giờ trở lại trạng thái có thể hard-delete, kể cả khi sau đó có thêm một bản nháp mới

### Requirement: Global administrator access boundary

Hệ thống SHALL chỉ cho phép người dùng có semantics `admin/global` truy cập và thay đổi dữ liệu của module.

#### Scenario: Global role accesses the module

- **WHEN** session có role `global`
- **THEN** người dùng được phép truy cập route và các operation đã định nghĩa của module

#### Scenario: Legacy admin role accesses the module

- **WHEN** session có raw role `admin`
- **THEN** hệ thống dùng `isGlobalRole()` ngoài RPC proxy và áp dụng cùng quyền như `global`

#### Scenario: Other role calls the backend directly

- **WHEN** session không có semantics `admin/global` gọi route, RPC hoặc data operation của module
- **THEN** backend từ chối fail-closed
- **AND** không trả dữ liệu hồ sơ trong response lỗi

### Requirement: Structured three-level baseline authoring

Hệ thống SHALL cho phép cấu hình cơ sở có đúng ba tầng được hỗ trợ: mục chính,
nhóm con tùy chọn và tiêu chí đánh giá.

#### Scenario: Start with suggested main sections

- **WHEN** người dùng tạo bản nháp cấu hình cơ sở đầu tiên
- **THEN** hệ thống tạo các mục chính gợi ý theo thứ tự `Yêu cầu chung`,
  `Yêu cầu cấu hình cung cấp`, `Yêu cầu kỹ thuật`, `Yêu cầu khác`
- **AND** các tên này chỉ là gợi ý có thể thêm, đổi tên, xóa hoặc sắp xếp
- **AND** hệ thống không tự khôi phục mục gợi ý đã bị xóa

#### Scenario: Author direct criteria under a main section

- **WHEN** một phần cấu hình không cần nhóm con
- **THEN** người dùng có thể thêm tiêu chí trực tiếp dưới mục chính
- **AND** tiêu chí vẫn có mã ổn định, tiêu đề tùy chọn và nội dung yêu cầu nhiều
  dòng

#### Scenario: Keep mixed child organization unambiguous

- **WHEN** một mục chính có cả tiêu chí trực tiếp và nhóm con
- **THEN** canonical order đặt toàn bộ tiêu chí trực tiếp trước nhóm con đầu tiên
- **AND** mỗi nhóm con được theo sau bởi các tiêu chí con của chính nó

#### Scenario: Organize criteria under one subgroup level

- **WHEN** người dùng cần gom các tiêu chí chi tiết dưới một tiêu đề phụ
- **THEN** người dùng có thể thêm và sắp xếp nhóm con trong mục chính
- **AND** có thể thêm, di chuyển và sắp xếp tiêu chí trong nhóm con
- **AND** nhóm con không có response, evidence hoặc assessment riêng

#### Scenario: Keep one supported subgroup depth

- **WHEN** request hoặc import cố tạo nhóm con của nhóm con
- **THEN** hệ thống từ chối cấu trúc sâu hơn `mục chính -> nhóm con -> tiêu chí`
- **AND** trả về lỗi cấu trúc có thể hành động

#### Scenario: Normalize displayed ordinals

- **WHEN** người dùng thêm, xóa hoặc sắp xếp mục chính hay nhóm con
- **THEN** hệ thống tạo lại số La Mã cho mục chính và số nguyên dương cho nhóm con
  theo thứ tự canonical
- **AND** không dùng nhãn STT hiển thị làm định danh ổn định

#### Scenario: Preserve stable criterion identity

- **WHEN** tiêu chí được di chuyển giữa vị trí trực tiếp và nhóm con hoặc giữa các
  nhóm con hợp lệ trong cùng baseline
- **THEN** hệ thống giữ nguyên criterion ID và `criterion_code`
- **AND** giữ nguyên citation, option response và assessment đã liên kết

#### Scenario: Generate stable criterion codes

- **WHEN** người dùng thêm tiêu chí thủ công, qua nhập nhanh hoặc bằng dòng XLSX mới
- **THEN** hệ thống tự sinh mã kế tiếp theo dạng `TC-0001`, `TC-0002` trong phạm vi
  baseline version
- **AND** người dùng không nhập hoặc sửa mã
- **AND** reorder và move không đổi mã, copy giữ nguyên mã và hệ thống không tái sử
  dụng số của tiêu chí đã xóa

#### Scenario: Keep content columns stable

- **WHEN** người dùng mô tả yêu cầu kỹ thuật
- **THEN** mỗi tiêu chí vẫn dùng title tùy chọn và requirement text nhiều dòng
- **AND** hệ thống không thêm schema builder, min, max, unit hoặc operator bắt buộc

#### Scenario: Keep locked hierarchy immutable

- **WHEN** baseline version đã khóa
- **THEN** mục chính, nhóm con, tiêu chí và thứ tự của chúng chỉ đọc
- **AND** mọi workflow so sánh, đánh giá và export đọc cùng snapshot hierarchy đó

### Requirement: Explicit save for editable workflows

Hệ thống SHALL không autosave thay đổi trong các form soạn cấu hình, phương án hoặc đánh giá.

#### Scenario: Edit without saving

- **WHEN** người dùng sửa dữ liệu trong form nhưng chưa bấm lưu
- **THEN** backend chưa nhận mutation cho thay đổi đó
- **AND** UI thể hiện trạng thái có thay đổi chưa lưu

#### Scenario: Save current item

- **WHEN** người dùng bấm `Lưu`
- **THEN** hệ thống lưu dữ liệu hợp lệ
- **AND** giữ nguyên item hoặc tiêu chí đang xem

#### Scenario: Save and continue

- **WHEN** người dùng bấm `Lưu & tiếp tục`
- **THEN** hệ thống lưu dữ liệu hợp lệ
- **AND** chỉ sau khi lưu thành công mới chuyển tới tiêu chí kế tiếp
- **AND** tiêu chí kế tiếp là tiêu chí liền sau theo thứ tự cấu hình cơ bản, không
  tự bỏ qua tiêu chí đã có dữ liệu
- **AND** nếu không còn tiêu chí kế tiếp thì giữ nguyên tiêu chí cuối

#### Scenario: Save and continue fails

- **WHEN** thao tác `Lưu & tiếp tục` gặp lỗi validation, conflict hoặc persistence
- **THEN** UI giữ nguyên tiêu chí đang xem và dữ liệu người dùng chưa lưu
- **AND** hiển thị lỗi có thể hành động thay vì chuyển sang tiêu chí khác

#### Scenario: Open option responses without saving

- **WHEN** người dùng chọn một phương án và phiên bản cơ sở chỉ để xem phản hồi
- **THEN** backend trả comparison set hiện có hoặc trạng thái rỗng
- **AND** không tạo comparison set, không tăng dossier revision và không thay đổi audit metadata

#### Scenario: Compare and edit one selected option response

- **WHEN** người dùng chọn một phương án, exact baseline version và tiêu chí trên
  desktop
- **THEN** workspace phản hồi trải toàn chiều rộng bên dưới supplier/option
  identity và hiển thị criterion navigator, panel cấu hình cơ bản chỉ đọc cùng
  panel response/supplementary chỉnh sửa
- **AND** hai panel chỉ hiển thị tiêu chí đang chọn, không render all-criteria
  matrix
- **AND** criterion navigator phân biệt tiêu chí chưa có response, đã lưu và
  current dirty draft

#### Scenario: Copy a baseline requirement into an option response

- **WHEN** người dùng bấm `Sao chép từ cấu hình cơ bản`
- **THEN** UI copy `requirement_text` của tiêu chí đang chọn vào response draft,
  giữ nguyên supplementary information và cho phép sửa nội dung đã copy
- **AND** copy chỉ tạo dirty local draft, không autosave hoặc gửi mutation
- **AND** response không rỗng phải được xác nhận trước khi ghi đè; cancel giữ
  nguyên cả response và supplementary draft

#### Scenario: Save an option response and move to the next baseline criterion

- **WHEN** người dùng bấm primary action `Lưu & tiếp theo`
- **THEN** hệ thống dùng cùng explicit single-criterion save của secondary
  action `Lưu`
- **AND** chỉ sau khi save thành công mới chuyển tới tiêu chí liền sau theo thứ
  tự cấu hình cơ bản, không tự bỏ qua tiêu chí đã có response
- **AND** validation, conflict hoặc persistence failure giữ nguyên tiêu chí cùng
  draft; criterion cuối chỉ hiển thị `Lưu`

### Requirement: Standard baseline Excel template

Hệ thống SHALL cho phép tải và import cấu hình cơ sở bằng contract XLSX chuẩn,
hướng người dùng và được gắn với đúng bản nháp hiện tại.

#### Scenario: Download the current configuration

- **WHEN** người dùng chọn `Tải cấu hình hiện tại` trên một baseline draft
- **THEN** workbook chứa toàn bộ mục chính, nhóm con và tiêu chí theo thứ tự hiện tại
- **AND** chỉ `STT` và `NỘI DUNG YÊU CẦU` là các cột hiển thị để chỉnh sửa
- **AND** workbook giữ metadata và identity hiện có trong dữ liệu ẩn

#### Scenario: Download an empty template

- **WHEN** người dùng chọn `Tải mẫu trống`
- **THEN** sheet `Nhập cấu hình` chỉ có header và không có dòng ví dụ
- **AND** sheet `Hướng dẫn & Ví dụ` chứa hướng dẫn cùng ví dụ ngắn
- **AND** sheet `_meta` ẩn gắn file với dossier, baseline version và revision hiện tại

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

### Requirement: Immutable locked baseline versions

Hệ thống SHALL quản lý phiên bản cơ sở theo trạng thái `Bản nháp` và `Đã khóa`, đồng thời SHALL bảo đảm phiên bản đã khóa bất biến đối với mọi người dùng.

#### Scenario: Keep at most one editable draft

- **WHEN** hồ sơ đã có một phiên bản `Bản nháp` và người dùng yêu cầu tạo thêm bản nháp từ trống hoặc từ bản đã khóa
- **THEN** backend từ chối với conflict `draft_already_exists`
- **AND** các phiên bản `Đã khóa` của hồ sơ vẫn không bị giới hạn số lượng

#### Scenario: Lock a draft version

- **WHEN** người dùng `admin/global` xác nhận khóa một bản nháp hợp lệ
- **THEN** hệ thống ghi `locked_at` và `locked_by`
- **AND** phiên bản chuyển sang `Đã khóa`

#### Scenario: Reject an incomplete draft lock

- **WHEN** bản nháp không có ít nhất một nhóm và một tiêu chí có nội dung, có mã tiêu chí trùng hoặc còn lỗi import chưa xử lý
- **THEN** hệ thống từ chối khóa
- **AND** hiển thị các điều kiện cần sửa

#### Scenario: Administrator attempts to edit a locked version

- **WHEN** bất kỳ người dùng nào, kể cả `admin/global`, gửi mutation thay đổi nhóm, tiêu chí, sản phẩm tham chiếu, document metadata/URL hoặc trích dẫn cơ sở của phiên bản đã khóa
- **THEN** backend từ chối mutation
- **AND** dữ liệu đã khóa không thay đổi

#### Scenario: Delete a locked baseline document

- **WHEN** người dùng gửi yêu cầu xóa tài liệu URL thuộc phiên bản cơ sở đã khóa
- **THEN** backend từ chối trước khi thực hiện flow xác nhận xóa
- **AND** tài liệu cùng các trích dẫn vẫn được giữ nguyên

#### Scenario: Revise a locked baseline

- **WHEN** người dùng cần thay đổi cấu hình đã khóa
- **THEN** hệ thống yêu cầu tạo bản nháp mới từ trống hoặc sao chép bản đã khóa
- **AND** không mở khóa phiên bản cũ

#### Scenario: Copy the complete locked baseline aggregate

- **WHEN** người dùng tạo bản nháp bằng cách sao chép một phiên bản đã khóa
- **THEN** hệ thống tạo ID mới, đặt `source_baseline_version_id` trên phiên bản mới, giữ mã tiêu chí và liên kết `source_criterion_id`
- **AND** sao chép nhóm, tiêu chí, sản phẩm tham chiếu/phản hồi, tài liệu và trích dẫn thuộc baseline
- **AND** không sao chép nhà cung cấp, phương án, bộ so sánh, phản hồi phương án, tài liệu/trích dẫn phương án hoặc đánh giá thủ công

### Requirement: Historical baseline linkage

Hệ thống SHALL liên kết phản hồi và đánh giá với đúng phiên bản cơ sở được dùng khi so sánh.

#### Scenario: Lock a newer baseline version

- **WHEN** một phiên bản cơ sở mới được khóa
- **THEN** phản hồi và đánh giá gắn với phiên bản cũ không tự chuyển sang phiên bản mới
- **AND** người dùng vẫn có thể tra cứu kết quả theo phiên bản cũ

#### Scenario: Start comparison against a new version

- **WHEN** người dùng chọn phiên bản cơ sở mới cho một phương án
- **THEN** hệ thống tạo hoặc mở bộ phản hồi gắn với tiêu chí của phiên bản đó
- **AND** không gọi bộ phản hồi này là phiên bản hồ sơ nhà cung cấp

### Requirement: Optional reference products

Hệ thống SHALL cho phép khai báo nhiều sản phẩm tham chiếu tùy chọn trong phiên bản cơ sở, nhập nội dung đối chiếu và trích dẫn theo từng tiêu chí, đồng thời SHALL giữ chúng tách biệt với phương án nhà cung cấp.

#### Scenario: Add reference products

- **WHEN** người dùng thêm model, hãng hoặc mô tả sản phẩm tham chiếu
- **THEN** hệ thống hiển thị thông tin đó trong bối cảnh xây dựng cấu hình cơ sở
- **AND** không tạo nhà cung cấp hoặc phương án từ sản phẩm tham chiếu

#### Scenario: Compare reference products while authoring the baseline

- **WHEN** người dùng nhập nội dung của nhiều sản phẩm tham chiếu cho các tiêu chí cơ sở
- **THEN** UI hiển thị nhóm/tiêu chí theo hàng, yêu cầu cơ sở ở cột sticky và mỗi sản phẩm được chọn ở một cột động
- **AND** không đặt giới hạn nghiệp vụ cho số sản phẩm chỉ vì chiều rộng viewport

#### Scenario: Record criterion-level reference evidence

- **WHEN** người dùng liên kết tài liệu và đoạn trích của sản phẩm tham chiếu với một tiêu chí
- **THEN** hệ thống lưu bằng chứng theo đúng `sản phẩm tham chiếu + tiêu chí`
- **AND** hiển thị bằng chứng trong panel chi tiết thay vì thêm cột tài liệu cố định

#### Scenario: Rank supplier options

- **WHEN** hệ thống tính xếp hạng tham khảo
- **THEN** sản phẩm tham chiếu không được đưa vào danh sách xếp hạng

### Requirement: Multiple supplier configuration options

Hệ thống SHALL cho phép một hồ sơ có nhiều nhà cung cấp và mỗi nhà cung cấp có nhiều phương án cấu hình mà không đặt giới hạn số lượng theo quy tắc nghiệp vụ.

#### Scenario: Add multiple options for one supplier

- **WHEN** người dùng thêm nhiều model hoặc phương án cho cùng một nhà cung cấp
- **THEN** hệ thống lưu chúng như các phương án độc lập
- **AND** mỗi phương án có thể được so sánh và đánh giá riêng

#### Scenario: Identify an option throughout the workflow

- **WHEN** phương án xuất hiện trong selector, ma trận hoặc panel đánh giá
- **THEN** UI hiển thị nhãn kết hợp nhà cung cấp và model hoặc tên phương án
- **AND** người dùng có thể nhận biết quan hệ mà không cần mở cây lồng nhiều cấp

#### Scenario: Edit supplier working data

- **WHEN** người dùng sửa phương án, phản hồi tiêu chí hoặc bằng chứng của phương án
- **THEN** hệ thống cho phép lưu trực tiếp dữ liệu mới
- **AND** không yêu cầu khóa, mở khóa hoặc tạo phiên bản phương án
- **AND** baseline đã khóa không chặn sửa phản hồi hoặc bằng chứng của phương án
- **AND** hồ sơ đã archive chỉ đọc và backend từ chối mọi mutation

#### Scenario: Keep suppliers scoped to one dossier

- **WHEN** người dùng tạo hoặc đổi tên nhà cung cấp
- **THEN** nhà cung cấp chỉ được dùng bởi các phương án trong cùng hồ sơ
- **AND** backend từ chối tên trùng sau khi trim, gom khoảng trắng và chuyển chữ thường trong phạm vi hồ sơ
- **AND** hồ sơ khác có thể dùng cùng tên đã chuẩn hóa

#### Scenario: Delete one supplier option

- **WHEN** người dùng yêu cầu xóa một phương án
- **THEN** UI xác nhận bằng nhãn `Nhà cung cấp · Model hoặc tên phương án`
- **AND** cảnh báo rằng response datasets phụ thuộc của phương án cũng bị xóa
- **AND** chỉ gửi mutation sau khi người dùng xác nhận

#### Scenario: Delete a supplier and its options

- **WHEN** người dùng yêu cầu xóa một nhà cung cấp
- **THEN** UI hiển thị số phương án bị ảnh hưởng và yêu cầu xác nhận phá hủy
- **AND** cảnh báo rằng mọi phương án cùng response datasets phụ thuộc cũng bị xóa
- **AND** chỉ gửi mutation sau khi người dùng xác nhận

### Requirement: Standard supplier option Excel template

Hệ thống SHALL cho phép xuất và import phản hồi phương án bằng template chuẩn
được tạo từ exact baseline version đang chọn. Import SHALL là authoritative full
snapshot của toàn bộ tập tiêu chí hiện tại và chỉ được ghi sau preview cùng xác
nhận rõ ràng.

#### Scenario: Export an option template

- **WHEN** người dùng yêu cầu template cho một phương án và phiên bản cơ sở
- **THEN** workbook có đúng một sheet hiển thị `OptionResponses`, một sheet ẩn
  `_meta` và không có sheet hoặc cột nội dung khác
- **AND** sheet dữ liệu chứa đúng thứ tự cột `group_order`, `group_name`,
  `criterion_order`, `criterion_id`, `criterion_code`, `criterion_title`,
  `requirement_text`, `response_text`, `supplementary_information`
- **AND** metadata xác định đúng kind/version, dossier, option, baseline version,
  dossier revision và thời điểm sinh file

#### Scenario: Preview and apply a complete option-response snapshot

- **WHEN** người dùng import template hợp lệ cho đúng phiên bản cơ sở
- **THEN** mọi tiêu chí hiện tại xuất hiện đúng một lần và hệ thống hiển thị
  authoritative preview trước khi lưu
- **AND** preview không tạo comparison set, không ghi response, không tăng
  revision và không thay đổi audit metadata
- **AND** ô phản hồi hoặc thông tin bổ sung trống được hiểu là xóa giá trị cũ
  của trường tương ứng sau khi người dùng xác nhận
- **AND** confirmed apply có thể tạo comparison set trong cùng transaction,
  reconcile toàn bộ snapshot và tăng dossier revision đúng một lần

#### Scenario: Reject a mismatched option template

- **WHEN** metadata không khớp dossier, option hoặc baseline version, hoặc tập
  dòng thiếu tiêu chí, chứa tiêu chí lạ hay trùng tiêu chí
- **THEN** preview/apply từ chối toàn bộ workbook và không ghi dữ liệu
- **AND** không hiểu dòng bị xóa là lệnh clear
- **AND** hiển thị lỗi theo dòng hoặc lỗi target/version phù hợp

#### Scenario: Reject an arbitrary option workbook

- **WHEN** workbook thiếu metadata chuẩn, sai template version, có thêm sheet,
  thêm cột hoặc chứa cell value không được hỗ trợ dù tên cột nhìn tương tự
- **THEN** hệ thống không ghi dữ liệu
- **AND** hướng dẫn người dùng xuất template từ phiên bản cơ sở đang chọn

#### Scenario: Preserve import state after a stale apply

- **WHEN** confirmed apply bị từ chối vì dossier revision đã stale
- **THEN** hệ thống không tạo comparison set hoặc ghi một phần response
- **AND** UI giữ selected file, canonical rows và preview hiện tại
- **AND** người dùng có thể refresh revision và yêu cầu authoritative preview
  lại trước khi xác nhận lần nữa

### Requirement: URL-only document profiles

Hệ thống SHALL quản lý tài liệu tham khảo dưới dạng metadata URL `http` hoặc
`https` tuyệt đối và SHALL không upload hoặc lưu nội dung file. URL được chấp
nhận SHALL có case-insensitive lexical prefix `^https?://`, không chứa raw
backslash, parse thành công và có parsed protocol `http:` hoặc `https:`. Client
validation SHALL provide early feedback, nhưng create/update RPC SHALL enforce
cùng contract trước khi ghi. Validation SHALL không trim, canonicalize hoặc
rewrite accepted value. Tài liệu của phương án SHALL thuộc `option_id` và được
dùng chung qua các baseline version; citation của tài liệu đó vẫn thuộc exact
comparison set.

#### Scenario: Add a valid document URL

- **WHEN** người dùng nhập tên tài liệu và absolute `http`/`https` URL hợp lệ,
  gồm mixed-case scheme như `HtTpS://EXAMPLE.com/a/../spec.pdf`, cho cấu hình cơ
  sở, sản phẩm tham chiếu hoặc phương án
- **THEN** hệ thống lưu metadata liên kết
- **AND** create/update/list giữ và trả đúng raw URL đã được chấp nhận
- **AND** cho phép mở URL trong tab mới với thuộc tính bảo vệ phù hợp

#### Scenario: Reject an invalid URL

- **WHEN** người dùng nhập URL không parse được, protocol-only/single-slash hoặc
  backslash shorthand, hoặc dùng protocol ngoài `http`/`https`
- **THEN** hệ thống không lưu
- **AND** hiển thị lỗi URL ngay tại form

#### Scenario: Keep module documents independent from equipment

- **WHEN** người dùng lưu tài liệu URL trong module
- **THEN** tài liệu thuộc đúng phiên bản cơ sở, sản phẩm tham chiếu hoặc phương án tương ứng
- **AND** không yêu cầu hoặc tạo liên kết tới `thiet_bi`

#### Scenario: Reuse one option document across baseline versions

- **WHEN** cùng một phương án được đối chiếu với nhiều baseline version
- **THEN** danh sách tài liệu của phương án dùng chung các document record theo
  `option_id`
- **AND** mỗi lần đọc chỉ trả citation thuộc comparison set của exact baseline
  version đang chọn

#### Scenario: Delete an option document with linked citations

- **WHEN** người dùng yêu cầu xóa một tài liệu phương án đang có citation trên
  một hoặc nhiều baseline version
- **THEN** UI hiển thị tổng số citation bị ảnh hưởng và chưa gửi mutation trước
  khi người dùng xác nhận
- **AND** confirmed delete xóa document cùng toàn bộ citation liên quan trong
  một transaction
- **AND** nếu mutation thất bại thì document và mọi citation vẫn còn nguyên

### Requirement: Criterion-level document citations

Hệ thống SHALL cho phép liên kết một tài liệu URL với từng tiêu chí bằng trang/mục và đoạn trích cụ thể.

#### Scenario: Link evidence to a criterion

- **WHEN** người dùng chọn tài liệu của cấu hình cơ sở, sản phẩm tham chiếu hoặc phương án và nhập trang/mục hoặc đoạn trích
- **THEN** hệ thống lưu liên kết với đúng tiêu chí và đúng owner của tài liệu
- **AND** citation của phương án thuộc đúng option, exact baseline version và
  exact criterion thông qua comparison set tương ứng
- **AND** backend từ chối liên kết chéo option, baseline version hoặc criterion
- **AND** hiển thị trích dẫn trong panel đánh giá tiêu chí đó

#### Scenario: Reuse one document for multiple criteria

- **WHEN** cùng một tài liệu hỗ trợ nhiều tiêu chí
- **THEN** người dùng có thể tạo nhiều liên kết tiêu chí tới cùng document record
- **AND** không cần tạo bản sao URL

### Requirement: Scan-friendly comparison matrix

Hệ thống SHALL cung cấp ma trận so sánh cấu hình cơ sở với các phương án được chọn, tối ưu cho quét nhanh dữ liệu text dài và nhiều cột.

#### Scenario: Compare selected options

- **WHEN** người dùng chọn các phương án trong cùng hồ sơ và phiên bản cơ sở
- **THEN** ma trận hiển thị yêu cầu cơ sở và phản hồi của từng phương án theo cùng thứ tự nhóm/tiêu chí
- **AND** nhóm/tiêu chí là hàng, cột yêu cầu là sticky và mỗi phương án là một cột động
- **AND** ma trận chỉ dùng để đọc/kiểm tra, không render response textarea,
  `Sao chép từ cấu hình cơ bản`, dirty draft, `Lưu` hoặc `Lưu & tiếp theo` của
  focused authoring workspace

#### Scenario: Do not introduce arbitrary matrix dimensions

- **WHEN** ma trận được tạo từ cấu hình cơ sở
- **THEN** hệ thống không biến bốn nhóm hoặc trường nội dung tùy ý thành cột ngang
- **AND** tài liệu, text đầy đủ và đánh giá chi tiết được mở từ panel

#### Scenario: Work with many options

- **WHEN** số phương án vượt chiều rộng viewport
- **THEN** UI hỗ trợ cuộn ngang và chọn, ghim hoặc tập trung cột
- **AND** không đặt giới hạn nghiệp vụ chỉ vì giới hạn màn hình

#### Scenario: Bound one matrix request

- **WHEN** hồ sơ có nhiều hơn tám phương án hoặc phiên bản cơ sở có nhiều hơn một trăm tiêu chí
- **THEN** một request ma trận chỉ chấp nhận tối đa tám phương án được chọn và tối đa một trăm tiêu chí
- **AND** phương án thứ chín vẫn tồn tại và có thể được chọn trong request khác
- **AND** hệ thống không đặt giới hạn tổng số phương án của hồ sơ

#### Scenario: Inspect detailed evidence

- **WHEN** người dùng mở một ô hoặc tiêu chí từ ma trận
- **THEN** UI mở panel chi tiết chứa text đầy đủ, tài liệu và đánh giá
- **AND** không nhồi toàn bộ nội dung dài vào ô ma trận

### Requirement: Per-option manual evaluation workflow

Hệ thống SHALL ưu tiên workflow đánh giá thủ công một phương án tại một thời
điểm bằng danh sách tiêu chí và panel chi tiết. Tiến độ và bộ lọc SHALL dùng
toàn bộ criterion universe của selected locked baseline, SHALL reconcile
complete assessments bằng `criterion_id` và MUST không suy diễn từ sự trùng
khớp giữa assessment page với comparison page.

#### Scenario: Select a criterion for evaluation

- **WHEN** người dùng chọn một tiêu chí trong danh sách bên trái
- **THEN** panel bên phải hiển thị yêu cầu cơ sở, phản hồi, thông tin bổ sung, trích dẫn và đánh giá của phương án đang chọn

#### Scenario: Show selected-option evaluation progress

- **WHEN** người dùng chọn một phương án và complete assessment collection đã tải
- **THEN** mẫu số tiến độ là toàn bộ tiêu chí của selected locked baseline
- **AND** hệ thống hiển thị số đã có kết luận, số `Chưa đánh giá`, `Không đạt`
  và `Chưa đủ bằng chứng` cho option đang chọn
- **AND** mỗi group SHALL có compact progress summary từ cùng canonical counters
- **AND** exact presentation density được xác nhận tại P12B1 entry gate, không
  bị khóa bởi requirement này
- **AND** chỉ `not_evaluated` được tính là chưa hoàn tất; sáu derived statuses
  còn lại được tính là đã có kết luận

#### Scenario: Avoid false progress while assessments are unavailable

- **WHEN** complete assessment collection đang loading hoặc error
- **THEN** hệ thống MUST không hiển thị toàn bộ criterion universe như
  `Chưa đánh giá`
- **AND** UI hiển thị loading hoặc error state tương ứng

#### Scenario: Reflect a successful assessment save in progress

- **WHEN** save một assessment thành công và mutation trả assessment đã lưu
- **THEN** progress model SHALL reconcile assessment đó bằng `criterion_id`
- **AND** summary của option đang chọn phản ánh kết quả mới mà không cần một
  aggregate query thứ hai

#### Scenario: Filter evaluation criteria by derived status

- **WHEN** người dùng chọn một filter `all`, `not_evaluated`, `fails` hoặc
  `insufficient_evidence`
- **THEN** guarded read-only RPC SHALL áp dụng derived-status precedence ở
  server và trả exact filtered criterion IDs
- **AND** projection giữ canonical group/criterion order
- **AND** mỗi criterion xuất hiện đúng theo derived status chuẩn dùng chung
- **AND** P12B1 progress data shape, counters và complete-assessment cache
  ownership không đổi

#### Scenario: Preserve or guard selection when a filter changes

- **WHEN** filter mới vẫn chứa criterion đang chọn
- **THEN** hệ thống SHALL giữ criterion, filtered page và panel state hiện tại
- **WHEN** filter mới loại criterion đang chọn nhưng còn kết quả
- **THEN** hệ thống SHALL đi qua dirty-confirm/pending-block contract hiện có
- **AND** clean hoặc confirmed navigation chọn first canonical match
- **AND** cancel giữ filter cũ, filtered page cũ, criterion cũ, panel/open state
  và local draft
- **AND** pending save MUST hard-block filter change

#### Scenario: Show an empty filtered result

- **WHEN** active filter không có criterion phù hợp cho option đang chọn
- **THEN** hệ thống SHALL giữ selected option, clear criterion selection và đóng
  detail panel
- **AND** UI hiển thị empty state theo filter cùng action xóa filter

#### Scenario: Page a filtered projection without changing detail scope

- **WHEN** filtered projection vượt page size hiện có
- **THEN** server SHALL trả bounded filtered-ID pages theo canonical order
- **AND** client SHALL thu complete filtered IDs rồi paginate phần hiển thị theo
  page size hiện có mà không re-filter assessment rows
- **AND** khi chọn criterion, comparison detail SHALL dùng canonical source page
  của criterion thay vì filtered page number

#### Scenario: Save and continue within the active filter

- **WHEN** `Lưu & tiếp tục` thành công và còn matching criterion sau current
  canonical position
- **THEN** hệ thống SHALL chọn matching criterion kế tiếp, kể cả qua
  group/page boundary
- **WHEN** save thất bại
- **THEN** hệ thống MUST giữ filter, page, criterion và local draft hiện tại

### Requirement: Separate manual evaluation axes

Hệ thống SHALL lưu riêng mức đáp ứng kỹ thuật và mức đầy đủ bằng chứng cho từng cặp phương án-tiêu chí.

#### Scenario: Record the technical axis

- **WHEN** người dùng đánh giá mức đáp ứng
- **THEN** người dùng chọn một trong `Vượt yêu cầu`, `Đạt`, `Không đạt`, `Chưa rõ`, `Không áp dụng`

#### Scenario: Record the evidence axis

- **WHEN** người dùng đánh giá bằng chứng
- **THEN** người dùng chọn một trong `Đầy đủ`, `Một phần`, `Thiếu`, `Không yêu cầu`

#### Scenario: Keep manual evaluation authoritative

- **WHEN** phản hồi hoặc thông tin bổ sung của phương án thay đổi
- **THEN** hệ thống không tự động thay đổi hoặc xóa kết luận thủ công đã lưu

### Requirement: Transparent derived overall status

Hệ thống SHALL suy ra trạng thái tổng hợp bằng một quy tắc chuẩn dùng chung và SHALL không cho người dùng sửa trực tiếp trạng thái tổng hợp.

#### Scenario: Technical failure takes precedence

- **WHEN** mức đáp ứng là `Không đạt`
- **THEN** trạng thái tổng hợp là `Không đạt` bất kể trạng thái bằng chứng

#### Scenario: Unclear technical conclusion

- **WHEN** mức đáp ứng là `Chưa rõ`
- **THEN** trạng thái tổng hợp là `Chưa rõ` bất kể trạng thái bằng chứng

#### Scenario: Evidence is insufficient

- **WHEN** mức đáp ứng là `Đạt` hoặc `Vượt yêu cầu`
- **AND** bằng chứng là `Một phần` hoặc `Thiếu`
- **THEN** trạng thái tổng hợp là `Chưa đủ bằng chứng`

#### Scenario: Evidence supports the conclusion

- **WHEN** mức đáp ứng là `Đạt` hoặc `Vượt yêu cầu`
- **AND** bằng chứng là `Đầy đủ` hoặc `Không yêu cầu`
- **THEN** trạng thái tổng hợp giữ kết luận `Đạt` hoặc `Vượt yêu cầu` tương ứng

#### Scenario: Criterion is not applicable

- **WHEN** mức đáp ứng là `Không áp dụng`
- **THEN** trạng thái tổng hợp là `Không áp dụng`

#### Scenario: Technical axis is missing

- **WHEN** người dùng chưa chọn mức đáp ứng kỹ thuật
- **THEN** trạng thái tổng hợp là `Chưa đánh giá`

#### Scenario: Evidence axis is missing

- **WHEN** mức đáp ứng là `Đạt` hoặc `Vượt yêu cầu`
- **AND** người dùng chưa chọn mức đầy đủ bằng chứng
- **THEN** trạng thái tổng hợp là `Chưa đánh giá`

### Requirement: Non-scoring supplementary information

Hệ thống SHALL lưu thông tin chỉ do nhà cung cấp khai báo trong trường "Thông tin bổ sung" tách khỏi phản hồi đáp ứng.

#### Scenario: Display supplementary information

- **WHEN** phương án có thông tin bổ sung cho một tiêu chí
- **THEN** nội dung được hiển thị trong panel và bề mặt so sánh phù hợp

#### Scenario: Derive compliance status

- **WHEN** hệ thống suy ra trạng thái tổng hợp
- **THEN** nội dung thông tin bổ sung không tham gia quy tắc
- **AND** không thay đổi kết quả đáp ứng cấu hình cơ sở đã khóa

### Requirement: Optional transparent reference ranking

Hệ thống SHALL cho phép người dùng yêu cầu xếp hạng tham khảo các phương án trong cùng hồ sơ và phiên bản cơ sở từ kết luận thủ công.

#### Scenario: Calculate reference ranking

- **WHEN** người dùng yêu cầu xếp hạng
- **THEN** hệ thống ưu tiên lần lượt ít `Không đạt`, ít `Chưa đủ bằng chứng`, rồi nhiều `Vượt yêu cầu`
- **AND** không dùng tiêu chí ẩn hoặc kết quả AI

#### Scenario: Exclude an incomplete option from ranking

- **WHEN** phương án còn tiêu chí áp dụng chưa có mức đáp ứng kỹ thuật hoặc mức đầy đủ bằng chứng
- **THEN** hệ thống không gán hạng cho phương án đó
- **AND** hiển thị `Chưa đủ dữ liệu để xếp hạng`

#### Scenario: Produce a tie

- **WHEN** hai hoặc nhiều phương án có cùng bộ đếm theo quy tắc
- **THEN** các phương án được đồng hạng

#### Scenario: Show ranking disclaimer

- **WHEN** xếp hạng được hiển thị hoặc xuất
- **THEN** UI ghi rõ đây là xếp hạng tham khảo, không phải quyết định lựa chọn nhà cung cấp

#### Scenario: Prevent cross-ranking

- **WHEN** các phương án thuộc hồ sơ hoặc phiên bản cơ sở khác nhau
- **THEN** hệ thống không đưa chúng vào cùng một xếp hạng

#### Scenario: Source data changes after manual evaluation

- **WHEN** phản hồi hoặc tài liệu nhà cung cấp thay đổi sau khi kết luận thủ công được lưu
- **THEN** hệ thống giữ nguyên kết luận thủ công và eligibility hiện tại dựa trên kết luận đó
- **AND** không gắn trạng thái `Đã lỗi thời` cho đánh giá thủ công

### Requirement: AI-ready data boundaries without MVP AI runtime

Hệ thống SHALL giữ các biên dữ liệu ổn định cần cho AI tương lai, đồng thời SHALL không cung cấp runtime AI trong MVP.

#### Scenario: Preserve criterion-level analysis inputs

- **WHEN** dữ liệu cấu hình, phản hồi và bằng chứng được lưu
- **THEN** mỗi entity có ID ổn định và quan hệ rõ tới tiêu chí, phương án và phiên bản cơ sở
- **AND** đoạn trích tài liệu được phân biệt với document URL

#### Scenario: Keep manual and machine conclusions separate

- **WHEN** AI được đề xuất trong change tương lai
- **THEN** kết quả máy có thể được lưu tách biệt mà không ghi đè hai trục đánh giá thủ công

#### Scenario: Operate the MVP

- **WHEN** người dùng sử dụng module MVP
- **THEN** không có nút AI, AI API call, AI job, AI cache, AI quota, AI column hoặc unused AI table
- **AND** mọi workflow lập, so sánh và đánh giá vẫn hoàn chỉnh bằng thao tác thủ công

### Requirement: Optimistic conflict protection

Hệ thống SHALL ngăn ghi đè âm thầm khi dữ liệu làm việc đã thay đổi kể từ lúc form được mở.

#### Scenario: Save current revision

- **WHEN** form gửi `p_expected_revision` khớp `revision BIGINT` hiện tại của aggregate sở hữu
- **THEN** mutation được phép lưu và trả revision mới

#### Scenario: Save a stale revision

- **WHEN** dữ liệu đã được sửa từ tab hoặc session khác
- **THEN** backend từ chối ghi đè
- **AND** UI giữ nội dung chưa lưu để người dùng đối chiếu hoặc tải lại

### Requirement: Final comparison result Excel export

Hệ thống SHALL cho phép người dùng xuất kết quả cuối của một hồ sơ và phiên bản
cơ sở ra workbook Excel theo phạm vi được xác nhận rõ ràng.

#### Scenario: Ask for export content and scope

- **WHEN** người dùng chọn `Xuất kết quả Excel`
- **THEN** hệ thống mở dialog trước khi tạo file
- **AND** cho chọn `Đầy đủ`, `Chỉ xếp hạng` hoặc `Chỉ ma trận chi tiết`
- **AND** khi dữ liệu có phân trang, cho chọn rõ phạm vi phương án và tiêu chí

#### Scenario: Default to the complete universe

- **WHEN** dialog export mở lần đầu cho hồ sơ và phiên bản cơ sở hiện tại
- **THEN** mặc định là toàn bộ phương án và toàn bộ tiêu chí
- **AND** hệ thống không âm thầm dùng phương án hoặc trang tiêu chí đang hiển thị

#### Scenario: Export a complete workbook

- **WHEN** người dùng xác nhận nội dung `Đầy đủ`
- **THEN** workbook có các sheet hiển thị `Tổng quan`, `Xếp hạng` và
  `Ma trận chi tiết`
- **AND** có một sheet `_meta` ẩn chứa version, scope và snapshot identity

#### Scenario: Export only the requested result surface

- **WHEN** người dùng chọn `Chỉ xếp hạng` hoặc `Chỉ ma trận chi tiết`
- **THEN** workbook giữ `Tổng quan` và chỉ thêm sheet kết quả đã chọn
- **AND** không tải hoặc render surface kết quả không thuộc lựa chọn

#### Scenario: Preserve the approved workbook layout

- **WHEN** workbook được tạo
- **THEN** title, header, border, zebra row, wrap, filter, freeze pane, status
  fill và disclaimer tuân theo P14 visual contract
- **AND** không có chart, gradient, score, percentage hoặc quyết định lựa chọn
  nhà cung cấp

#### Scenario: Export a canonical stable snapshot

- **WHEN** hệ thống thu nhiều page hoặc chunk để tạo workbook
- **THEN** mọi response thuộc cùng dossier, baseline, scope, total và opaque
  snapshot identity
- **AND** hệ thống đọc lại manifest trước khi tạo file

#### Scenario: Reject a changed export snapshot

- **WHEN** option, criterion, response, supplementary information, document,
  citation hoặc manual assessment thay đổi trong lúc export
- **THEN** hệ thống hủy toàn bộ thao tác
- **AND** không tải partial workbook
- **AND** yêu cầu người dùng thử lại

#### Scenario: Keep export read-only

- **WHEN** export gặp option chưa có comparison set, response hoặc assessment
- **THEN** hệ thống biểu diễn dữ liệu thiếu bằng empty/null và trạng thái hiện có
- **AND** không tạo comparison set, không ghi dữ liệu và không tăng revision

#### Scenario: Continue beyond one Excel matrix sheet

- **WHEN** số option vượt giới hạn cột vật lý của một Excel worksheet
- **THEN** hệ thống tạo các sheet `Ma trận chi tiết 2`,
  `Ma trận chi tiết 3` tiếp theo với cùng context columns và style
- **AND** không truncate hoặc đặt hidden cap lên tổng option

### Requirement: Hierarchical aggregate evaluation status

Hệ thống SHALL hiển thị trạng thái tổng hợp cho mục chính và nhóm con từ các tiêu
chí hậu duệ mà không tạo assessment riêng cho structural row.

#### Scenario: Show an empty aggregate

- **WHEN** structural row không có tiêu chí hậu duệ
- **THEN** structural row hiển thị `Chưa có tiêu chí`
- **AND** không hiển thị `Không áp dụng`, `Đạt` hoặc `Không đạt`
- **AND** mọi descendant count bằng 0

#### Scenario: Fail a subgroup immediately

- **WHEN** ít nhất một tiêu chí con của nhóm con có derived status `failed`
- **THEN** nhóm con hiển thị `Không đạt` ngay sau khi kết quả authoritative được lưu
- **AND** các tiêu chí còn lại có thể vẫn đang chưa đánh giá

#### Scenario: Fail a main section immediately

- **WHEN** ít nhất một tiêu chí trực tiếp hoặc tiêu chí trong nhóm con của mục chính
  có derived status `failed`
- **THEN** mục chính hiển thị `Không đạt`

#### Scenario: Show an in-progress aggregate

- **WHEN** không có tiêu chí hậu duệ `failed` và còn ít nhất một tiêu chí
  `not_evaluated`
- **THEN** structural row hiển thị `Đang đánh giá`

#### Scenario: Show an aggregate requiring clarification

- **WHEN** mọi tiêu chí hậu duệ đã được đánh giá, không có `failed`, và có ít nhất
  một tiêu chí `unclear` hoặc `insufficient_evidence`
- **THEN** structural row hiển thị `Cần làm rõ`

#### Scenario: Show an all-not-applicable aggregate

- **WHEN** mọi tiêu chí hậu duệ đều `not_applicable`
- **AND** có ít nhất một tiêu chí hậu duệ
- **THEN** structural row hiển thị `Không áp dụng`

#### Scenario: Show a passing aggregate

- **WHEN** mọi tiêu chí hậu duệ áp dụng được đều là `meets` hoặc `exceeds`
- **AND** có ít nhất một tiêu chí áp dụng được
- **THEN** structural row hiển thị `Đạt`
- **AND** số tiêu chí `exceeds` được hiển thị như thông tin bổ sung

#### Scenario: Explain the aggregate

- **WHEN** structural row hiển thị trạng thái tổng hợp
- **THEN** người dùng có thể thấy số descendant criteria theo từng canonical derived
  status
- **AND** có thể mở structural row để xem các tiêu chí tạo nên kết quả

#### Scenario: Keep aggregate independent from presentation state

- **WHEN** người dùng đổi filter, transport page, comparison page hoặc thu gọn structural
  row
- **THEN** aggregate status/counts vẫn lấy từ authoritative complete assessment cache
  trên toàn bộ descendant leaf criteria của baseline
- **AND** unsaved assessment draft không thay đổi aggregate
- **AND** full progress/summary vẫn hiển thị empty section/subgroup với descendant
  counts bằng `0`

#### Scenario: Adopt only authoritative complete assessment state

- **WHEN** lưu assessment thành công
- **THEN** known-complete cache được cập nhật theo criterion ID trước aggregate refresh
- **AND** known-empty comparison set vừa được tạo có thể được seed bằng assessment đã lưu
- **AND** cache unavailable/failed của comparison set đã tồn tại không được coi là
  authoritative từ một assessment riêng lẻ
- **AND** filtered-navigation refresh failure hiển thị lỗi có thể retry mà không làm
  hỏng aggregate authoritative hiện có

#### Scenario: Count each criterion once

- **WHEN** hệ thống tính progress, filter totals, aggregate hoặc ranking input
- **THEN** mỗi leaf criterion chỉ đóng góp đúng một lần theo criterion ID
- **AND** mục chính và nhóm con không làm tăng denominator hoặc score

### Requirement: Hierarchy-aware technical configuration surfaces

Hệ thống SHALL giữ cùng thứ tự ba tầng trên các bề mặt baseline, comparison,
evaluation và result export.

#### Scenario: Render hierarchy in baseline authoring

- **WHEN** người dùng mở baseline draft
- **THEN** hệ thống hiển thị mục chính, nhóm con và tiêu chí theo canonical order
- **AND** structural rows có thể thu gọn hoặc mở rộng
- **AND** chỉ tiêu chí hiển thị trường nội dung đánh giá được

#### Scenario: Render hierarchy in comparison

- **WHEN** người dùng mở ma trận so sánh
- **THEN** mục chính và nhóm con hiển thị như heading rows
- **AND** option response, evidence và detail actions chỉ nằm trên criterion rows

#### Scenario: Navigate only assessable criteria

- **WHEN** người dùng dùng evaluation navigator, filter hoặc `Lưu & tiếp tục`
- **THEN** selection và navigation chỉ đi qua leaf criteria
- **AND** structural rows vẫn hiển thị aggregate status và descendant progress

#### Scenario: Preserve canonical evaluation leaf order

- **WHEN** evaluation read contract liệt kê direct criteria và subgroup criteria
- **THEN** thứ tự canonical dùng main-section `sort_order`, main-section ID,
  direct-before-subgroup discriminator, subgroup `sort_order`, subgroup ID, criterion
  `sort_order`, criterion ID
- **AND** `canonical_index` được tính trên toàn bộ leaf universe trước status filter
- **AND** `canonical_page` dùng comparison page size `50`
- **AND** filtered page và JSON aggregate đều được sắp theo `canonical_index`
- **AND** transport page size vẫn bị chặn ở tối đa `100`

#### Scenario: Render page-local evaluation headings

- **WHEN** navigator hiển thị một filtered presentation page
- **THEN** chỉ section/subgroup ancestors của leaf criteria trên page đó được hiển thị
- **AND** empty structures chỉ xuất hiện trong full progress/summary, không tạo orphan
  navigator heading
- **AND** legacy two-level baseline vẫn hiển thị criteria như direct children

#### Scenario: Consume one prebuilt evaluation hierarchy row union

- **WHEN** evaluation presentation nhận canonical leaves của filtered page hiện tại
- **THEN** presentation layer chỉ dựng một ordered section/subgroup/criterion row union
- **AND** navigator pane chuyển tiếp readonly row union đó cho criterion renderer
- **AND** criterion renderer render/filter trực tiếp row union đã nhận, không flatten
  hoặc dựng lại hierarchy từ leaf projection
- **AND** controlled expanded-ID input và expansion-change callback vẫn hỗ trợ
  auto-expand ancestors của selected hidden leaf

#### Scenario: Collapse evaluation presentation locally

- **WHEN** structural rows được mở mặc định và người dùng thu gọn một row
- **THEN** chỉ descendant presentation rows bị ẩn
- **AND** leaf totals, filter totals, pagination, selection, save/save-next, dirty guard,
  denominator, ranking và score không đổi
- **AND** navigation tự mở ancestors trước khi chọn một hidden leaf
- **AND** structural rows không selectable và không có assessment control

#### Scenario: Keep adjacent P5C surfaces unchanged

- **WHEN** P5C hierarchy/progress được triển khai
- **THEN** comparison behavior và result-export contract không thay đổi
- **AND** criterion assessment persistence không thay đổi

#### Scenario: Preserve hierarchy in final export

- **WHEN** người dùng export kết quả so sánh
- **THEN** workbook giữ mục chính, nhóm con và tiêu chí theo canonical order
- **AND** structural rows không tạo response hoặc assessment giả
- **AND** sheet partitioning và snapshot identity hiện có vẫn được bảo toàn
