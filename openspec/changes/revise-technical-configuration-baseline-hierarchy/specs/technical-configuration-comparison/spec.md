## RENAMED Requirements

- FROM: `### Requirement: Flexible two-level baseline authoring`
- TO: `### Requirement: Structured three-level baseline authoring`

## MODIFIED Requirements

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

## ADDED Requirements

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
- **AND** hai stale phase-gate tests
  `technical-configuration-baseline-hierarchy-apply-migration.test.ts` và
  `technical-configuration-baseline-subgroup-mutations-migration.test.ts` do Issue
  #903 theo dõi không thuộc scope P5C

#### Scenario: Preserve hierarchy in final export

- **WHEN** người dùng export kết quả so sánh
- **THEN** workbook giữ mục chính, nhóm con và tiêu chí theo canonical order
- **AND** structural rows không tạo response hoặc assessment giả
- **AND** sheet partitioning và snapshot identity hiện có vẫn được bảo toàn
