# Redesign UI tab “So sánh & Đánh giá”

## Tóm tắt

- Chuyển màn hình từ nhiều tầng thống kê lặp sang: **utility toolbar → tiến độ tổng → bộ lọc → matrix/panel hiện tại**.
- Chỉ thay đổi frontend React và layout; không đổi database, RPC, API, query key, status enum hoặc pagination contract.
- Giữ nguyên workflow chọn phương án, dirty-navigation guard, save-and-continue, comparison matrix, panel đánh giá và export.

## Thay đổi chính

### 1. Bố cục đầu tab

- Tách phần đầu khỏi `TechnicalConfigurationEvaluationActiveWorkspace` thành component overview cục bộ để file điều phối không vượt ngưỡng 350 dòng.
- Utility toolbar đặt các control so sánh bên trái và export bên phải; tự chuyển thành một cột trên màn hình nhỏ.
- Sau toolbar lần lượt là progress summary, chọn phương án + filter, rồi matrix.
- Hierarchy navigator không còn hiển thị đồng thời với matrix; chỉ mở trong drawer điều hướng theo yêu cầu.
- Không thêm search, sticky header, status-card con hoặc icon hard-code theo tên nhóm.

### 2. Progress và filter

- Viết lại `TechnicalConfigurationProgressSummary` thành một vùng duy nhất:
  - Progress ring kích thước ổn định, hiển thị phần trăm.
  - Bên cạnh là `đã đánh giá / tổng`.
  - Không linear progress, KPI nhóm, hierarchy summary hoặc chuỗi status count.
  - Ring có `role="progressbar"` và đầy đủ `aria-valuemin/max/now`.
- Loading dùng skeleton giữ kích thước; lỗi dùng inline alert; tổng bằng `0` hiển thị `0%`.
- Mở rộng `TechnicalConfigurationEvaluationFilters` nhận count theo bốn filter hiện có:
  - `Tất cả`
  - `Chưa đánh giá`
  - `Không đạt`
  - `Chưa đủ bằng chứng`
- Desktop dùng segmented buttons với `aria-pressed`; mobile dùng `Select`. Count `0` vẫn hiện, còn dữ liệu chưa sẵn sàng dùng placeholder thay vì số `0` giả.
- Count luôn lấy từ progress toàn bộ của phương án đang chọn, không lấy từ trang hiện tại hoặc tập đã lọc.

### 3. Hierarchy và danh sách tiêu chí

- Matrix là nguồn danh sách tiêu chí duy nhất luôn hiển thị trên màn hình.
- Hierarchy navigator chuyển vào drawer đóng mặc định, mở bằng nút `Mục lục tiêu chí` cạnh bộ lọc và tự đóng sau khi chọn một tiêu chí.
- Group/subgroup header chỉ có một chevron và toàn bộ header là nút đóng/mở.
- Luôn hiển thị ratio; progress bar ngắn chỉ xuất hiện khi `0 < evaluated < total`.
- Chỉ hiện ngoại lệ khác `0`: `Không đạt n` và `Cần làm rõ n`, với `Cần làm rõ = Chưa rõ + Chưa đủ bằng chứng`.
- Aggregate đạt dùng check xanh; toàn bộ không áp dụng dùng check trung tính; không dùng badge “Đang đánh giá”.
- Subgroup giữ cấu trúc lồng, thụt một cấp và có độ nhấn thấp hơn group.
- Mặc định chỉ mở ancestor của tiêu chí hiện hành. Giữ các thao tác mở thêm khi page key không đổi; đổi page/filter/phương án sẽ khởi tạo lại theo tiêu chí mới.
- Navigator tiếp tục là page-local với page size `50`. Không chèn global group `0/0`; structural row rỗng chỉ được render muted nếu đã có trong page-local input.
- Danh sách dùng CSS grid dạng bảng trên desktop với ba cột ổn định: mã, nội dung, trạng thái. Mobile chuyển thành hàng hai tầng, không tạo horizontal scroll.
- Cả dòng tiêu chí tiếp tục là action mở panel, giữ `aria-current`, keyboard focus và status badge hiện tại; trailing icon thay cho menu ba chấm.
- Xóa component status-count cũ nếu không còn caller sau refactor. Matrix và panel chỉ giảm border/spacing để nối liền bố cục, không đổi internals.
- Không render hierarchy list inline phía trên matrix, kể cả trên desktop.

## Interface nội bộ

- Không có thay đổi public API hoặc wire type.
- `TechnicalConfigurationEvaluationProgress` và `TechnicalConfigurationEvaluationStatusFilter` giữ nguyên.
- Filter component nhận thêm map count nội bộ; matrix controls/overview truyền progress của phương án đang chọn xuống filter.
- Component overview mới chỉ sở hữu composition/layout, không giữ state hoặc nhân bản navigation logic.
- Drawer chỉ sở hữu trạng thái mở/đóng; paging, filter, selection, dirty guard và panel workflow vẫn dùng các hook hiện có.

## TDD và kiểm chứng

1. Viết test thất bại cho summary mới: một progress ring, ratio rõ nghĩa, không KPI/status summary trùng, xử lý `0%`, loading và error.
2. Viết test filter responsive: đúng bốn giá trị contract, count kể cả `0`, `aria-pressed`, disabled/transition và callback không đổi.
3. Viết lại hierarchy tests: ancestor mở mặc định, manual expansion, subgroup nesting, ratio/bar có điều kiện, exception count, không render status bằng `0`, row action và mobile structure.
4. Cập nhật composition/regression tests để khóa thứ tự overview → matrix, navigator chỉ xuất hiện trong drawer và bảo toàn paging, dirty guard, filter-after-save, save-and-continue, panel focus return.
5. Chạy theo thứ tự repo:
   - `format:check`
   - `verify:no-explicit-any`
   - `verify:dedupe`
   - `typecheck`
   - focused Vitest cho evaluation UI/navigation/workspace
   - `react-doctor`
6. Không chạy Playwright, screenshot hoặc visual browser test theo điều chỉnh cuối cùng.

## Giả định đã khóa

- Desktop/laptop là trải nghiệm chính; tablet/mobile vẫn đầy đủ thao tác bằng bố cục một cột.
- “Đã đánh giá” tiếp tục dùng semantics hiện có, không đồng nhất với “Đạt”.
- Filter chỉ dùng bốn giá trị RPC hiện hành; không thêm `Đã đánh giá`, `Cần xử lý` hoặc `Chưa rõ`.
- Không thay page size, server filtering, projection, query flow hoặc data-fetching behavior.
