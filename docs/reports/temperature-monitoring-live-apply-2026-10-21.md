# Temperature Monitoring — live migration apply, 2026-10-21

**Kết quả: APPLIED 19/19; exact SQL read-back PASS 19/19.** Project `cdthersvldpnlbvpufrr`, source commit `08fd658ad29f7a9bc6e4aede33f41e75d9621438`. Owner yêu cầu apply lần lượt các migration pending và cho phép bypass DB Gate trong lần này. Formal `static` / `baseline-forward` vẫn **INCOMPLETE**, không đổi thành PASS; TM-10 chưa hoàn tất UAT.

## Phạm vi và bằng chứng

- Live trước apply có 375 migration, chưa có migration Temperature Monitoring; helper `ai_readonly.try_parse_iso_date(text)` đã tồn tại.
- Áp dụng nguyên nội dung 19 file local qua Supabase MCP `apply_migration`, từng file một theo timestamp/phụ thuộc; không dùng Supabase CLI.
- MCP sinh version live mới. Bảng dưới và [evidence JSON](temperature-monitoring-live-apply-2026-10-21.json) ánh xạ source path/name/SHA-256 với version live; không đổi tên hoặc sửa các file SQL đã apply.
- Đọc lại `statements[]` qua read-only MCP: 19 bản đều đúng một statement payload, SQL bytes bằng source local, SHA-256 bằng nhau và thứ tự tên migration đúng.
- 19 normalized read-back record có digest đã được persist bằng harness hiện có tại `oracle:tm-live-20261021-091542-{01..19}/read-back.json`. Raw observations lưu read-only tại `oracle:tm-live-20261021-091542-raw/observations/{01..19}.json`; đã kiểm tra raw observation digest khớp từng normalized record. Đây là read-back verification, không phải certification của DB Gate.

| Local migration                                                       | Live version     |
| --------------------------------------------------------------------- | ---------------- |
| `20261017100000_temperature_monitoring_configuration.sql`             | `20261021091142` |
| `20261017110000_temperature_monitoring_schedules_slots.sql`           | `20261021091149` |
| `20261017120000_temperature_monitoring_measurements.sql`              | `20261021091150` |
| `20261017120100_temperature_monitoring_recorded_slots.sql`            | `20261021091151` |
| `20261018030000_temperature_monitoring_review_state.sql`              | `20261021091227` |
| `20261018030100_temperature_monitoring_review_actions.sql`            | `20261021091237` |
| `20261018030200_temperature_monitoring_review_projection.sql`         | `20261021091239` |
| `20261018040000_temperature_monitoring_deviation_state.sql`           | `20261021091241` |
| `20261018040100_temperature_monitoring_deviation_actions.sql`         | `20261021091243` |
| `20261018040200_temperature_monitoring_deviation_queries.sql`         | `20261021091245` |
| `20261018040300_temperature_monitoring_user_recording.sql`            | `20261021091255` |
| `20261018050000_temperature_monitoring_slot_source.sql`               | `20261021091256` |
| `20261018050100_temperature_monitoring_workspace.sql`                 | `20261021091258` |
| `20261018050200_temperature_monitoring_choices.sql`                   | `20261021091300` |
| `20261018050300_temperature_monitoring_capture_time.sql`              | `20261021091302` |
| `20261018050400_temperature_monitoring_equipment_projection.sql`      | `20261021091310` |
| `20261018050500_temperature_monitoring_notifications.sql`             | `20261021091311` |
| `20261018060000_temperature_monitoring_configuration_replacement.sql` | `20261021091313` |
| `20261019090000_temperature_monitoring_export.sql`                    | `20261021091315` |

## Sự cố và xử lý

Migration thứ 5 (`review_state`) lần đầu bị MCP từ chối do version timestamp sinh trong cùng giây trùng `20261021091151` của `recorded_slots` (`23505`). Đã dừng chuỗi, kiểm tra migration row và các object review-state chưa tồn tại, xác nhận rollback rồi retry nguyên SQL ở timestamp mới. Thành công; các lần sau cách nhau ít nhất 1,2 giây. Không sửa/xóa metadata lịch sử.

## Kiểm tra sau apply và advisor

- Có 13 bảng Temperature Monitoring và 24 function mang tiền tố public RPC (số đếm bao gồm trigger function). Không cấp bất kỳ quyền bảng trực tiếp nào trong SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER cho `anon` hoặc `authenticated`.
- `anon` không EXECUTE được RPC nghiệp vụ; authenticated không EXECUTE được private helper. Hai function anon còn EXECUTE là trigger-returning, SECURITY INVOKER, body chỉ raise lỗi append-only; chưa revoke trong scope này.
- Tất cả Temperature SECURITY DEFINER có search_path được cấu hình. Năm bảng RLS đã bật không có policy; tám bảng còn lại RLS chưa bật nhưng không có quyền bảng trực tiếp cho hai client role. Đây là kiểm tra catalog, không thay thế RBAC UAT.
- Security advisor: 5 INFO `rls_enabled_no_policy`, 19 WARN `authenticated_security_definer_function_executable`, 2 WARN `function_search_path_mutable` ở hai trigger audit. [RLS guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [RPC review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [search_path remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- Performance advisor: 18 INFO [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), 11 INFO [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Không tự thêm/drop index hoặc remediation ngoài 19 migration được duyệt.
- Tại thời điểm đọc lại: configurations/readings/deviations đều 0. Không tạo fixture, tài khoản hoặc số đo thử trên live.

## Giới hạn bàn giao

Chỉ thực hiện DB migration và đọc lại catalog/advisor. Không deploy app, không test ghi dữ liệu qua browser live, không refresh/catch-up baseline Oracle và không sửa applied-history lock/reconciliation trong lần này. Cần dùng read-back evidence đã lưu cho bước reconciliation/baseline riêng; không tái apply các file đã thành công. Giữ nguyên các yêu cầu còn thiếu của [TM-10 plan](../plans/2026-10-19-temperature-monitoring-tm10-plan.md). Không push.
