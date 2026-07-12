## Context

Hai nguồn CSV tại `/root/docs` thể hiện yêu cầu kỹ thuật dưới dạng văn bản dài và cùng dùng bốn section theo chiều dọc: `Yêu cầu chung`, `Yêu cầu cấu hình cung cấp`, `Yêu cầu kỹ thuật` và `Yêu cầu khác`. Bên dưới mỗi section là các dòng tiêu chí. Theo chiều ngang, CSV đặt đề xuất cấu hình cơ sở cạnh nhiều sản phẩm tham chiếu và cột tài liệu tương ứng.

Các section trong CSV là nhóm tiêu chí, không phải cột dữ liệu tùy biến. Do đó, module dùng mô hình hai chiều ổn định: nhóm/tiêu chí theo hàng và đối tượng được đối chiếu theo cột. Việc ép mọi loại thiết bị vào schema số học như `giá trị tối thiểu`, `giá trị tối đa`, `đơn vị` hoặc `toán tử` sẽ làm mất thông tin; ngược lại, cho tạo arbitrary content columns sẽ tạo chiều dữ liệu thứ ba, làm khó import và ma trận. Module chỉ cố định trường định danh/điều hướng, còn nội dung nghiệp vụ vẫn là text nhiều dòng.

Module phục vụ nhà tư vấn cấu hình có cái nhìn tổng quát giữa nhiều phương án. Nó không quản lý phát hành hồ sơ mời thầu, tiếp nhận hồ sơ dự thầu, tính hợp lệ pháp lý, lựa chọn trúng thầu hoặc phê duyệt mua sắm.

## Goals / Non-Goals

### Goals

- Tạo cấu hình cơ sở linh hoạt cho một loại thiết bị trong một hồ sơ độc lập.
- Bảo toàn cấu hình cơ sở đã được người dùng khóa làm căn cứ so sánh.
- Nhập và theo dõi nhiều phương án/model của nhiều nhà cung cấp mà không làm UI phức tạp.
- Cho phép quét nhanh ma trận và đánh giá sâu từng tiêu chí theo từng phương án.
- Gắn kết luận thủ công với tài liệu URL và đoạn trích cụ thể.
- Dùng template Excel chuẩn để giảm nhập liệu nhưng vẫn giữ hợp đồng dữ liệu ổn định.
- Giữ đường mở rộng rõ ràng cho AI mà không đưa chi phí hoặc độ phức tạp AI vào MVP.

### Non-Goals

- Không liên kết cấu hình cơ sở với bản ghi `thiet_bi`.
- Không triển khai quy trình đấu thầu hoặc quyết định lựa chọn nhà cung cấp.
- Không lưu file, đồng bộ cloud drive hoặc kiểm tra quyền truy cập của file từ xa.
- Không hỗ trợ cây tiêu chí lồng nhau tùy ý; MVP chỉ có hai cấp nhóm và tiêu chí.
- Không hỗ trợ schema builder hoặc cột nội dung tùy biến; sự linh hoạt đến từ số lượng nhóm, số lượng tiêu chí và nội dung text.
- Không diễn giải số liệu kỹ thuật ở backend để tính toán theo đơn vị/toán tử.
- Không khóa hoặc quản lý phiên bản phương án nhà cung cấp.
- Không triển khai AI, embeddings, LLM, background job, cache hoặc quota trong MVP.

## Terminology

- **Hồ sơ phân tích**: hồ sơ làm việc độc lập cho đúng một loại thiết bị.
- **Cấu hình cơ sở**: tập yêu cầu chung dùng làm căn cứ so sánh.
- **Phiên bản cơ sở**: một bản nháp hoặc bản đã khóa của cấu hình cơ sở.
- **Nhà cung cấp**: tổ chức cung cấp một hoặc nhiều phương án cấu hình. UI có thể dùng nhãn nghiệp vụ "Nhà thầu" nếu sản phẩm sau này cần, nhưng entity không mang semantics của quy trình đấu thầu.
- **Phương án cấu hình**: một model hoặc phương án cụ thể thuộc nhà cung cấp; đây là đơn vị được đưa vào ma trận và đánh giá.
- **Sản phẩm tham chiếu**: sản phẩm được dùng khi xây dựng cấu hình cơ sở, không phải phương án do nhà cung cấp khai báo.
- **Tài liệu URL**: metadata gồm tên và URL trỏ tới tài liệu trên cloud drive.
- **Trích dẫn tiêu chí**: liên kết giữa tài liệu URL và một tiêu chí, kèm trang/mục và đoạn trích.

## Decisions

### 1. Hồ sơ độc lập và một loại thiết bị

Mỗi hồ sơ phân tích chứa đúng một cấu hình cơ sở cho một loại thiết bị. Bản thân hồ sơ là root của lineage cấu hình; không tạo bảng lineage riêng. Một hồ sơ có thể có nhiều phiên bản nối tiếp nhưng hệ thống không cho tạo hai lineage cấu hình song song trong cùng hồ sơ. Hồ sơ có ID ổn định, tên thiết bị, tên hồ sơ, mô tả tùy chọn và metadata tạo/cập nhật.

Không thêm foreign key tới `thiet_bi`. Việc độc lập giúp cấu hình được xây dựng trước khi tồn tại thiết bị thực tế và tránh trộn dữ liệu tư vấn với dữ liệu quản lý tài sản.

Archive là thao tác một chiều trong MVP. Hồ sơ active được phép chuyển sang archived qua contract `technical_configuration_dossiers_archive`. Sau khi hồ sơ đã archive, mọi mutation nhắm tới chính hồ sơ đó hoặc bất kỳ entity nào trong toàn bộ aggregate con phải gọi cùng archive guard và bị từ chối. Hồ sơ đã archive bị ẩn khỏi list mặc định nhưng vẫn đọc được qua get hoặc list có cờ gồm dữ liệu archive; không có RPC hoặc UI restore.

### 2. Cấu hình cơ sở text-first với hai cấp

Mỗi phiên bản cơ sở gồm các nhóm có thứ tự. Mỗi nhóm gồm các tiêu chí có:

- ID ổn định trong phiên bản
- mã hiển thị ổn định do hệ thống sinh
- tiêu đề ngắn tùy chọn
- nội dung yêu cầu nhiều dòng
- thứ tự hiển thị

Khi tạo bản nháp trống, hệ thống gợi ý bốn nhóm theo đúng thứ tự:

1. `Yêu cầu chung`
2. `Yêu cầu cấu hình cung cấp`
3. `Yêu cầu kỹ thuật`
4. `Yêu cầu khác`

Đây là dữ liệu khởi tạo để giảm thao tác, không phải enum hoặc danh mục bắt buộc. Khi phiên bản còn là bản nháp, người dùng có thể thêm, đổi tên, xóa và sắp xếp nhóm; đồng thời có thể thêm, sửa, xóa và sắp xếp tiêu chí. Không đặt giới hạn số lượng nhóm hoặc tiêu chí theo quy tắc nghiệp vụ.

Không có các cột kỹ thuật bắt buộc như min/max/unit/operator và không có schema builder để tạo arbitrary content columns. Mỗi tiêu chí giữ một nội dung yêu cầu chính dạng text nhiều dòng; chi tiết cấu hình được biểu diễn bằng tiêu chí riêng hoặc nhiều dòng trong cùng tiêu chí. Nhập nhanh nhiều dòng tạo nhiều tiêu chí trong nhóm đã chọn và luôn có bước xem lại trước khi lưu.

Hai cấp và tập trường cấu trúc tối thiểu là giới hạn có chủ đích: đủ biểu diễn các CSV khảo sát, giữ ánh xạ tiêu chí ổn định, tránh tạo chiều dữ liệu thứ ba và giúp template Excel cùng ma trận dễ đọc.

Mã tiêu chí có dạng `TC-` theo sau bởi ít nhất bốn chữ số được zero-pad, bắt đầu từ `TC-0001` và tiếp tục vượt quá bốn chữ số khi bộ đếm lớn hơn 9999. Mã duy nhất trong một phiên bản cơ sở. Người dùng không nhập hoặc sửa mã. Phiên bản giữ bộ đếm kế tiếp để thao tác tạo đồng thời vẫn an toàn và không tự tái sử dụng số của tiêu chí đã xóa. Reorder không đổi mã. Khi sao chép phiên bản, mã và bộ đếm kế tiếp được giữ nguyên; dòng Excel mới để trống mã và chỉ nhận mã trong preview/apply.

### 3. Phiên bản cơ sở và khóa bất biến

Một hồ sơ có thể có nhiều phiên bản cơ sở nhưng chỉ có tối đa một bản nháp chỉnh sửa được tại một thời điểm. Phiên bản mới được tạo dưới dạng bản nháp, có thể bắt đầu trống hoặc sao chép từ phiên bản đã khóa; request tạo bản nháp thứ hai bị từ chối.

Hành động khóa:

- yêu cầu xác nhận rõ ràng
- yêu cầu có ít nhất một nhóm, ít nhất một tiêu chí có nội dung, mã tiêu chí không trùng và không còn lỗi import chưa xử lý
- ghi người khóa và thời điểm khóa
- chuyển toàn bộ phiên bản, nhóm, tiêu chí, sản phẩm tham chiếu, document metadata/URL và trích dẫn cơ sở sang trạng thái bất biến
- được backend và database enforcement bảo vệ, không chỉ ẩn nút ở UI

Không người dùng nào, kể cả `admin/global`, được sửa hoặc xóa nội dung của phiên bản đã khóa. Mọi thay đổi phải tạo bản nháp mới.

Sao chép phiên bản đã khóa tạo ID mới cho toàn bộ aggregate, giữ `source_baseline_version_id`, giữ mã tiêu chí và đặt `source_criterion_id` cho tiêu chí mới. Aggregate được sao chép gồm nhóm, tiêu chí, sản phẩm tham chiếu/phản hồi, tài liệu cơ sở/tham chiếu và trích dẫn. Nhà cung cấp, phương án, phản hồi phương án và đánh giá thủ công không thuộc aggregate baseline nên không được sao chép. Leaf tạo thêm entity baseline-owned phải mở rộng cùng copy contract trong migration của leaf đó.

Đánh giá và bộ phản hồi của phương án luôn liên kết với đúng phiên bản cơ sở. Khi một phiên bản mới được khóa, dữ liệu theo phiên bản cũ không tự migrate và kết quả cũ vẫn có thể tra cứu.

### 4. Sản phẩm tham chiếu tách khỏi phương án nhà cung cấp

Phiên bản cơ sở có thể có không, một hoặc nhiều sản phẩm tham chiếu. Mỗi sản phẩm có tên/model, hãng sản xuất hoặc nhà sản xuất, mô tả và ghi chú tùy chọn. Sản phẩm tham chiếu còn có nội dung đối chiếu dạng text cho từng tiêu chí của phiên bản cơ sở và có thể gắn tài liệu URL/trích dẫn vào đúng tiêu chí đó.

Trong bề mặt xây dựng cấu hình cơ sở, nhóm và tiêu chí vẫn là hàng, yêu cầu cơ sở là cột sticky và mỗi sản phẩm tham chiếu được chọn là một cột động. Tài liệu tham chiếu hiển thị bằng chỉ báo và panel chi tiết, không tạo một cột tài liệu cố định cạnh mỗi sản phẩm như bảng tính nguồn.

Sản phẩm tham chiếu chỉ hỗ trợ xây dựng yêu cầu. Nó không xuất hiện như một nhà cung cấp, không được xếp hạng và không làm thay đổi kết luận thủ công của phương án nhà cung cấp.

### 5. Nhà cung cấp và nhiều phương án cấu hình

Một hồ sơ có thể có nhiều nhà cung cấp mà không đặt giới hạn nghiệp vụ. Nhà cung cấp thuộc đúng một hồ sơ và chỉ được dùng chung bởi các phương án trong hồ sơ đó. Tên được chuẩn hóa bằng trim, gom khoảng trắng liên tiếp và chuyển chữ thường; giá trị chuẩn hóa phải duy nhất trong phạm vi hồ sơ nhưng có thể lặp giữa hai hồ sơ. Mỗi nhà cung cấp có thể có nhiều phương án. Mỗi phương án có nhãn hiển thị rõ theo dạng:

`Nhà cung cấp · Model hoặc tên phương án`

Entity nhà cung cấp giữ thông tin tổ chức dùng chung. Entity phương án giữ model, hãng sản xuất, tên phương án và ghi chú. Phản hồi theo tiêu chí được lưu theo cặp `phương án + phiên bản cơ sở + tiêu chí`.

Cấu trúc này cho phép một phương án được nhập lại theo phiên bản cơ sở mới mà không gọi đó là phiên bản hồ sơ nhà cung cấp. Phương án và phản hồi là dữ liệu làm việc, được sửa trực tiếp và không có hành động khóa.

### 6. Template Excel chuẩn

MVP chỉ chấp nhận template do hệ thống tạo.

Template cấu hình cơ sở có đúng một sheet hiển thị tên `Baseline` và đúng một sheet ẩn tên `_meta`; không có thêm sheet hiển thị hoặc sheet ẩn nào khác. Sheet `Baseline` dùng `row_type` là `GROUP` hoặc `CRITERION` và tập cột cố định:

- loại dòng
- thứ tự nhóm
- tên nhóm
- thứ tự tiêu chí
- mã tiêu chí
- tiêu đề tùy chọn
- nội dung yêu cầu nhiều dòng

Sheet `_meta` chứa đúng các metadata key `template_kind`, `template_version`, `dossier_id`, `baseline_version_id`, `baseline_revision` và `generated_at`. Template mới điền sẵn bốn nhóm gợi ý nhưng cho phép người dùng thêm, đổi tên, xóa hoặc sắp xếp nhóm bằng các dòng dữ liệu hợp lệ. Mã của tiêu chí đã tồn tại là read-only và parser từ chối mã bị sửa; dòng tiêu chí mới phải để trống mã để preview/apply sinh mã. Template không hỗ trợ thêm sheet hoặc cột nội dung tùy ý; cấu trúc ngoài contract của phiên bản template bị từ chối.

Template phương án được xuất từ một phiên bản cơ sở đã chọn và chứa:

- ID/mã tiêu chí dùng để ánh xạ
- nhóm và nội dung yêu cầu ở dạng chỉ đọc/tham khảo
- nội dung phản hồi của phương án
- thông tin bổ sung tùy chọn

Import phải có bước parse và preview. Hệ thống báo lỗi theo dòng, không ghi một phần khi file có lỗi cấu trúc, tiêu chí lạ hoặc tiêu chí trùng. Tài liệu URL và trích dẫn được quản lý trong UI để tránh lặp URL trên nhiều dòng Excel.

Triển khai nên dùng `exceljs`, phù hợp với pattern hiện tại của repo, và tách parser/validator khỏi UI để kiểm thử độc lập.

### 7. Tài liệu URL và trích dẫn theo tiêu chí

Mỗi phiên bản cơ sở và mỗi phương án có danh sách tài liệu URL riêng. Metadata tối thiểu:

- ID
- tên tài liệu
- URL hợp lệ
- ghi chú tùy chọn
- người tạo và thời điểm tạo/cập nhật

Một tài liệu có thể được liên kết với nhiều tiêu chí. Mỗi liên kết có trang/mục tùy chọn và đoạn trích nhiều dòng. Trong tương lai, chỉ các đoạn trích liên kết trực tiếp với tiêu chí mới được đưa vào payload AI của tiêu chí đó.

Pattern Equipment được tái sử dụng ở mức shared component/validation:

- form tên tài liệu và URL
- `new URL(...)` validation
- danh sách liên kết mở tab mới với `noopener noreferrer`
- trạng thái loading, empty, add và delete

Không tái sử dụng bảng `file_dinh_kem` vì bảng đó gắn với `thiet_bi`. Khi triển khai, cần trích phần trình bày và validation dùng chung thay vì sao chép `EquipmentDetailFilesTab`.

### 8. Hai bề mặt làm việc bổ trợ nhau

#### Ma trận so sánh

Ma trận ưu tiên quét nhanh:

- nhóm và tiêu chí là các hàng có thứ tự; bốn nhóm mặc định không được xử lý như cột
- cột yêu cầu cơ sở sticky
- mỗi phương án là một cột, nhãn rõ nhà cung cấp và model
- cuộn ngang, chọn cột, ghim cột và chế độ tập trung để hỗ trợ nhiều phương án
- hiển thị phản hồi rút gọn và trạng thái đánh giá
- mở panel chi tiết thay vì nhồi tài liệu và đánh giá vào ô nhỏ

Không thêm cột nội dung tùy biến vào ma trận. Số cột ngang tăng theo số sản phẩm tham chiếu hoặc phương án được chọn, tùy bề mặt; hai loại không bị trộn semantics và sản phẩm tham chiếu không tham gia đánh giá/xếp hạng.

Hồ sơ không có giới hạn tổng số phương án. Một request ma trận chọn tối đa 8 phương án và đọc tối đa 100 tiêu chí; tiêu chí được phân trang khi phiên bản lớn hơn giới hạn. Phương án thứ chín vẫn được lưu và có thể được chọn trong request khác. Read contract trả baseline, supplier label, response, supplementary information và citation summary trong một RPC có giới hạn, không tạo N+1.

Ma trận không thay thế workflow đánh giá chi tiết.

#### Đánh giá từng phương án

Mặc định người dùng đánh giá một phương án đang chọn:

- bên trái là toàn bộ tiêu chí, nhóm và trạng thái
- bên phải là nội dung yêu cầu, phản hồi phương án, thông tin bổ sung, trích dẫn tài liệu, ghi chú và hai trục đánh giá
- chuyển tiêu chí không làm mất thay đổi chưa lưu
- mọi thay đổi chỉ được ghi khi bấm `Lưu` hoặc `Lưu & tiếp tục`

`Lưu` giữ nguyên tiêu chí đang xem. `Lưu & tiếp tục` lưu thành công rồi chuyển tới tiêu chí kế tiếp theo thứ tự hiện tại.

### 9. Đánh giá thủ công hai trục

Trục mức đáp ứng kỹ thuật:

- `Vượt yêu cầu`
- `Đạt`
- `Không đạt`
- `Chưa rõ`
- `Không áp dụng`

Trục mức đầy đủ bằng chứng:

- `Đầy đủ`
- `Một phần`
- `Thiếu`
- `Không yêu cầu`

Hai giá trị được lưu riêng. Trạng thái tổng hợp không có input chỉnh sửa trực tiếp và được suy ra theo thứ tự ưu tiên:

| Mức đáp ứng kỹ thuật | Mức đầy đủ bằng chứng     | Trạng thái tổng hợp |
| -------------------- | ------------------------- | ------------------- |
| Chưa chọn            | Bất kỳ                    | Chưa đánh giá       |
| Không áp dụng        | Bất kỳ                    | Không áp dụng       |
| Không đạt            | Bất kỳ                    | Không đạt           |
| Chưa rõ              | Bất kỳ                    | Chưa rõ             |
| Vượt yêu cầu         | Một phần hoặc Thiếu       | Chưa đủ bằng chứng  |
| Đạt                  | Một phần hoặc Thiếu       | Chưa đủ bằng chứng  |
| Vượt yêu cầu         | Đầy đủ hoặc Không yêu cầu | Vượt yêu cầu        |
| Đạt                  | Đầy đủ hoặc Không yêu cầu | Đạt                 |

Backend và frontend phải dùng cùng một hàm/quy tắc chuẩn để tránh kết quả khác nhau.

Đánh giá thủ công là nguồn kết luận chính trong MVP. Thay đổi phản hồi nhà cung cấp không tự động xóa hoặc sửa kết luận của người dùng.

### 10. Thông tin bổ sung không ảnh hưởng tuân thủ

Mỗi phản hồi tiêu chí có trường "Thông tin bổ sung" riêng. Trường này:

- hiển thị trong panel và ma trận khi mở rộng
- được giữ lại để phân tích thủ công và AI tương lai
- không tham gia quy tắc suy ra trạng thái tổng hợp
- không biến một tiêu chí không đạt thành đạt

### 11. Xếp hạng tham khảo

Xếp hạng là hành động tùy chọn và được tính từ trạng thái tổng hợp thủ công của các phương án trong cùng hồ sơ và cùng phiên bản cơ sở.

Thứ tự quy tắc:

1. Ít tiêu chí `Không đạt` hơn.
2. Nếu bằng nhau, ít tiêu chí `Chưa đủ bằng chứng` hơn.
3. Nếu vẫn bằng nhau, nhiều tiêu chí `Vượt yêu cầu` hơn.

Chỉ phương án đã có đủ cả hai trục đánh giá cho toàn bộ tiêu chí áp dụng mới đủ điều kiện xếp hạng. Phương án chưa hoàn tất vẫn hiển thị trong tổng quan nhưng được ghi rõ "Chưa đủ dữ liệu để xếp hạng".

Các phương án có cùng bộ giá trị được đồng hạng. UI luôn ghi rõ "Xếp hạng tham khảo, không phải quyết định lựa chọn nhà cung cấp". Không tạo xếp hạng chéo giữa hồ sơ, giữa phiên bản cơ sở hoặc với sản phẩm tham chiếu.

Thay đổi phản hồi hoặc tài liệu nhà cung cấp không tự sửa, xóa hoặc đánh dấu lỗi thời kết luận thủ công. Xếp hạng dùng các kết luận thủ công đang được lưu; người dùng chịu trách nhiệm rà soát lại khi dữ liệu nguồn thay đổi. Cơ chế `Đã lỗi thời` chỉ dành cho kết quả AI trong change tương lai.

### 12. Quyền truy cập và audit tối thiểu

Chỉ `admin/global` được thấy route, đọc hoặc thay đổi dữ liệu module.

- Bên ngoài RPC proxy phải dùng `isGlobalRole()` để bao gồm cả session role `admin`.
- RPC/database policy phải kiểm tra JWT claim và từ chối fail-closed.
- Không dựa vào việc ẩn navigation để bảo vệ dữ liệu.
- Mọi mutation aggregate con phải kiểm tra hồ sơ chưa archive trước khi kiểm tra trạng thái leaf-specific.
- Các bảng ghi `created_at`, `created_by`, `updated_at`, `updated_by`; phiên bản khóa ghi thêm `locked_at`, `locked_by`.
- MVP không cần timeline audit đầy đủ, nhưng metadata phải đủ xác định ai tạo, sửa và khóa dữ liệu gần nhất.

Mọi mutation phải gửi `p_expected_revision` và kiểm tra `revision BIGINT` của aggregate sở hữu để không ghi đè âm thầm khi hai tab/người dùng cùng sửa. Khi có conflict, UI giữ dữ liệu chưa lưu và yêu cầu tải lại trước khi ghi tiếp.

### 13. Ranh giới mở rộng AI

AI là hướng scale sau MVP, không bị loại bỏ khỏi sản phẩm. MVP chuẩn bị dữ liệu bằng:

- ID ổn định cho hồ sơ, phiên bản cơ sở, nhóm, tiêu chí, phương án, phản hồi, tài liệu và trích dẫn
- quan hệ rõ giữa một tiêu chí cơ sở và phản hồi của từng phương án
- đoạn trích bằng chứng có phạm vi tiêu chí
- đánh giá thủ công tách riêng khỏi kết quả máy
- metadata cập nhật để tạo input fingerprint trong tương lai

Hướng AI đã thống nhất để change sau kế thừa:

- dùng đúng model/version cố định trong code như AI Assistant hiện tại
- phân tích theo nhóm và tiêu chí, ưu tiên phương án người dùng đang xem
- hỗ trợ bước tổng hợp so sánh nhiều phương án từ kết quả theo phương án, không trộn xếp hạng giữa hồ sơ hoặc phiên bản
- cache trong database theo tiêu chí và input fingerprint, không dùng `localStorage`, Redis hoặc TTL theo thời gian
- chỉ giữ kết quả mới nhất; thay đổi input chỉ đánh dấu kết quả AI là `Đã lỗi thời`
- chỉ truyền các đoạn trích tài liệu liên kết trực tiếp với tiêu chí
- cho phép AI trả `Cần chuyên gia xem xét` và nêu dữ liệu thiếu hoặc điểm mơ hồ
- kết quả AI chỉ mang tính khuyến nghị, không sửa đánh giá thủ công
- dùng quota toàn cục; không tự retry
- job do tab hiện tại điều phối, hiển thị tiến độ; đóng tab, chuyển trang hoặc mất kết nối thì hủy ngay toàn bộ phần chưa hoàn thành, nhưng giữ cache của các tiêu chí đã hoàn thành
- lỗi một phần làm dừng toàn bộ job hiện tại

Các quyết định trên là compatibility notes, không phải acceptance criteria của MVP. AI phải được đề xuất, threat-model và kiểm soát chi phí trong một OpenSpec change riêng trước khi triển khai.

## UX Structure

### Danh sách hồ sơ

- Bảng danh sách gọn, ưu tiên tên thiết bị, phiên bản cơ sở hiện hành, số nhà cung cấp/phương án, tiến độ đánh giá và thời điểm cập nhật.
- Hành động chính: tạo hồ sơ, mở hồ sơ.
- Không dùng landing page hoặc dashboard marketing.

### Chi tiết hồ sơ

Ba vùng công việc chính:

1. `Cấu hình cơ sở`: soạn thảo, import, sản phẩm tham chiếu và khóa phiên bản.
2. `Phương án`: quản lý nhà cung cấp, phương án, phản hồi và tài liệu.
3. `So sánh & đánh giá`: ma trận tổng quan và workflow đánh giá từng phương án.

Quan hệ nhà cung cấp và phương án được thể hiện bằng nhóm nhẹ, không dùng cây lồng nhiều tầng. Mọi selector và tiêu đề dùng nhãn `Nhà cung cấp · Model/tên phương án`.

Trong tab `Cấu hình cơ sở`, editor ưu tiên danh sách nhóm/tiêu chí theo chiều dọc. Bề mặt đối chiếu sản phẩm tham chiếu dùng cùng các hàng đó, cột yêu cầu cơ sở sticky và cột sản phẩm động. Khi nhiều sản phẩm vượt viewport, UI dùng chọn cột, cuộn ngang và panel chi tiết; dữ liệu vẫn truy cập đầy đủ mà không cần schema cột tùy biến.

### Stitch references

- Project: `15308531586654760571`
- Design system: `assets/5915840001267045529`
- Builder reference: `6a623d7a26be4cfcad4faf9f31a1daf7`
- Bulk text entry reference: `c6c13d5795e4431a84504e87f46f33c7`
- Dossier list reference: `52a2a8c662904f62b43285a4294d2b8c`

Các màn hình Stitch có nội dung AI hoặc semantics đấu thầu cũ chỉ là tài liệu tham khảo layout. Khi triển khai phải áp dụng scope MVP và thuật ngữ của change này.

## Error Handling

- URL sai định dạng: không lưu và hiển thị lỗi ngay cạnh trường.
- Template không đúng phiên bản hoặc thiếu metadata: từ chối import và hướng dẫn tải template mới.
- Dòng Excel lỗi: hiển thị số dòng, trường và lý do; không ghi một phần.
- Mã/ID tiêu chí không tồn tại trong phiên bản cơ sở đã chọn: từ chối dòng.
- Phiên bản đã khóa: mọi mutation nội dung bị backend từ chối, kể cả request gọi trực tiếp.
- Thiếu quyền: trả `403`/lỗi quyền thống nhất và không để lộ dữ liệu.
- Conflict cập nhật: không ghi đè; giữ form chưa lưu để người dùng đối chiếu.
- Xóa tài liệu đang được liên kết trong dữ liệu còn chỉnh sửa: yêu cầu xác nhận và nêu số liên kết bị ảnh hưởng.
- Xóa hoặc sửa document metadata/URL thuộc phiên bản cơ sở đã khóa: từ chối trước khi áp dụng flow xác nhận xóa.
- Hồ sơ đã archive: list mặc định không trả hồ sơ, get vẫn đọc được và mọi mutation con trả conflict `archived_dossier`.

`callRpc()` hiện có tiếp tục phục vụ các consumer hiện tại và không được đổi global trong change này. P3A tạo adapter typed riêng cho module, đọc payload `{ error: payload }` từ RPC proxy và bảo toàn HTTP status cùng `code`, `message`, `details`, `hint` để UI phân biệt lỗi quyền, không tìm thấy, conflict và validation.

## Risks / Trade-offs

- **Text-first khó tự động tính toán:** đây là chủ đích vì dữ liệu không dùng cho phép tính backend. Giảm rủi ro bằng nhóm, mã tiêu chí, thứ tự và đánh giá có cấu trúc.
- **Bốn nhóm mặc định có thể không phù hợp mọi thiết bị:** giảm bằng cách lưu chúng như dữ liệu khởi tạo có thể đổi tên, thêm, xóa và sắp xếp; không dùng enum hoặc validation khóa tên.
- **Không có arbitrary content columns:** tránh chiều dữ liệu thứ ba và giữ import/so sánh nhất quán. Người dùng biểu diễn khác biệt bằng nhóm, tiêu chí và text nhiều dòng không giới hạn nghiệp vụ.
- **Ma trận nhiều phương án có thể quá rộng:** giảm bằng chọn cột, ghim cột, cuộn ngang và chế độ tập trung.
- **Phương án nhà cung cấp không khóa:** phù hợp dữ liệu tư vấn đang làm việc nhưng không tạo hồ sơ pháp lý bất biến. UI phải ghi rõ thời điểm cập nhật gần nhất.
- **Trích shared attachment UI có thể ảnh hưởng Equipment:** giữ public behavior hiện tại và bổ sung regression tests cho Equipment trước khi thay consumer.
- **AI compatibility có thể bị hiểu là AI đã sẵn sàng:** UI MVP không hiển thị affordance AI; design ghi rõ cần change riêng.

## Migration Plan

1. Thêm schema và quyền mới mà không sửa bảng Equipment.
2. Xây module mới sau feature boundary `admin/global`.
3. Sau P5 và trước bề mặt tài liệu đầu tiên ở P7B, thêm shared URL attachment primitives rồi chuyển Equipment sang primitive đó với regression coverage.
4. Không backfill dữ liệu; hồ sơ được tạo mới hoàn toàn.
5. Chỉ apply migration lên live Supabase sau khi người dùng cấp quyền rõ ràng cho thao tác live DB cụ thể.

Rollback có thể gỡ route/navigation và migration mới mà không tác động dữ liệu Equipment. Việc xóa dữ liệu đã tạo trong module phải là quyết định migration riêng, không thực hiện tự động khi rollback UI.

## Open Questions

Không còn câu hỏi chặn proposal. Các chi tiết trình bày nhỏ sẽ được quyết định trong implementation plan theo design system hiện có và ưu tiên workflow thủ công.
