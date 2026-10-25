# RPT-1007 — Thiết kế Excel Báo cáo theo mẫu Shortcut

- Status: Todo
- Issue: [#1007](https://github.com/thienchi2109/qltbyt-nam-phong/issues/1007)
- Updated: 2026-10-25
- Stage: đã khảo sát; hướng thiết kế đang đề xuất, chưa sửa exporter.
- Evidence baseline: `main` tại `7dc0a2bb`.
- Reference chính do người dùng chọn: [Shortcut — Inventory Spreadsheet](https://shortcut.ai/templates/inventory-spreadsheet-template).

## Mục tiêu và phạm vi

File XLSX từ tab Báo cáo Xuất-Nhập-Tồn có bố cục chuyên nghiệp, làm nổi bật chỉ số quan trọng, dễ đọc trên màn hình và khi in. Áp dụng ngôn ngữ trình bày của mẫu Shortcut vào workbook nhiều sheet hiện tại; giữ nội dung và ngữ nghĩa dữ liệu Reports.

CSV riêng của tab Sử dụng, exporter danh sách Thiết bị và workbook Temperature Monitoring nằm ngoài task này. Bổ sung sheet/KPI mới là thay đổi nội dung cần chốt riêng.

## Kết quả khảo sát code

- Luồng: `ExportReportDialog.handleExport` → `buildExportSheets` → `createMultiSheetExcel` → ExcelJS `writeBuffer()` → browser download. Xem [dialog](<../../src/app/(app)/reports/components/export-report-dialog.tsx>), [sheet builder](<../../src/app/(app)/reports/components/export-report-dialog.utils.ts>) và [writer](../../src/lib/excel-utils.ts).
- Có 3 sheet nền: Tổng quan, Chi tiết giao dịch, Thống kê giao dịch. Dữ liệu bổ sung tạo các sheet phân bố trạng thái/khoa-phòng/vị trí, sửa chữa/bảo trì, tổng quan sử dụng và sử dụng hằng ngày. Phần thiết bị chưa sử dụng trên web hiện chưa có trong workbook.
- Writer hiện chủ yếu in đậm/tô xám dòng đầu và đặt độ rộng cột; chưa phân biệt tiêu đề, metadata, KPI và header bảng. Ngày đã là chuỗi `dd/MM/yyyy`, chưa có native Excel date format; VND/% là số thô chưa có number format. Chưa có freeze, auto-filter hay cấu hình in.
- ExcelJS 4.4.0 đã được cài và lazy-load qua [excel-workbook.ts](../../src/lib/excel-workbook.ts). Writer nhiều sheet hiện chỉ có Reports gọi; ưu tiên mở rộng seam này và dùng năng lực ExcelJS hiện có. Helper style phong phú tìm thấy thuộc riêng Technical Config, chưa được Reports sử dụng; không mặc định đó là theme chung. Không cần dependency mới theo khảo sát hiện tại.
- Workbook hiện có kỳ, khoa/phòng và thời điểm xuất. Đơn vị, tập dữ liệu và từ khóa tìm kiếm là metadata đề xuất bổ sung trong mockup, chỉ dùng context sẵn có và không tính lại dữ liệu.
- Test dialog hiện mock writer, nên chưa bảo vệ format workbook thực. Workbook được dựng trong bộ nhớ; loader yêu cầu page đầu với page size 10.000. Task không được làm nặng toàn bộ grid hoặc ngầm đổi pagination.

## Mẫu Shortcut đã kiểm chứng

Đã xem [preview](https://shortcut.ai/templates/thumbnails/inventory-spreadsheet-template.png) và đọc ZIP/XML của workbook công khai trong bộ nhớ; không lưu workbook hoặc URL tải có chữ ký vào repo.

| Thành phần thực tế trong mẫu                                                       | Hướng áp dụng vào Reports                                                               |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Một sheet Inventory; tiêu đề Aptos 18 pt, đậm, merge B2:J2                         | Tiêu đề tiếng Việt rõ ràng; giữ workbook nhiều sheet của Reports                        |
| Bốn ô KPI tại hàng 4–5, header bảng tại hàng 8                                     | Dải 4 KPI sẵn có: Tổng nhập, Tổng xuất, Tồn kho, Biến động                              |
| Navy `#264B7D`, xanh nhạt `#BDD7EE`, xanh lá `#C6EFCE`, đỏ nhạt `#FFC7C7`          | Navy/teal, trắng và xám nhạt; màu trạng thái có tiết chế, luôn kèm nhãn chữ             |
| Freeze 8 hàng đầu; dropdown category/location; tô cả dòng theo mức tồn             | Giữ header và cột định danh khi cuộn; màu chỉ áp dụng theo trạng thái/ngữ nghĩa đã có   |
| Công thức tổng tiền dùng shared formula J9:J50; hàng trống hiển thị `$0.00`        | Chỉ ghi hàng dữ liệu thực, giữ thiếu giá trị khác số 0; tiền hiển thị VND               |
| Không có table/auto-filter; in Letter dọc; vùng khai báo lớn hơn vùng dữ liệu thực | Bổ sung filter đúng vùng bảng, vùng in gọn và A4 phù hợp; không sao chép preset 50 hàng |

Không đưa SKU, reorder point, low-stock count, công thức hoặc ngưỡng tồn kho của mẫu sang Reports. Chỉ số Biến động giữ dấu và nhãn; không tự gắn tăng/giảm với tốt/xấu.

## Hướng thiết kế đề xuất

**Khuyến nghị: tổng quan theo bố cục Shortcut, bảng chi tiết nhất quán.** Sheet Tổng quan có tiêu đề, đơn vị, khoa/phòng, kỳ báo cáo, tập dữ liệu và thời điểm xuất; bên dưới là 4 KPI có nhãn rõ, số lớn và màu nền nhẹ. Các sheet còn lại dùng cùng typography, header và bảng, với metadata đúng phạm vi từng sheet.

Phương án nhẹ hơn là chỉ làm đẹp bảng hiện có; ít thay đổi nhưng chưa giải quyết rõ nhu cầu nhấn mạnh KPI. Chưa đề xuất dashboard biểu đồ hoặc chỉ số mới.

- Font Aptos/Calibri có hỗ trợ tiếng Việt; tiêu đề khoảng 18 pt, KPI 20–24 pt, bảng 10–11 pt. Không hard-code tên/logo bệnh viện; chỉ dùng thông tin đơn vị đã có.
- Header đậm, chữ tương phản; hàng xen kẽ nhẹ, border mảnh, wrap tên dài, độ rộng cột phù hợp. Merge chỉ dùng ở tiêu đề/KPI, giữ vùng dữ liệu có thể lọc/sắp xếp.
- Số đếm nguyên, VND dạng numeric, ngày `dd/MM/yyyy`, timestamp có giờ; phần trăm 25 phải hiển thị 25%, không thành 2.500%. Giá trị thiếu để trống hoặc có nhãn phù hợp, khác số 0.
- Freeze theo vị trí header thực; filter chỉ bao vùng dữ liệu; in A4 ngang cho bảng rộng, fit một trang theo chiều rộng, nhiều trang theo chiều cao, lặp header và đánh số trang. Không in màu nền quá đậm toàn sheet.
- Đề xuất thông điệp cho sheet rỗng được chốt trong mockup; không sinh dãy 0 hoặc hàng trang trí giả dữ liệu. Chế độ nhiều đơn vị phải nói rõ khi không có dữ liệu chi tiết.

## Các ngữ nghĩa phải giữ rõ

- Tổng nhập/xuất/Biến động theo kỳ, còn Tồn kho và phân bố trạng thái là snapshot hiện tại; không trình bày như một phép đối chiếu số dư cùng kỳ.
- Search lọc chi tiết nhưng summary nhập/xuất được tính trước search. Metadata phải nói rõ phạm vi mỗi phần, không hứa tổng chi tiết bằng KPI khi phạm vi khác nhau.
- Dữ liệu sử dụng bổ sung chưa nhận khoa/phòng; overview không có date args, daily dùng số ngày suy ra từ khoảng chọn. Không gán nhãn chung khiến sheet này có vẻ theo đúng kỳ/khoa của sheet giao dịch. Thay đổi logic scope cần task riêng nếu được duyệt.
- Giữ nhãn trạng thái catalog, kể cả trạng thái 0 và trạng thái lịch sử/không rõ; không làm mất trạng thái để bảng gọn hơn. Giữ số lượng hồ sơ thiếu chi phí khác chi phí bằng 0.

## Acceptance

- [x] Khảo sát luồng xuất, nội dung, style, test seam và khả năng tái sử dụng bằng subagent read-only.
- [x] Xem preview và kiểm tra workbook mẫu Shortcut thực; ghi nguồn và giới hạn tham khảo.
- [ ] Chốt layout bằng workbook minh hoạ dùng dữ liệu giả, có cả sheet Tổng quan và một sheet chi tiết.
- [ ] Áp dụng thiết kế cho mọi sheet hiện có, nhấn mạnh KPI và có metadata đúng phạm vi; giữ lựa chọn sheet xuất.
- [ ] Giữ tenant scope, dataset, bộ lọc, số hàng, thứ tự, cột, nhãn và giá trị; không đổi RPC/migration trong task trình bày.
- [ ] TDD bằng test đọc lại workbook ExcelJS thật: kiểm tra dữ liệu/KPI cùng style, merges, number formats, freeze, filter và page setup; không chỉ mock download hoặc kiểm tra hàm tồn tại.
- [ ] Kiểm tra file nhỏ, nhiều hàng, rỗng, tên dài, VND/null/0, phần trăm 0/25/100, trạng thái lịch sử và chế độ nhiều đơn vị; mở file để review trực quan và print preview.
- [ ] Chạy gate TS/React bắt buộc khi triển khai; ghi rõ mức kiểm chứng workbook tự động và smoke Excel/LibreOffice thực tế.

## Tham khảo bổ trợ

- [Microsoft — Excel tables](https://support.microsoft.com/en-us/office/overview-of-excel-tables-7ab0bb7d-3a9e-4b56-a3c9-6c94334e492c): header/filter, banded rows, total row.
- [Microsoft — Conditional formatting](https://support.microsoft.com/en-us/office/use-conditional-formatting-to-highlight-information-in-excel-fed60dfa-1d3f-4e13-9ecb-f1951ff89d7f): quy tắc nhấn mạnh giá trị có ngữ nghĩa.
- [Microsoft — Freeze panes](https://support.microsoft.com/en-us/office/freeze-panes-to-lock-rows-and-columns-dab2ffc9-020d-4026-8121-67dd25f2508f): giữ header/cột định danh khi cuộn.
- [ExcelJS documentation](https://github.com/exceljs/exceljs/blob/master/README.md): styles, number formats, views, auto-filter, page setup.
