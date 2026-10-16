# Temperature Monitoring

## Problem Statement

Nhân viên cần ghi nhiệt độ theo ca cho các thiết bị có yêu cầu theo dõi, phát hiện ngay số đo vượt giới hạn, ghi nhận biện pháp xử lý và xem xu hướng trong cùng một luồng thao tác. Dữ liệu phải gắn trực tiếp với hồ sơ thiết bị hiện có, có thể truy vết và không bị mất tính toàn vẹn khi điều chỉnh.

Ghi thủ công chỉ phát hiện bất thường tại thời điểm nhân viên đo và nhập số liệu. Tính năng này không thay thế cảnh báo liên tục từ cảm biến hoặc hệ thống IoT.

## Solution

Bổ sung module Temperature Monitoring bên trong phần mềm quản lý thiết bị hiện tại, gồm workspace mobile-first “Sổ theo dõi nhiệt độ” và phần tóm tắt/cấu hình trong hồ sơ thiết bị.

Workspace cho phép nhân viên chọn ca, nhập số đo, xem trạng thái, mở và xử lý sai lệch, đồng thời xem biểu đồ xu hướng. Cấu hình theo dõi thuộc từng thiết bị, gồm giới hạn nhiệt độ, lịch đo, người phụ trách và phương pháp ghi nhận.

Hệ thống bảo vệ một bản ghi chính cho mỗi thiết bị, ngày theo dõi và ca đo. Bản ghi đã xác nhận là bất biến; mọi điều chỉnh tạo phiên bản mới với lý do, người duyệt và lịch sử audit. Mỗi lần vượt ngưỡng mở một hồ sơ sai lệch riêng, trong đó hành động xử lý và kết quả xác minh là bắt buộc trước khi đóng.

## User Stories

1. As a nhân viên ghi nhận, I want to mở sổ theo dõi theo ca, so that tôi thấy ngay các thiết bị cần đo.
2. As a nhân viên ghi nhận, I want to nhập nhiệt độ trực tiếp trên thẻ thiết bị, so that tôi không phải chuyển qua nhiều màn hình.
3. As a nhân viên ghi nhận, I want to thấy thiết bị chưa được cấu hình theo dõi, so that tôi không ghi nhầm cho thiết bị không áp dụng.
4. As a nhân viên ghi nhận, I want to thấy cấu hình giới hạn và phương pháp ghi nhận của thiết bị, so that tôi biết số đo cần thực hiện đúng quy định.
5. As a nhân viên ghi nhận, I want to lưu số đo trong ngưỡng, so that ô đo chuyển sang trạng thái Đã ghi.
6. As a nhân viên ghi nhận, I want to nhập ghi chú và lý do khi không đo được, so that trạng thái thiếu hoặc không hợp lệ có nguyên nhân rõ ràng.
7. As a nhân viên ghi nhận, I want to nhận lỗi rõ ràng khi thiết bị-ngày-ca đã có bản ghi, so that tôi không vô tình tạo dữ liệu trùng.
8. As a nhân viên được ủy quyền, I want to tạo amendment cho bản ghi trùng hoặc sai, so that số liệu mới có lý do và lịch sử thay đổi.
9. As a người xác nhận, I want to xem bản ghi gốc, bản ghi điều chỉnh, lý do và người thực hiện, so that tôi có đủ căn cứ để xác nhận.
10. As a người xác nhận, I want to duyệt hoặc từ chối amendment, so that bản ghi hiệu lực được kiểm soát.
11. As a người quản lý, I want to mở lại một bản ghi đã xác nhận với lý do bắt buộc, so that các trường hợp đặc biệt vẫn có thể xử lý mà không xóa lịch sử.
12. As a nhân viên ghi nhận, I want to thấy điểm vượt ngưỡng được đánh dấu ngay sau khi lưu, so that tôi không bỏ sót bất thường.
13. As a người phụ trách, I want to có hồ sơ sai lệch tự mở cho mỗi lần vượt ngưỡng, so that việc xử lý được theo dõi riêng.
14. As a người phụ trách, I want to ghi hành động ngay, người chịu trách nhiệm, hạn hoàn tất và kết quả xác minh, so that hồ sơ sai lệch có thể đóng được bằng bằng chứng rõ ràng.
15. As a người phụ trách, I want to liên kết hồ sơ sai lệch với phiếu sửa chữa khi cần, so that vòng đời sửa chữa và vòng đời sai lệch vẫn truy vết được.
16. As a người xác nhận, I want to thấy trạng thái Chờ xác nhận cho bất thường hoặc amendment chưa duyệt, so that tôi biết việc nào còn chờ mình.
17. As a nhân viên ghi nhận, I want to xem biểu đồ nhiệt độ, giới hạn dưới và giới hạn trên, so that tôi nhận ra xu hướng lệch dần trước khi phát sinh sự cố.
18. As a người dùng mobile, I want to chạm vào điểm đo để xem ngày giờ, ca, người nhập, ghi chú và sai lệch, so that tôi không cần thao tác hover.
19. As a người dùng hỗ trợ tiếp cận, I want to xem dữ liệu biểu đồ ở dạng bảng và không phụ thuộc vào màu, so that tôi vẫn đọc được trạng thái trên màn hình nhỏ hoặc với trình đọc màn hình.
20. As a người dùng, I want to lọc biểu đồ và danh sách theo ca, trạng thái, thiết bị và khoảng ngày, so that tôi tập trung vào dữ liệu cần xử lý.
21. As a người dùng, I want to thấy rõ khoảng dữ liệu đang xem, so that tôi không tưởng rằng màn hình đang hiển thị toàn bộ lịch sử.
22. As a người dùng, I want to mặc định xem 30 ngày và chọn nhanh 7/30/90 ngày, so that truy vấn tương tác nhanh nhưng vẫn đủ ngữ cảnh.
23. As a người dùng được phân quyền, I want to xuất dữ liệu dài hơn 90 ngày, so that tôi phục vụ thanh tra, lưu trữ và báo cáo dài hạn.
24. As a quản trị viên đơn vị, I want to bật cấu hình theo dõi cho thiết bị và đặt ngày hiệu lực, so that chỉ thiết bị cần theo dõi mới tạo ô đo.
25. As a quản trị viên đơn vị, I want to phiên bản hóa giới hạn và lịch đo, so that dữ liệu cũ được đánh giá theo cấu hình tại thời điểm đo.
26. As a quản trị viên đơn vị, I want to cấu hình người phụ trách và phương pháp ghi nhận, so that trách nhiệm và cách đo được minh bạch.
27. As a người quản lý hệ thống, I want to xem dữ liệu theo phạm vi tenant/khoa phòng hiện có, so that Temperature Monitoring không vượt quyền của module Equipment.
28. As a người vận hành, I want to thấy cảnh báo rằng ghi thủ công không phải giám sát liên tục, so that tôi không hiểu sai mức độ bảo vệ của tính năng.

## Implementation Decisions

- Module nằm trong ứng dụng Equipment hiện tại, dùng route workspace riêng cho Sổ theo dõi và tích hợp tóm tắt/deep-link vào hồ sơ thiết bị. Không tạo microservice riêng.
- Cấu hình theo dõi được gắn với thiết bị và có phiên bản hiệu lực. Phiên bản gồm giới hạn dưới, giới hạn trên, đơn vị °C, lịch đo, múi giờ hiển thị, người phụ trách và phương pháp ghi nhận.
- Bộ ca có mặc định Sáng/Chiều/Tối/Đêm nhưng đơn vị có thể đổi tên và giờ. `monitoring_date` tính theo ngày bắt đầu ca; ca qua nửa đêm được hỗ trợ. Thời gian lưu theo UTC và hiển thị theo `Asia/Ho_Chi_Minh`.
- Một slot đo được định danh bởi thiết bị, ngày theo dõi và ca. Cơ sở dữ liệu phải chặn trùng; khóa giao dịch và lỗi xung đột phải được xử lý ở server, không chỉ dựa vào chống double-click của UI.
- Không materialize hàng loạt slot rỗng. Server kết hợp lịch hiệu lực với bản ghi thực tế trong cửa sổ truy vấn để trả các slot thiếu dưới trạng thái Chưa ghi.
- Trạng thái nghiệp vụ của slot gồm Chưa ghi, Đã ghi, Bất thường và Chờ xác nhận. Số đo trong ngưỡng chuyển sang Đã ghi; số đo vượt ngưỡng mở sai lệch và hiển thị Bất thường; bất thường hoặc amendment chưa duyệt chuyển sang Chờ xác nhận; sau duyệt trạng thái được tính lại theo kết quả.
- Mỗi bản ghi lưu snapshot giới hạn dưới/trên và cấu hình liên quan tại thời điểm đo. Thay đổi cấu hình sau đó không làm thay đổi cách diễn giải dữ liệu cũ.
- Bản ghi đã xác nhận không được cập nhật hoặc xóa trực tiếp. Amendment là bản ghi bất biến mới, có lý do bắt buộc, người tạo, người duyệt, thời điểm và liên kết bản ghi gốc.
- Mỗi lần vượt ngưỡng tạo một hồ sơ sai lệch riêng. Hồ sơ có mức độ Nhẹ/Nghiêm trọng/Khẩn cấp, hành động ngay, người phụ trách, hạn hoàn tất, nguyên nhân, bằng chứng và kết quả xác minh. Hành động ngay và kết quả xác minh là bắt buộc để đóng.
- Hồ sơ sai lệch có thể liên kết với phiếu sửa chữa hiện tại nhưng không tự động tạo phiếu sửa chữa và không gộp vòng đời hai đối tượng.
- Thông báo phiên bản đầu chỉ dùng badge/inbox trong ứng dụng và audit. Sự kiện được thiết kế để bổ sung Web Push sau; không triển khai cảnh báo cảm biến liên tục trong phạm vi này.
- Các RPC đọc/ghi mới đi qua RPC proxy và allowlist hiện tại, dùng tenant/department scope, `isGlobalRole()` cho kiểm tra global/admin ngoài proxy, row lock và audit fail-closed.
- Lịch sử điều chỉnh/xác nhận dùng domain history riêng, không trộn vào timeline vòng đời thiết bị chung.
- UI tương tác mặc định tải 30 ngày, hỗ trợ 7/30/90 ngày và khoảng tùy chỉnh tối đa 90 ngày. Bộ lọc thiết bị, ca, trạng thái và ngày đều chạy server-side.
- Server dùng cursor pagination theo ngày/ca/thiết bị và chỉ trả dữ liệu trong phạm vi người dùng được phép xem. Query key/cache bao gồm thiết bị, khoảng ngày, ca và trạng thái; sau khi ghi chỉ invalidate phạm vi hẹp.
- Biểu đồ một thiết bị hiển thị điểm gốc trong cửa sổ tối đa 90 ngày, giới hạn dưới/trên theo snapshot, marker bất thường và tooltip chạm/hover. Không được làm mất các điểm bất thường khi giảm mật độ; nếu có tổng hợp phải ghi rõ trên UI. Luôn có bảng dữ liệu thay thế.
- Tiêu đề sổ và biểu đồ hiển thị phạm vi hiện tại, ví dụ: “Đang xem 18/07/2026–16/10/2026 · tối đa 90 ngày”.
- Export cho phép mọi khoảng ngày mà người dùng được phân quyền, kể cả nhiều năm. Export chạy server-side theo luồng hoặc background khi dữ liệu lớn, có giới hạn kích thước/rate limit, và chứa snapshot giới hạn, trạng thái, người nhập/xác nhận, amendment và sai lệch.

## Testing Decisions

- Kiểm thử hành vi bên ngoài của domain và RPC, không kiểm thử chi tiết implementation nội bộ.
- Kiểm thử ràng buộc không trùng thiết bị-ngày-ca trong các request đồng thời và phản hồi xung đột có thể xử lý được trên UI.
- Kiểm thử vòng đời trạng thái: Chưa ghi, Đã ghi, Bất thường, Chờ xác nhận; bao gồm không đo được, vượt ngưỡng, amendment được duyệt/từ chối và mở lại có lý do.
- Kiểm thử bất biến: bản ghi đã xác nhận không bị sửa/xóa trực tiếp; amendment giữ nguyên bản gốc và tạo audit đầy đủ.
- Kiểm thử snapshot giới hạn khi cấu hình thay đổi giữa hai ngày đo.
- Kiểm thử tenant/department scope và role normalization cho global/admin, người nhập, người xác nhận và người quản lý.
- Kiểm thử tạo, cập nhật, đóng và liên kết hồ sơ sai lệch; không cho đóng khi thiếu hành động hoặc kết quả xác minh.
- Kiểm thử server-side date filter, mặc định 30 ngày, giới hạn UI 90 ngày, cursor pagination, slot Chưa ghi dựng từ lịch và query không tải dữ liệu ngoài cửa sổ.
- Kiểm thử cache invalidation sau ghi chỉ ảnh hưởng query liên quan và không làm mất bộ lọc hiện tại.
- Kiểm thử biểu đồ có ba lớp dữ liệu, marker bất thường, tooltip đầy đủ metadata, giới hạn theo thời kỳ và bảng fallback/accessibility.
- Kiểm thử export khoảng dài hơn 90 ngày, quyền truy cập, snapshot ngưỡng, amendment và sai lệch trong file.
- Kiểm thử mobile touch target, thao tác một lượt ghi, trạng thái loading/error/empty và không xung đột với overlay/card activation.
- Ưu tiên các seam hiện có: Equipment workspace/detail dialog, RPC proxy, TanStack Query data hooks, repair/deviation workflow và Recharts chart wrapper.

## Out of Scope

- Không tạo microservice hoặc hệ thống lưu nhiệt độ tách khỏi phần mềm Equipment.
- Không triển khai cảm biến, IoT gateway, cảnh báo liên tục, email hoặc Web Push trong phiên bản đầu.
- Không tự động tạo phiếu sửa chữa cho mọi bất thường.
- Không cho sửa/xóa vật lý bản ghi đã xác nhận.
- Không tải toàn bộ lịch sử vào màn hình tương tác hoặc giới hạn export dài hạn ở 90 ngày.
- Không liên quan đến LabOps.
- Không bao gồm PDF biểu mẫu bắt buộc; export Excel là định dạng đầu tiên.

## Further Notes

- Cần hiển thị rõ trên UI rằng dữ liệu thủ công chỉ phản ánh thời điểm nhân viên đo và nhập.
- Không dùng timeline `equipment_history_list` làm nguồn duy nhất cho lịch sử nhiệt độ vì đó là lịch sử vòng đời thiết bị có phạm vi rộng.
- Biểu đồ hiện có chưa hỗ trợ đầy đủ reference lines, marker theo điểm và event tooltip; Temperature Monitoring cần mở rộng seam biểu đồ hiện tại hoặc dùng component chuyên biệt nhưng vẫn giữ lazy loading Recharts.
- Bản spec này mô tả phạm vi, hành vi và các quyết định đã thống nhất; chưa mô tả thứ tự triển khai, migration cụ thể hay kế hoạch chia phase.
