## Why

Nhà tư vấn cấu hình hiện phải tổng hợp yêu cầu kỹ thuật cơ sở, phương án của nhiều nhà cung cấp và tài liệu tham chiếu trong các bảng tính rời rạc. Cách làm này khó theo dõi quan hệ giữa yêu cầu, phản hồi, bằng chứng và kết luận đánh giá, đặc biệt khi mỗi loại thiết bị có cấu trúc thông số rất khác nhau.

Hệ thống cần một module độc lập để lập cấu hình kỹ thuật dạng văn bản linh hoạt, so sánh nhiều phương án và hỗ trợ đánh giá thủ công có căn cứ. Module phục vụ tư vấn và phân tích tổng quan; không thay thế quy trình đấu thầu, thẩm định chuyên môn hoặc quyết định lựa chọn nhà cung cấp.

## What Changes

- Thêm module "Phân tích cấu hình kỹ thuật" độc lập với `thiet_bi`; mỗi hồ sơ phân tích chỉ đại diện cho một loại thiết bị và một cấu hình cơ sở.
- Giới hạn toàn bộ module cho người dùng `admin/global`, sử dụng `isGlobalRole()` tại các biên ngoài RPC proxy và kiểm tra quyền tương ứng tại backend.
- Cho phép xây dựng cấu hình cơ sở theo mô hình text-first gồm hai cấp `Nhóm cấu hình -> Tiêu chí`. Bản nháp mới có bốn nhóm gợi ý từ dữ liệu khảo sát: `Yêu cầu chung`, `Yêu cầu cấu hình cung cấp`, `Yêu cầu kỹ thuật` và `Yêu cầu khác`; đây là template mặc định có thể thêm, đổi tên, xóa và sắp xếp, không phải danh mục khóa cứng.
- Giữ cấu trúc tiêu chí tối thiểu và ổn định thay vì cho tạo cột nội dung tùy ý. Người dùng có thể tạo không giới hạn số nhóm/tiêu chí theo quy tắc nghiệp vụ, nhập text nhiều dòng, nhập nhanh, sắp xếp và import template Excel chuẩn của hệ thống.
- Quản lý phiên bản cấu hình cơ sở theo trạng thái `Bản nháp` và `Đã khóa`; phiên bản đã khóa bất biến tuyệt đối, kể cả với `admin/global`.
- Cho phép khai báo nhiều sản phẩm tham chiếu tùy chọn, nhập nội dung đối chiếu và trích dẫn theo từng tiêu chí, đồng thời giữ chúng tách biệt với các phương án cấu hình của nhà cung cấp.
- Cho phép không giới hạn số nhà cung cấp theo quy tắc nghiệp vụ và cho phép mỗi nhà cung cấp có nhiều phương án/model cấu hình.
- Cho phép nhập phương án nhà cung cấp thủ công hoặc bằng template Excel được xuất từ phiên bản cấu hình cơ sở đang chọn. Phương án nhà cung cấp là dữ liệu làm việc, không có cơ chế khóa hoặc quản lý phiên bản riêng.
- Quản lý danh sách tài liệu dưới dạng URL và liên kết từng tài liệu với tiêu chí bằng vị trí trang/mục và đoạn trích. Không tải hoặc lưu file trong ứng dụng.
- Tái sử dụng pattern URL đính kèm của Equipment ở mức hành vi, validation và thành phần giao diện dùng chung; không phụ thuộc bảng `thiet_bi` hoặc sao chép nguyên khối logic Equipment.
- Cung cấp các bề mặt so sánh có cùng mô hình hiển thị: nhóm/tiêu chí là hàng, cấu hình cơ sở là cột sticky, còn sản phẩm tham chiếu hoặc phương án được chọn là các cột động. Tài liệu được mở trong panel chi tiết thay vì tạo thêm cột bằng chứng cố định.
- Tách đánh giá thành hai trục độc lập: mức đáp ứng kỹ thuật và mức đầy đủ bằng chứng. Trạng thái tổng hợp được suy ra bằng quy tắc minh bạch và không cho sửa trực tiếp.
- Cho phép lưu "Thông tin bổ sung" của nhà cung cấp; nội dung này vẫn hiển thị khi so sánh nhưng không làm thay đổi kết quả đáp ứng cấu hình cơ sở đã khóa.
- Cung cấp xếp hạng tham khảo tùy chọn từ kết luận thủ công, cho phép đồng hạng và không xếp hạng chéo giữa các hồ sơ hoặc phiên bản cấu hình cơ sở.
- Không đưa AI vào MVP: không có nút AI, API call, job, cache, quota, cột AI hoặc bảng AI chưa sử dụng. Mô hình dữ liệu giữ ID ổn định và tách rõ yêu cầu, phản hồi, bằng chứng, đánh giá để có thể bổ sung AI bằng một OpenSpec change riêng sau này.

## Impact

- Affected specs:
  - `technical-configuration-comparison` (new capability)
- Anticipated affected code:
  - Route và UI mới dưới `src/app/(app)/technical-configurations/`
  - Data hooks, types, Excel helpers và validation dành riêng cho module
  - Shared URL attachment primitives được trích xuất từ pattern Equipment khi triển khai
  - Supabase migration mới cho hồ sơ, phiên bản cấu hình cơ sở, nhóm/tiêu chí, nhà cung cấp, phương án, phản hồi, URL tài liệu, trích dẫn và đánh giá thủ công
  - Sidebar/navigation và route authorization cho `admin/global`
- Existing data:
  - Không migrate dữ liệu từ `thiet_bi`
  - Không thay đổi dữ liệu hoặc hành vi của Equipment
- External behavior:
  - Đây là capability mới, không có breaking change đối với module hiện tại
