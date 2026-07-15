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

### Requirement: Flexible two-level baseline authoring

Hệ thống SHALL cho phép cấu hình cơ sở được tổ chức theo hai cấp `Nhóm cấu hình -> Tiêu chí`, trong đó nội dung kỹ thuật được lưu dưới dạng text nhiều dòng, không yêu cầu schema số học và không cho tạo cột nội dung tùy ý.

#### Scenario: Start with four suggested groups

- **WHEN** người dùng tạo một bản nháp cấu hình cơ sở trống
- **THEN** hệ thống khởi tạo `Yêu cầu chung`, `Yêu cầu cấu hình cung cấp`, `Yêu cầu kỹ thuật` và `Yêu cầu khác` theo thứ tự
- **AND** lưu chúng như group records thông thường, không phải enum hoặc danh mục khóa cứng

#### Scenario: Author arbitrary technical text

- **WHEN** người dùng thêm một tiêu chí vào bản nháp
- **THEN** người dùng có thể nhập tiêu đề tùy chọn và nội dung yêu cầu nhiều dòng
- **AND** hệ thống không bắt buộc min, max, unit hoặc operator

#### Scenario: Adapt groups to a device type

- **WHEN** bốn nhóm gợi ý không phù hợp với loại thiết bị đang phân tích
- **THEN** người dùng có thể thêm, đổi tên, xóa hoặc sắp xếp nhóm trong bản nháp
- **AND** hệ thống không giới hạn số nhóm hoặc tiêu chí theo quy tắc nghiệp vụ

#### Scenario: Keep content columns stable

- **WHEN** người dùng soạn thủ công hoặc import cấu hình cơ sở
- **THEN** hệ thống dùng tập trường cấu trúc đã định nghĩa cho nhóm và tiêu chí
- **AND** không cung cấp schema builder hoặc tạo thêm arbitrary content columns
- **AND** hướng dẫn biểu diễn nội dung bổ sung bằng tiêu chí riêng hoặc text nhiều dòng

#### Scenario: Organize and reorder requirements

- **WHEN** người dùng thêm hoặc sắp xếp nhóm và tiêu chí trong bản nháp
- **THEN** hệ thống lưu thứ tự rõ ràng cho nhóm và tiêu chí
- **AND** ma trận và workflow đánh giá dùng cùng thứ tự đó

#### Scenario: Generate stable criterion codes

- **WHEN** người dùng thêm tiêu chí thủ công, qua nhập nhanh hoặc bằng dòng Excel mới
- **THEN** hệ thống tự sinh mã kế tiếp theo dạng `TC-0001`, `TC-0002` trong phạm vi phiên bản cơ sở
- **AND** người dùng không nhập hoặc sửa mã
- **AND** reorder không đổi mã, copy giữ nguyên mã và hệ thống không tự tái sử dụng số của tiêu chí đã xóa

#### Scenario: Reject deeper nesting

- **WHEN** dữ liệu import hoặc request cố tạo tiêu chí con sâu hơn cấp nhóm và tiêu chí
- **THEN** hệ thống từ chối cấu trúc không được hỗ trợ
- **AND** hướng dẫn người dùng biểu diễn nội dung chi tiết bằng text nhiều dòng

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

#### Scenario: Save and continue fails

- **WHEN** thao tác `Lưu & tiếp tục` gặp lỗi validation, conflict hoặc persistence
- **THEN** UI giữ nguyên tiêu chí đang xem và dữ liệu người dùng chưa lưu
- **AND** hiển thị lỗi có thể hành động thay vì chuyển sang tiêu chí khác

### Requirement: Standard baseline Excel template

Hệ thống SHALL cho phép import cấu hình cơ sở chỉ từ template Excel chuẩn do hệ thống phát hành.

#### Scenario: Import a valid baseline template

- **WHEN** người dùng chọn template hợp lệ có nhóm, tiêu chí, mã, thứ tự và nội dung text trong tập cột chuẩn
- **THEN** hệ thống parse dữ liệu và hiển thị preview trước khi ghi
- **AND** giữ nguyên Unicode tiếng Việt và text nhiều dòng

#### Scenario: Use editable suggested groups in the template

- **WHEN** người dùng tải template cấu hình cơ sở mới
- **THEN** template có sẵn bốn nhóm gợi ý
- **AND** người dùng có thể thêm, đổi tên, xóa hoặc sắp xếp nhóm bằng các dòng hợp lệ mà không thêm cột mới

#### Scenario: Preserve the baseline workbook row contract

- **WHEN** hệ thống xuất hoặc import template cấu hình cơ sở
- **THEN** workbook có đúng một sheet dữ liệu hiển thị dùng các dòng `GROUP` và `CRITERION`, cùng một sheet `_meta` ẩn chứa metadata/version
- **AND** mã của tiêu chí đã tồn tại là chỉ đọc và phải giữ nguyên
- **AND** dòng tiêu chí mới để trống mã trong file; preview/apply mới sinh mã

#### Scenario: Reject an unsupported spreadsheet

- **WHEN** file thiếu template metadata, sai version hoặc có cấu trúc không hợp lệ
- **THEN** hệ thống không ghi dữ liệu
- **AND** hiển thị lỗi có thể hành động để người dùng tải template đúng

#### Scenario: Reject row-level errors atomically

- **WHEN** preview có dòng lỗi, mã trùng hoặc cấu trúc tiêu chí không hợp lệ
- **THEN** hệ thống chỉ rõ dòng và lý do lỗi
- **AND** không ghi một phần nội dung import

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

- **WHEN** người dùng sửa phương án hoặc phản hồi tiêu chí
- **THEN** hệ thống cho phép lưu trực tiếp dữ liệu mới
- **AND** không yêu cầu khóa, mở khóa hoặc tạo phiên bản phương án

#### Scenario: Keep suppliers scoped to one dossier

- **WHEN** người dùng tạo hoặc đổi tên nhà cung cấp
- **THEN** nhà cung cấp chỉ được dùng bởi các phương án trong cùng hồ sơ
- **AND** backend từ chối tên trùng sau khi trim, gom khoảng trắng và chuyển chữ thường trong phạm vi hồ sơ
- **AND** hồ sơ khác có thể dùng cùng tên đã chuẩn hóa

### Requirement: Standard supplier option Excel template

Hệ thống SHALL cho phép xuất và import phương án bằng template chuẩn được tạo từ phiên bản cơ sở đang chọn.

#### Scenario: Export an option template

- **WHEN** người dùng yêu cầu template cho một phiên bản cơ sở
- **THEN** file chứa ID/mã tiêu chí, nhóm và yêu cầu cơ sở làm căn cứ ánh xạ
- **AND** cung cấp cột nhập phản hồi và thông tin bổ sung

#### Scenario: Import option responses

- **WHEN** người dùng import template hợp lệ cho đúng phiên bản cơ sở
- **THEN** hệ thống ánh xạ phản hồi theo ID/mã tiêu chí
- **AND** hiển thị preview trước khi lưu

#### Scenario: Reject a mismatched option template

- **WHEN** template thuộc phiên bản khác hoặc chứa tiêu chí không tồn tại/trùng lặp
- **THEN** hệ thống không ghi dữ liệu
- **AND** hiển thị lỗi theo dòng hoặc lỗi version phù hợp

#### Scenario: Reject an arbitrary option workbook

- **WHEN** workbook không có metadata của template chuẩn dù các cột hiển thị có tên tương tự
- **THEN** hệ thống không ghi dữ liệu
- **AND** hướng dẫn người dùng xuất template từ phiên bản cơ sở đang chọn

### Requirement: URL-only document profiles

Hệ thống SHALL quản lý tài liệu tham khảo dưới dạng metadata URL `http` hoặc
`https` tuyệt đối và SHALL không upload hoặc lưu nội dung file. URL được chấp
nhận SHALL có case-insensitive lexical prefix `^https?://`, không chứa raw
backslash, parse thành công và có parsed protocol `http:` hoặc `https:`. Client
validation SHALL provide early feedback, nhưng create/update RPC SHALL enforce
cùng contract trước khi ghi. Validation SHALL không trim, canonicalize hoặc
rewrite accepted value.

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

### Requirement: Criterion-level document citations

Hệ thống SHALL cho phép liên kết một tài liệu URL với từng tiêu chí bằng trang/mục và đoạn trích cụ thể.

#### Scenario: Link evidence to a criterion

- **WHEN** người dùng chọn tài liệu của cấu hình cơ sở, sản phẩm tham chiếu hoặc phương án và nhập trang/mục hoặc đoạn trích
- **THEN** hệ thống lưu liên kết với đúng tiêu chí và đúng owner của tài liệu
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

Hệ thống SHALL ưu tiên workflow đánh giá thủ công một phương án tại một thời điểm bằng danh sách tiêu chí và panel chi tiết.

#### Scenario: Select a criterion for evaluation

- **WHEN** người dùng chọn một tiêu chí trong danh sách bên trái
- **THEN** panel bên phải hiển thị yêu cầu cơ sở, phản hồi, thông tin bổ sung, trích dẫn và đánh giá của phương án đang chọn

#### Scenario: Navigate evaluation progress

- **WHEN** người dùng xem danh sách tiêu chí
- **THEN** mỗi tiêu chí hiển thị nhóm và trạng thái tổng hợp hiện tại
- **AND** người dùng có thể lọc hoặc quét nhanh tiêu chí chưa đánh giá, không đạt hoặc thiếu bằng chứng

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
