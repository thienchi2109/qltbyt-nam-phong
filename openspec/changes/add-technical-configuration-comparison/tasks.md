## 1. Discovery and Contracts

- [ ] 1.1 Chốt route, navigation label và terminology hiển thị cho "Hồ sơ phân tích", "Nhà cung cấp" và "Phương án cấu hình".
- [ ] 1.2 Chuyển conceptual entities trong `design.md` thành schema/RPC contract, kèm authorization matrix cho `global`, `admin` và các role bị từ chối.
- [ ] 1.3 Chuyển state machine và điều kiện khóa trong `design.md` thành database/API contract, gồm tối thiểu một nhóm, một tiêu chí có nội dung, mã không trùng và không còn lỗi import.
- [ ] 1.4 Chốt mapping trạng thái tổng hợp hai trục dưới dạng shared pure function và bảng test.
- [ ] 1.5 Chốt template Excel version metadata, sheet/column contract và error model trước khi viết parser.

## 2. Database and Authorization

- [ ] 2.1 Viết migration tạo hồ sơ phân tích và phiên bản cấu hình cơ sở độc lập với `thiet_bi`.
- [ ] 2.2 Thêm nhóm, tiêu chí, sản phẩm tham chiếu và thứ tự hiển thị với foreign key/index phù hợp.
- [ ] 2.3 Thêm nhà cung cấp, phương án, phản hồi theo phiên bản cơ sở và thông tin bổ sung.
- [ ] 2.4 Thêm tài liệu URL và liên kết tiêu chí có trang/mục/đoạn trích.
- [ ] 2.5 Thêm đánh giá thủ công hai trục và metadata người đánh giá.
- [ ] 2.6 Thêm constraint/trigger/RPC guard để phiên bản đã khóa bất biến tuyệt đối.
- [ ] 2.7 Thêm deny-by-default grants, RLS/RPC authorization và JWT claim guards cho `admin/global`.
- [ ] 2.8 Thêm optimistic concurrency contract cho các mutation dữ liệu làm việc.
- [ ] 2.9 Viết SQL contract tests hoặc verification queries cho quyền, immutability, uniqueness và cascade behavior.
- [ ] 2.10 Xin phép riêng trước khi apply migration lên live Supabase MCP; sau apply chạy security/performance advisors.

## 3. Shared URL Attachment Pattern

- [ ] 3.1 Khảo sát đầy đủ `EquipmentDetailFilesTab`, `useEquipmentAttachments` và consumer tests trước khi trích xuất.
- [ ] 3.2 Tách shared URL validation, form/list presentation và external-link behavior không phụ thuộc `thiet_bi`.
- [ ] 3.3 Giữ data hooks và persistence adapters theo từng domain; không dùng `file_dinh_kem` cho module mới.
- [ ] 3.4 Chuyển Equipment sang shared primitive mà không đổi hành vi người dùng.
- [ ] 3.5 Viết regression tests cho Equipment và tests mới cho document URL/trích dẫn của module.

## 4. Excel Templates and Import

- [ ] 4.1 Tạo helper `exceljs` sinh template cấu hình cơ sở có version metadata và text nhiều dòng.
- [ ] 4.2 Tạo parser/validator cấu hình cơ sở độc lập UI, hỗ trợ preview và lỗi theo dòng.
- [ ] 4.3 Tạo template phương án từ phiên bản cơ sở đã chọn, giữ ID/mã tiêu chí làm khóa ánh xạ.
- [ ] 4.4 Tạo parser/validator phương án và từ chối template sai phiên bản, tiêu chí lạ hoặc trùng.
- [ ] 4.5 Bảo đảm import atomic: không ghi một phần khi preview còn lỗi.
- [ ] 4.6 Viết unit tests cho round-trip, Unicode tiếng Việt, multiline text, duplicate IDs, malformed files và version mismatch.

## 5. Baseline Authoring Workflow

- [ ] 5.1 Thêm danh sách hồ sơ phân tích chỉ dành cho `admin/global`.
- [ ] 5.2 Thêm flow tạo hồ sơ cho đúng một loại thiết bị, không chọn từ `thiet_bi`.
- [ ] 5.3 Thêm editor hai cấp nhóm/tiêu chí, reorder, nhập text nhiều dòng và explicit save.
- [ ] 5.4 Thêm nhập nhanh nhiều tiêu chí với preview trước khi lưu.
- [ ] 5.5 Thêm import cấu hình cơ sở từ template chuẩn.
- [ ] 5.6 Thêm quản lý sản phẩm tham chiếu tùy chọn, tách khỏi nhà cung cấp.
- [ ] 5.7 Thêm tạo bản nháp mới từ trống hoặc sao chép bản đã khóa.
- [ ] 5.8 Thêm flow xác nhận khóa, hiển thị người/thời điểm khóa và loại bỏ toàn bộ edit affordance sau khóa.
- [ ] 5.9 Viết tests cho draft editing, explicit save, lock confirmation và backend rejection sau khóa.

## 6. Supplier and Option Workflow

- [ ] 6.1 Thêm quản lý nhà cung cấp trong hồ sơ.
- [ ] 6.2 Thêm nhiều phương án/model cho một nhà cung cấp với nhãn `Nhà cung cấp · Model/tên phương án`.
- [ ] 6.3 Thêm nhập phản hồi thủ công theo tiêu chí và trường thông tin bổ sung riêng.
- [ ] 6.4 Thêm import phương án bằng template xuất từ phiên bản cơ sở.
- [ ] 6.5 Thêm danh sách tài liệu URL theo phương án và liên kết tài liệu với từng tiêu chí.
- [ ] 6.6 Giữ phương án có thể sửa trực tiếp; không thêm lock/version controls.
- [ ] 6.7 Viết tests cho nhiều phương án cùng nhà cung cấp, đổi phiên bản cơ sở và mapping phản hồi đúng tiêu chí.

## 7. Comparison and Manual Evaluation

- [ ] 7.1 Xây ma trận có cột yêu cầu sticky, nhóm sticky, chọn/ghim phương án và horizontal scrolling.
- [ ] 7.2 Thêm view đánh giá một phương án với danh sách tiêu chí bên trái và panel chi tiết bên phải.
- [ ] 7.3 Thêm hai trục đánh giá, ghi chú và trạng thái tổng hợp read-only.
- [ ] 7.4 Thêm `Lưu` và `Lưu & tiếp tục`; không autosave.
- [ ] 7.5 Ngăn chuyển tiêu chí làm mất thay đổi chưa lưu bằng cảnh báo hoặc giữ draft cục bộ trong view.
- [ ] 7.6 Hiển thị thông tin bổ sung nhưng loại khỏi mapping trạng thái.
- [ ] 7.7 Thêm tổng hợp tiến độ/trạng thái theo nhóm và theo phương án.
- [ ] 7.8 Thêm xếp hạng tham khảo tùy chọn, đồng hạng và disclaimer bắt buộc.
- [ ] 7.9 Loại phương án chưa đánh giá đủ hai trục cho mọi tiêu chí áp dụng khỏi xếp hạng và hiển thị lý do.
- [ ] 7.10 Ngăn xếp hạng chéo hồ sơ, phiên bản cơ sở và sản phẩm tham chiếu.
- [ ] 7.11 Giữ kết luận thủ công khi dữ liệu nguồn thay đổi; không thêm manual-staleness lifecycle.
- [ ] 7.12 Viết tests cho mapping hai trục, explicit save, navigation, ranking eligibility và ties.

## 8. UX, Accessibility, and Resilience

- [ ] 8.1 Áp dụng Stitch design system và các screen reference nhưng loại bỏ AI/đấu thầu semantics ngoài MVP.
- [ ] 8.2 Kiểm tra text dài tiếng Việt, multiline requirements và nhãn phương án không tràn/đè UI.
- [ ] 8.3 Bảo đảm keyboard navigation, focus management, tooltips icon và accessible labels cho matrix/panel.
- [ ] 8.4 Thêm loading, empty, error, unauthorized, conflict và locked states.
- [ ] 8.5 Thiết kế desktop-first cho matrix và focus mode khả dụng trên viewport hẹp.
- [ ] 8.6 Chạy Playwright screenshot/interaction checks cho các workflow chính trên desktop và mobile.

## 9. AI Extension Boundary

- [ ] 9.1 Xác nhận schema có ID ổn định và quan hệ criterion-level cần cho payload AI tương lai.
- [ ] 9.2 Xác nhận trích dẫn tiêu chí tách khỏi document metadata và đánh giá thủ công tách khỏi kết quả máy.
- [ ] 9.3 Không thêm AI UI, API, job, cache, quota, AI columns hoặc unused AI tables trong MVP.
- [ ] 9.4 Ghi issue/OpenSpec follow-up riêng khi bắt đầu AI, kế thừa compatibility notes trong `design.md`.

## 10. Verification and Rollout

- [ ] 10.1 Chạy format check, `verify:no-explicit-any`, `verify:dedupe`, typecheck và focused tests theo thứ tự repo quy định.
- [ ] 10.2 Chạy `react-doctor` sau khi hoàn tất React changes.
- [ ] 10.3 Chạy semantic dedup review cho shared URL attachment và Excel helpers.
- [ ] 10.4 Chạy authorization tests cho cả raw session role `admin` và `global`.
- [ ] 10.5 Chạy OpenSpec validation và cập nhật checklist theo kết quả thực tế.
- [ ] 10.6 Rollout sau feature boundary `admin/global`; xác nhận không có regression ở Equipment attachments.
