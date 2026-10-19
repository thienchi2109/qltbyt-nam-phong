# TM-10 — staging và browser smoke, 2026-10-19

**Kết quả:** staging riêng đã hoạt động; authenticated smoke **PASS** trong phạm vi dưới đây. Full TM-10 UAT và formal DB certification vẫn **INCOMPLETE**.

## Đóng staging theo yêu cầu owner — 2026-10-19

Kiểm thử đã dừng. Đã xóa đúng DB clone `tm10_staging_20261019_a834aafee` (bao gồm fixture và reading), hai container `tm10-staging-api` / `tm10-staging-rest`, transient user service `qltbyt-tm10-staging.service` và thư mục `/home/ubuntu/qltbyt-tm10-staging-20261019` chứa source/build/private env. App/API không còn listener trên Oracle ở 3100/18110; tunnel riêng trên Codex VPS đã dừng. Các URL và hướng dẫn restart bên dưới chỉ mô tả lần chạy đã kết thúc; lần sau cần dựng lại theo runbook.

Đối chiếu trước/sau **PASS**: 19 container khác giữ nguyên ID/image ID/StartedAt/restart count/status/health; 30 Docker image giữ nguyên ID/tag/digest và metadata (loại trường đếm số container tham chiếu vì hai container staging đã bị xóa). Không prune, build/pull/tag hay remove image; network/volume và trạng thái/thời điểm khởi động các service đang chạy khác không đổi. Danh sách DB ngoài clone không đổi; baseline `qltbyt_test` giữ nguyên counts và digest account rows. Đây là bằng chứng trạng thái vận hành, không thay thế kiểm thử chức năng từng ứng dụng khác.

Bằng chứng đã sao lưu về [thư mục evidence](temperature-monitoring-tm10-staging-evidence-2026-10-19/), gồm setup/readiness/browser smoke, SQL fixture lịch sử và [kết quả cleanup](temperature-monitoring-tm10-staging-evidence-2026-10-19/cleanup.json). Không lưu secret hoặc credential trong repo. Dữ liệu kết quả browser bên dưới là bằng chứng lịch sử trước cleanup, không phải trạng thái service hiện tại.

**TM-10 vẫn INCOMPLETE:** chưa nghiệm thu duyệt độc lập/amendment/deviation, RBAC/multitenant bằng tài khoản đối chứng, races, tải và failure/cancellation. Formal `static` và `baseline-forward` chưa có PASS gắn cùng exact landed commit; smoke trên disposable clone không thay thế hai gate này.

## Identity và phạm vi

- App từ exact commit `834aafee8059c7142a629a01d5f24b6992ecf71c`, `git archive` vào `/home/ubuntu/qltbyt-tm10-staging-20261019/source` trên Oracle.
- DB disposable `tm10_staging_20261019_a834aafee`, clone từ `qltbyt_test`; giữ dữ liệu, tài khoản và mật khẩu theo yêu cầu owner. Không tạo/reset tài khoản.
- Chỉ clone nhận 19 migration Temperature Monitoring và compatibility helper đã dùng trong bằng chứng TM-09. Không áp candidate vào baseline hay live. Đây là **DISPOSABLE ONLY**, không phải formal baseline-forward.
- App/API bind `127.0.0.1:3100` / `127.0.0.1:18110`; dùng SSH tunnel và `NEXTAUTH_URL=http://localhost:3100`. JWT/API keys riêng cho staging; auth secret do owner cung cấp, không ghi vào repo.
- Không Docker build/pull/tag, không đổi image hay restart container cũ. Thêm riêng `tm10-staging-rest`, `tm10-staging-api` và user service `qltbyt-tm10-staging`.
- Build native Node 24 đã PASS. Giới hạn 1 CPU/6 GiB/nice 19 được áp dụng giữa lần build đầu; runbook yêu cầu áp trước các lần sau. App giới hạn 1 CPU/2 GiB/nice 10; mỗi container mới 1 CPU/512 MiB. Tài nguyên VM vẫn được chia sẻ.

## Kiểm tra đã thực hiện

| Check                        | Kết quả / giới hạn                                                                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact candidate API target   | RPC identity tạm chỉ service-role trả đúng tên clone; đã drop sau kiểm tra. REST expose schema `public`; baseline snapshot không có `graphql_public`.                                                                                                                 |
| Bảo toàn baseline và account | Baseline counts trước/sau khớp; digest toàn bộ account rows clone khớp baseline trước login. Không công bố row, password hash hay token.                                                                                                                              |
| Build và HTTP                | Build PASS; login page, credentials provider, CSRF HTTP 200; route protected chuyển người chưa đăng nhập về đúng localhost origin. Next build bỏ qua type/lint theo config hiện có, không thay thế các gate riêng.                                                    |
| Browser thật                 | Installed `agent-browser` với Chrome, session riêng `tm10-staging` trên Codex VPS; không dùng/chỉnh container browser đang chạy trên Oracle. Đăng nhập bằng thông tin owner cung cấp thành công, session có role `to_qltb`.                                           |
| Điều hướng                   | Dashboard vào được; danh mục Equipment tải được; Sổ nhiệt độ mở được, chuyển Ghi theo ca/Lịch sử, lịch sử mặc định 30 ngày. Dashboard có RPC gaps ở phần dưới.                                                                                                        |
| Trạng thái rỗng ban đầu      | Sổ báo chưa có thiết bị bật theo dõi trong phạm vi được phép; sau đó đã thêm fixture và ghi thành công như phần dưới.                                                                                                                                                 |
| Mobile                       | Viewport 375 × 812: main hiển thị, không tràn ngang; đây là viewport emulation, chưa phải kiểm thử thiết bị cảm ứng thật hay audit accessibility đầy đủ.                                                                                                              |
| Xuất rỗng qua UI             | Request export HTTP 200 khoảng 171 ms; UI báo tải thành công. CLI download-event capture timeout, không dùng nó làm bằng chứng lưu file.                                                                                                                              |
| Binary XLSX                  | Authenticated fetch trong browser nhận HTTP 200, XLSX MIME/ZIP header, 9.239 byte. Bytes được lưu private và mở lại bằng ExcelJS: 6 sheet, đủ 5 sheet dữ liệu đã định nghĩa, `Readings` có 0 dòng. Không chứng minh nội dung nonempty, pagination hay audit fidelity. |

Không đưa thông tin đăng nhập, session/cookie, nội dung workbook hoặc dữ liệu clone vào artifact công khai. Các log/config/binary thô nằm private.

## Bật theo dõi và ghi số đo thực tế trên staging

- Thiết bị cũ đầu tiên trong danh mục bị RPC cấu hình từ chối HTTP 403 vì khác khoa/phòng; đây là guard được thực thi. Tài khoản hiện tại không có thiết bị nào trong khoa/phòng của mình. Không đổi quyền hoặc thông tin tài khoản để vượt guard.
- Tạo fixture `TM10-STAGING-20261019`, ID `9679`, tên `Tủ lạnh mẫu TM10 (staging)`, qua authenticated BFF `equipment_create`. Việc thêm fixture dùng API trong browser session; không tuyên bố đã nghiệm thu form thêm thiết bị.
- Mở Equipment detail → Cấu hình & Phụ kiện; qua UI bật theo dõi, chọn ngưỡng 2–8°C và người phụ trách là actor hiện tại, lưu policy thành công.
- **Giới hạn có hiệu lực:** bật lần đầu qua UI chỉ có hiệu lực từ `2026-10-20 00:00+07`. Để kiểm thử ngay, bổ sung một policy lịch sử giả lập chỉ cho fixture mới trong clone; giữ nguyên policy tương lai do UI tạo, không sửa thời gian máy chủ/source/quyền. Fixture DML có guard tên DB/equipment/state và audit reason, lưu tại Oracle `evidence/current-policy-fixture.sql`. Vì vậy kết quả không chứng minh cấu hình mới có hiệu lực ngay trong ngày.
- Qua UI Sổ nhiệt độ ca Tối `18:00–22:00`, nhập **5,2°C** và bấm **Lưu số đo**: UI báo **Đã lưu**, DB có đúng một reading `941c3665-0103-4d18-a025-60462d39752d`, ngày `2026-10-19`, snapshot ngưỡng `2,0–8,0°C`. Không chèn số đo trực tiếp bằng SQL.
- Lịch sử hiển thị **5.2°C / Đã ghi**; biểu đồ có điểm truy cập được với tên **2026-10-19; Tối; 5.2°C; trong giới hạn**. UI chặn tự duyệt số đo của mình. Chưa dùng tài khoản thứ hai để nghiệm thu duyệt độc lập.
- Export của fixture/ngày đo qua authenticated browser trả HTTP 200, **11.129 byte**. Mở bytes thật bằng ExcelJS xác nhận 6 sheet, đúng **1 reading**, ID/value `5.2`/snapshots `2` và `8` khớp DB, **1 reading event**. Không có bằng chứng amendment/deviation hoặc pagination/tải lớn từ một reading.
- URL đã dùng trước cleanup: `http://localhost:3100/temperature-monitoring?equipment=9679`. Fixture/reading đã bị xóa cùng clone theo yêu cầu owner; URL không còn hoạt động.

## Gaps và release blockers

1. Cấu hình qua UI, ghi số đo, lịch sử/điểm biểu đồ và export một reading đã PASS với fixture lịch sử nêu rõ ở trên. Duyệt độc lập/amendment/deviation, multitenant/RBAC bằng tài khoản đối chứng, races, tải lớn và failure/cancellation paths trên staging vẫn chưa nghiệm thu.
2. Dashboard gặp PostgREST schema-cache signature mismatch với `public.usage_log_list(p_active_only, p_don_vi, p_equipment_dataset, p_limit)` và `public.equipment_department_distribution(p_don_vi, p_equipment_dataset, p_khoa_phong_array, p_nguoi_su_dung_array, p_nguon_kinh_phi_array, p_phan_loai_array, p_q, p_tinh_trang_array, p_vi_tri_lap_dat_array)`. Cần khảo sát compatibility source/snapshot riêng; chưa xác định migration sửa và chưa sửa baseline.
3. Formal `static` và `baseline-forward` vẫn **INCOMPLETE**. Disposable staging không đóng certification debt. Chưa có approval live apply, production deploy hoặc push.

## Vận hành và evidence

- [Runbook dựng/vận hành staging](../runbooks/temperature-monitoring-staging.md): tunnel, restart/stop, source mới, resource caps và cleanup riêng.
- [Plan TM-10](../plans/2026-10-19-temperature-monitoring-tm10-plan.md): coverage và các điều kiện release còn lại.
- Bản sanitized của `setup.json`, `readiness.json`, `browser-smoke.json` đã được sao lưu vào thư mục evidence trong repo trước khi xóa root Oracle. Private env/build log và các runner tạm đã được xóa; không thể restart instance cũ.
- Docs-only checkpoint, không đổi source runtime trong repo. Owner cho phép commit vào local `main`, không push và không apply live DB. Staging đã được tháo dỡ; lần sau cần dựng lại theo runbook.
