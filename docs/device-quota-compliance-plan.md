# Kế hoạch triển khai chức năng theo dõi định mức thiết bị

## 1. Bối cảnh & mục tiêu
- Hệ thống hiện quản lý vận hành thiết bị y tế đa đơn vị (multi-tenant) nhưng chưa có cơ chế chuẩn để so sánh số lượng thiết bị với định mức được cơ quan có thẩm quyền phê duyệt.
- Pháp lý nền tảng: Luật Quản lý, sử dụng tài sản công; Nghị định/Thông tư hướng dẫn (đặc biệt Thông tư 08/2019/TT-BYT cho trang thiết bị y tế). Các tiêu chuẩn định mức quy định rõ chủng loại, số lượng tối đa/mức giá và quy trình phê duyệt khi vượt chuẩn.
- Mục tiêu: cung cấp cho từng đơn vị khả năng nhập, duy trì định mức được phê duyệt, so sánh tự động với thực tế, cảnh báo vượt chuẩn, hỗ trợ quy trình xin vượt định mức và báo cáo kiểm tra tuân thủ.

## 2. Nguyên tắc & giả định thiết kế
- **Tuân thủ vai trò & luận cứ pháp lý**: chỉ người có thẩm quyền mới cập nhật định mức; đơn vị thường chỉ xem, tự kiểm tra và lập đề nghị vượt định mức.
- **Multi-tenant an toàn**: tất cả RPC/API phải nhận `p_don_vi`, xác định lại từ JWT đối với người không phải `global`.
- **Lưu vết đầy đủ**: mọi thay đổi định mức, lần kiểm tra, đề nghị vượt chuẩn đều phải có lịch sử phục vụ kiểm toán.
- **Idempotent migrations**: SQL Supabase phải kiểm tra tồn tại trước khi tạo/sửa.
- **Khả năng mở rộng**: kiến trúc cho phép thêm tiêu chí tính toán (ví dụ số giường bệnh) mà không đụng vào dữ liệu lịch sử.

## 3. Phạm vi & yêu cầu nghiệp vụ
| Hạng mục | Mô tả nghiệp vụ | Nhóm người dùng |
|----------|-----------------|-----------------|
| Quản lý định mức | Nhập định mức cho từng loại thiết bị theo đơn vị/khoa phòng, lưu hồ sơ phê duyệt, ngày hiệu lực | Quản trị cấp bộ, quản trị đơn vị có thẩm quyền |
| Theo dõi tuân thủ | So sánh real-time số lượng thiết bị thực tế vs định mức, trạng thái "Đạt/Thiếu/Vượt" | Toàn bộ đơn vị, đặc biệt quản trị khoa phòng |
| Quy trình vượt định mức | Đơn vị tạo đề nghị vượt chuẩn kèm lý do, tài liệu; luồng duyệt nhiều cấp | Đơn vị đề xuất, cấp duyệt |
| Kiểm tra & tự kiểm tra | Lập biên bản kiểm tra, checklist tuân thủ, ghi nhận xử lý vi phạm | Cơ quan kiểm tra, đơn vị |
| Báo cáo & xuất khẩu | Dashboard, export Excel/PDF tổng hợp định mức, vượt chuẩn, lịch sử kiểm tra | Cấp lãnh đạo |

Không nằm trong phạm vi giai đoạn đầu: tự động tính định mức dựa trên số giường bệnh; tích hợp thẳng với hệ thống văn bản điều hành.

## 4. Thiết kế dữ liệu & migrations (Supabase Postgres)
### 4.1 Danh mục loại thiết bị chuẩn
- Bảng `public.thiet_bi_chuan_loai`: `id`, `ma_loai`, `ten_loai`, `mo_ta`, `nhom` (đặc thù/khác), `phan_loai_phap_ly`, `created_at`, `updated_at`.
- Mapping sang thiết bị thực tế: thêm cột `chuan_loai_id` (FK) cho bảng `thiet_bi`, cập nhật dữ liệu hiện có bằng script bán tự động hoặc qualy mapping.

### 4.2 Cấu trúc cây nhóm định mức
- Bảng `public.thiet_bi_dinh_muc_nhom` để biểu diễn cấu trúc giống tài liệu tham khảo (cấp cơ sở → nhóm → hạng mục → tiểu hạng mục):
  - `id` (PK), `don_vi_id` (FK `don_vi`), `parent_id` (FK self-reference, NULL cho cấp gốc), `ten_nhom`, `loai_cap` (`cap_co_so`, `cap_nhom`, `cap_hang_muc`, `cap_tieu_hang_muc`...), `thu_tu_hien_thi` (INT), `ma_stt_hien_thi` (TEXT, ví dụ “I”, “A”, “1”, “a”), `ghi_chu`, timestamps, `created_by`, `updated_by`.
  - Cho phép một đơn vị có nhiều cây nhóm; có thể reuse cho các cơ sở khác bằng cách copy tree mẫu.

### 4.3 Định mức chi tiết theo hạng mục
- Bảng `public.thiet_bi_dinh_muc_chi_tiet`:
  - `id` (PK), `don_vi_id`, `nhom_id` (FK tới `thiet_bi_dinh_muc_nhom`, yêu cầu node lá), `chuan_loai_id` (nullable), `pham_vi` (ENUM `toan_don_vi`/`khoa_phong`/`du_an`), `khoa_phong` (TEXT nullable),
  - `don_vi_tinh` (TEXT), `so_luong_dinh_muc` (NUMERIC), `so_luong_toi_thieu` (NUMERIC optional), `gia_tri_toi_da` (NUMERIC optional), `so_van_ban_phe_duyet`, `ngay_hieu_luc`, `ngay_het_han` (nullable), `trang_thai` (`hieu_luc`/`het_hieu_luc`/`cho_duyet`), `ghi_chu`, `created_by`, `updated_by`, timestamps.
  - Constraint duy nhất: không trùng `don_vi_id + nhom_id + COALESCE(khoa_phong,'__all__') + trang_thai=hieu_luc`.
  - Nếu cần lưu định mức tổng ở cấp nhóm (ví dụ “Hệ thống CT – Scanner” trước khi phân nhánh a/b/c), thêm cột `allow_group_quota BOOLEAN DEFAULT FALSE` và cho phép `nhom_id` không phải leaf khi flag bật.

### 4.4 Lịch sử thay đổi định mức
- Bảng `public.thiet_bi_dinh_muc_lich_su`: `id`, `chi_tiet_id`, `snapshot JSONB`, `thao_tac` (`tao`, `cap_nhat`, `huy`), `thuc_hien_boi`, `ly_do`, `thoi_diem`.

### 4.5 Đề nghị vượt định mức & luồng duyệt
- Bảng `public.de_nghi_vuot_dinh_muc`: `id`, `don_vi_id`, `nhom_id`, `chuan_loai_id`, `so_luong_hien_co`, `muc_dinh_de_xuat`, `ly_do`, `tai_lieu_dinh_kem` (JSONB danh sách file), `trang_thai` (`dang_xu_ly`, `da_duyet`, `tu_choi`), `nguoi_tao`, `created_at`, `nguoi_duyet`, `ngay_duyet`, `comment_duyet`.
- Bảng `public.de_nghi_vuot_dinh_muc_flow` (tùy chọn) để lưu các bước phê duyệt: `id`, `de_nghi_id`, `buoc_thu_tu`, `role_duyet`, `trang_thai`, `nguoi_thuc_hien`, `thoi_gian`, `nhan_xet`.

### 4.6 Biên bản kiểm tra định mức
- Bảng `public.kiem_tra_dinh_muc`: `id`, `don_vi_id`, `thoi_gian`, `co_quan_kiem_tra`, `ket_luan_chung`, `hanh_dong_khien_nghi` (JSONB), `tep_dinh_kem`, `created_by`, timestamps.
- Bảng `public.kiem_tra_dinh_muc_chi_tiet`: `id`, `kiem_tra_id`, `nhom_id`, `ket_qua` (`dat`, `khong_dat`, `vuot`), `so_luong_thuc_te`, `ghi_chu`.

### 4.7 View/materialized view hỗ trợ báo cáo
- View `vw_thiet_bi_dinh_muc_cay`: flatten tree kèm cấp độ để render bảng giống tài liệu (cột STT, tên, đơn vị tính, số lượng, ghi chú).
- View `vw_thiet_bi_vs_dinh_muc`: join `thiet_bi`, `thiet_bi_dinh_muc_chi_tiet`, (optionally) `thiet_bi_chuan_loai` để tính số lượng thực tế/hạn mức.
- Materialized view `mv_thiet_bi_dinh_muc_status` (tùy chọn) cho dashboard, refresh qua Supabase cron.

## 5. RPC/API cần phát triển
- `public.equipment_quota_tree(p_don_vi BIGINT)` → trả cấu trúc cây nhóm & chi tiết định mức (dùng view `vw_thiet_bi_dinh_muc_cay`).
- `public.equipment_quota_status(p_don_vi BIGINT, p_khoa_phong TEXT DEFAULT NULL)` → so sánh số lượng thực tế (`thiet_bi`) với định mức, trả `status` (`thieu`, `dat`, `vuot`), `ty_le`, danh sách thiết bị vượt, cho phép lọc theo node/hạng mục.
- `public.equipment_quota_upsert(p_payload JSONB)` → CRUD cho bảng `thiet_bi_dinh_muc_chi_tiet`, ghi lịch sử.
- `public.equipment_quota_group_upsert(p_payload JSONB)` → CRUD cho bảng `thiet_bi_dinh_muc_nhom` (xây/điều chỉnh cây).
- `public.equipment_quota_audit_log(p_don_vi BIGINT)` → trả log kiểm tra & kết luận.
- `public.equipment_quota_exception_request(p_payload JSONB)` và `public.equipment_quota_exception_approve(p_id, p_action, p_comment)`.

Các RPC phải áp dụng mẫu bảo mật hiện có (`_get_jwt_claim`, đảm bảo tenant & role). API proxy Next.js `/api/rpc/equipment-quota/*` ánh xạ tương ứng, dùng React Query hooks để fetch/update.

## 6. Giao diện người dùng (Next.js + Tailwind + Radix)
1. **Dashboard định mức**
   - Widget tổng quan: % đạt định mức theo nhóm chính, số nhóm vượt chuẩn, số đề nghị đang chờ.
   - Biểu đồ thanh so sánh `thuc_te` vs `dinh_muc` theo hạng mục.

2. **Trang chi tiết theo dõi** (`/app/equipment/quotas`)
   - Tree-table hiển thị cấu trúc (I → A → 1 → a) giống tài liệu, cột đơn vị tính, định mức, thực tế, chênh lệch, trạng thái, ghi chú.
   - Bộ lọc: tenant (chỉ global), khoa phòng, nhóm thiết bị, trạng thái.
   - Tooltip hiển thị căn cứ pháp lý (trích lược Thông tư/Nghị định tương ứng).

3. **Trang quản trị định mức & cấu trúc**
   - Tab "Cấu trúc" để thêm/sắp xếp node (drag & drop hoặc form), nhập `ma_stt_hien_thi` để giữ thứ tự I/A/1/a.
   - Tab "Định mức" để CRUD `thiet_bi_dinh_muc_chi_tiet`, upload văn bản phê duyệt, đặt hiệu lực.
   - Chỉ mở cho roles: `global`, `to_qltb` hoặc role do config.

4. **Luồng đề nghị vượt định mức**
   - Modal/wizard: chọn hạng mục (node lá), hiển thị định mức & thực tế hiện tại, nhập số đề nghị, lý do, đính kèm minh chứng.
   - Trang duyệt: danh sách đề nghị (table), chi tiết, nút phê duyệt/từ chối, ghi chú; hiển thị timeline flow nếu nhiều bước.

5. **Trang/Modal kiểm tra định mức**
   - Form ghi biên bản, checklist per hạng mục (đạt/không đạt/vượt), biện pháp xử lý.
   - Cho phép xuất PDF/Excel biên bản từ UI (dùng client export hoặc server render).

6. **Khả năng truy cập & phản hồi**
   - Sử dụng `@tanstack/react-query` cho dữ liệu bất đồng bộ, đảm bảo trạng thái loading/empty/error.
   - Thêm cảnh báo màu (Radix `AlertDialog`, `Badge`); highlight node vượt chuẩn.

## 7. Quy trình nghiệp vụ & tích hợp
- **Cập nhật định mức**: cấp thẩm quyền nhập → hệ thống lưu phiên bản mới, gắn ngày hiệu lực, vô hiệu bản cũ.
- **Theo dõi tự động**: cron job (hoặc hook) refresh view; UI gọi RPC cập nhật sau mỗi biến động `thiet_bi` (create/update/delete).
- **Đề nghị vượt**: khi phát hiện `status = vuot/thieu`: 
  1. Đơn vị tạo đề nghị (`dang_xu_ly`).
  2. Cấp duyệt nhận thông báo (notification/email webhook).
  3. Phê duyệt → cập nhật định mức hoặc tạo nhiệm vụ xử lý.
- **Kiểm tra định kỳ**: lên lịch (cron table) và hiển thị nhắc nhở trong dashboard.

## 8. Báo cáo & xuất khẩu
- Báo cáo PDF/Excel: tổng hợp định mức theo đơn vị, thiết bị, số lần vượt, số đề nghị đang chờ.
- API export tái sử dụng pipeline `reports-export-*` hiện có.
- Tạo preset "Tuân thủ định mức" trong hệ thống báo cáo sử dụng view `vw_thiet_bi_dinh_muc_cay` + `vw_thiet_bi_vs_dinh_muc`.

## 9. Phân quyền & bảo mật
- Roles đề xuất:
  - `global`: xem & chỉnh mọi tenant.
  - `to_qltb` (quản lý thiết bị): chỉnh định mức & cấu trúc trong đơn vị, duyệt đề nghị cấp dưới.
  - `technician`, `user`: chỉ xem dashboard, gửi đề nghị (nếu được ủy quyền).
- RPC kiểm tra `v_role`; chặn sửa/xem trái phép.
- Front-end middleware dựa trên session (NextAuth) ẩn menu với role không hợp lệ.
- Audit log: tận dụng `thiet_bi_dinh_muc_lich_su`, `de_nghi_vuot_dinh_muc_flow`, log Supabase (pg audit nếu cần).

## 10. Kiểm thử & bảo đảm chất lượng
- **Unit test RPC**: pgTAP hoặc script SQL -> test trạng thái `dat/vuot/thieu`, filter tenant, vai trò, node tree.
- **Integration test**: Next.js route handler ↔ Supabase RPC (mock client) cho các case chính.
- **UI test**: Testing Library/Playwright cho tree-table, CRUD, flow duyệt.
- **Data migration validation**: script thống kê mapping loại thiết bị; đánh dấu thiết bị chưa phân loại; import CSV mẫu từ bảng chuẩn.

## 11. Lộ trình triển khai đề xuất
1. **Giai đoạn 0 – Chuẩn bị (1 sprint)**
   - Xác nhận taxonomy loại thiết bị và format dữ liệu đầu vào (dựa trên bảng chuẩn như ảnh).
   - Soạn migration skeleton, kiểm thử tại Supabase dev.
   - Thống nhất vai trò, quy trình duyệt với stakeholder.

2. **Giai đoạn 1 – Backend & dữ liệu (1-2 sprint)**
   - Triển khai migrations `thiet_bi_chuan_loai`, `thiet_bi_dinh_muc_nhom`, `thiet_bi_dinh_muc_chi_tiet`, lịch sử.
   - Seed cây nhóm mẫu (ví dụ Bệnh viện đa khoa) qua script import CSV.
   - Viết RPC `equipment_quota_*`, test sơ bộ.

3. **Giai đoạn 2 – Giao diện & trải nghiệm (1-2 sprint)**
   - Build dashboard & trang tree-table.
   - Tạo form CRUD cấu trúc + định mức, flow đề nghị vượt.
   - Bổ sung thông báo (toast/email stub).

4. **Giai đoạn 3 – Kiểm thử, tài liệu & triển khai (1 sprint)**
   - Viết tài liệu hướng dẫn, cập nhật docs.
   - Hoàn thiện manual test plan, chạy UAT với 1-2 đơn vị pilot.
   - Migrate dữ liệu thực, bàn giao vận hành.

5. **Giai đoạn 4 – Mở rộng & tối ưu (tùy chọn)**
   - Tự động tính định mức theo số giường/công suất.
   - Đồng bộ với hệ thống văn bản điện tử.

## 12. Rủi ro & phương án giảm thiểu
- **Thiếu taxonomy chuẩn** → Workshop với phòng vật tư; cho phép trạng thái "chưa phân loại" kèm cảnh báo.
- **Dữ liệu định mức không đầy đủ** → Hỗ trợ import CSV, cung cấp template theo cấu trúc bảng chuẩn.
- **Thay đổi quy định pháp lý** → Lưu metadata mở rộng (JSONB) để điều chỉnh nhanh.
- **Hiệu năng** → Chỉ mục theo `don_vi`, `nhom_id`; materialized view, cache React Query.
- **Chậm phê duyệt** → Nhắc nhở qua thông báo, badge màu trong dashboard.

## 13. Tài liệu & đào tạo
- Cập nhật `docs/` với hướng dẫn nhập định mức, quy trình vượt chuẩn, checklist tự kiểm tra.
- Chuẩn bị video/slide đào tạo cho quản trị đơn vị.
- Cung cấp template biên bản kiểm tra tải từ hệ thống.

## 14. Phụ lục tham chiếu
- Luật 15/2017/QH14 về quản lý, sử dụng tài sản công.
- Nghị định 151/2017/NĐ-CP, Nghị định 69/2021/NĐ-CP (nếu áp dụng).
- Thông tư 08/2019/TT-BYT – tiêu chuẩn, định mức trang thiết bị y tế.
- Hướng dẫn nội bộ multi-tenant (`docs/multi-tenant-plan.md`).
- Bảng định mức mẫu của Bệnh viện đa khoa (ảnh tham chiếu) – dùng làm template import.

## 15. Công việc tiếp theo ngay lập tức
1. Chốt danh sách nhóm thiết bị ưu tiên và mẫu dữ liệu định mức ban đầu với stakeholder.
2. Lập migration draft để kiểm chứng trên môi trường dev Supabase.
3. Thiết kế wireframe dashboard & tree-table quản trị định mức để review UX.
