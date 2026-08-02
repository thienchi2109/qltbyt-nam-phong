## Why

Nhà tư vấn cấu hình hiện phải tổng hợp yêu cầu kỹ thuật cơ sở, phương án của nhiều nhà cung cấp và tài liệu tham chiếu trong các bảng tính rời rạc. Cách làm này khó theo dõi quan hệ giữa yêu cầu, phản hồi, bằng chứng và kết luận đánh giá, đặc biệt khi mỗi loại thiết bị có cấu trúc thông số rất khác nhau.

Hệ thống cần một module độc lập để lập cấu hình kỹ thuật dạng văn bản linh hoạt, so sánh nhiều phương án và hỗ trợ đánh giá thủ công có căn cứ. Module phục vụ tư vấn và phân tích tổng quan; không thay thế quy trình đấu thầu, thẩm định chuyên môn hoặc quyết định lựa chọn nhà cung cấp.

## What Changes

- Thêm module "Phân tích cấu hình kỹ thuật" độc lập với `thiet_bi`; mỗi hồ sơ phân tích chỉ đại diện cho một loại thiết bị và một cấu hình cơ sở.
- Giới hạn toàn bộ module cho người dùng `admin/global`, sử dụng `isGlobalRole()` tại các biên ngoài RPC proxy và kiểm tra quyền tương ứng tại backend.
- Cho phép xây dựng cấu hình cơ sở theo mô hình text-first gồm hai cấp `Nhóm cấu hình -> Tiêu chí`. Bản nháp mới có bốn nhóm gợi ý từ dữ liệu khảo sát: `Yêu cầu chung`, `Yêu cầu cấu hình cung cấp`, `Yêu cầu kỹ thuật` và `Yêu cầu khác`; đây là template mặc định có thể thêm, đổi tên, xóa và sắp xếp, không phải danh mục khóa cứng.
- Giữ cấu trúc tiêu chí tối thiểu và ổn định thay vì cho tạo cột nội dung tùy ý. Người dùng có thể tạo không giới hạn số nhóm/tiêu chí theo quy tắc nghiệp vụ, nhập text nhiều dòng, nhập nhanh, sắp xếp và import template Excel chuẩn của hệ thống.
- Tái sử dụng pipeline import/export Excel hiện có của trang Equipment ở mức workbook loading/creation, worksheet conversion, Blob download, file lifecycle và dialog primitives; chỉ baseline/option workbook codec và validation nghiệp vụ là module-specific.
- Import baseline dùng authoritative preview và một atomic apply RPC cho toàn phiên bản nháp; không chuyển workbook thành chuỗi CRUD RPC hoặc persist file/preview/error state.
- Quản lý phiên bản cấu hình cơ sở theo trạng thái `Bản nháp` và `Đã khóa`; phiên bản đã khóa bất biến tuyệt đối, kể cả với `admin/global`.
- Cho phép khai báo nhiều sản phẩm tham chiếu tùy chọn, nhập nội dung đối chiếu và trích dẫn theo từng tiêu chí, đồng thời giữ chúng tách biệt với các phương án cấu hình của nhà cung cấp.
- Cho phép không giới hạn số nhà cung cấp theo quy tắc nghiệp vụ và cho phép mỗi nhà cung cấp có nhiều phương án/model cấu hình.
- Cho phép nhập phương án nhà cung cấp thủ công hoặc bằng template Excel được xuất từ phiên bản cấu hình cơ sở đang chọn. Luồng nhập thủ công trên desktop đối chiếu một tiêu chí đang chọn giữa panel cấu hình cơ bản chỉ đọc và panel phản hồi chỉnh sửa, hỗ trợ sao chép có xác nhận cùng explicit save. Phương án nhà cung cấp là dữ liệu làm việc, không có cơ chế khóa hoặc quản lý phiên bản riêng.
- Quản lý danh sách tài liệu dưới dạng URL và liên kết từng tài liệu với tiêu chí bằng vị trí trang/mục và đoạn trích. Không tải hoặc lưu file trong ứng dụng.
- Tái sử dụng pattern URL đính kèm của Equipment ở mức hành vi, validation và thành phần giao diện dùng chung; không phụ thuộc bảng `thiet_bi` hoặc sao chép nguyên khối logic Equipment.
- Tách rõ bề mặt authoring và bề mặt quét: workspace nhập phản hồi chỉ làm việc với một option/criterion, còn ma trận read-only dùng nhóm/tiêu chí làm hàng, cấu hình cơ sở làm cột sticky và các phương án được chọn làm cột động. Ma trận không chứa response editor, copy hoặc save controls; tài liệu được mở trong panel chi tiết thay vì tạo thêm cột bằng chứng cố định.
- Tách đánh giá thành hai trục độc lập: mức đáp ứng kỹ thuật và mức đầy đủ bằng chứng. Trạng thái tổng hợp được suy ra bằng quy tắc minh bạch và không cho sửa trực tiếp.
- Cho phép lưu "Thông tin bổ sung" của nhà cung cấp; nội dung này vẫn hiển thị khi so sánh nhưng không làm thay đổi kết quả đáp ứng cấu hình cơ sở đã khóa.
- Cung cấp xếp hạng tham khảo tùy chọn từ kết luận thủ công, cho phép đồng hạng và không xếp hạng chéo giữa các hồ sơ hoặc phiên bản cấu hình cơ sở.
- Cho phép xuất kết quả cuối ra workbook Excel một chiều, gồm tổng quan, xếp hạng và ma trận chi tiết. Trước khi xuất, người dùng phải chọn nội dung và phạm vi phương án/tiêu chí; UI không được âm thầm giới hạn file theo option hoặc trang tiêu chí đang hiển thị.
- Tái sử dụng hạ tầng Excel hiện có gồm `createExcelWorkbook()`, `downloadBlob()`, ExcelJS lazy loading và các pattern workbook đã được kiểm thử. Chỉ result dataset mapping, sheet composition, styling contract và export-scope dialog là domain-specific; không tạo helper workbook/download song song và không thêm cờ kỹ thuật-cấu-hình vào flat `exportToExcel()`.
- Dùng read-only canonical export snapshot riêng để mọi page/chunk của workbook thuộc cùng một trạng thái dữ liệu. Export không tạo comparison set, không seed, không ghi live data và không tái tính kết luận ngoài contract đánh giá thủ công hiện có.
- Gói delivery export này mang tên `P14`, độc lập với P13 đang defer và được
  tách thành bảy leaf PR deploy-safe: P14A1, P14A2, P14A3, P14B1, P14B2,
  P14C1 và P14C2.
- Không đưa AI vào MVP: không có nút AI, API call, job, cache, quota, cột AI hoặc bảng AI chưa sử dụng. Mô hình dữ liệu giữ ID ổn định và tách rõ yêu cầu, phản hồi, bằng chứng, đánh giá để có thể bổ sung AI bằng một OpenSpec change riêng sau này.

## Impact

- Affected specs:
  - `technical-configuration-comparison` (new capability)
- Anticipated affected code:
  - Route và UI mới dưới `src/app/(app)/technical-configurations/`
  - Data hooks, types và baseline/option Excel codec dành riêng cho module
  - Read-only result-export RPCs, stable snapshot collector, workbook codec và export-scope dialog dành riêng cho module
  - Shared Excel primitives được trích từ pipeline Equipment với compatibility exports và regression coverage
  - Shared URL attachment primitives được trích xuất từ pattern Equipment khi triển khai
  - Supabase migration mới cho hồ sơ, phiên bản cấu hình cơ sở, nhóm/tiêu chí, nhà cung cấp, phương án, phản hồi, URL tài liệu, trích dẫn, đánh giá thủ công và read-only canonical result-export snapshot
  - Sidebar/navigation và route authorization cho `admin/global`
- Existing data:
  - Không migrate dữ liệu từ `thiet_bi`
  - Không thay đổi dữ liệu hoặc hành vi của Equipment
- External behavior:
  - Đây là capability mới, không có breaking change đối với module hiện tại
