# Phase 4.5 - Evidence triển khai

## Phạm vi

Chỉ backend/RPC/API và migration forward-only. Không UI Phase 5, không Go,
không live apply, không thay controls mặc định false. Không sửa migration đã apply.

- Candidate RPC giới hạn 1–100, tìm kiếm literal và phân trang theo ID.
- Config GET trả đầy đủ metadata, gồm stale và protected entries.
- RPC `web_push_recipient_config_set_with_self_action` xử lý mutation mới;
  wrapper `web_push_recipient_config_set(bigint,text[])` chỉ gọi với `none`.
  Dùng tên riêng để không tạo overload cho PostgREST; browser wire vẫn v1.
- Normal recipients chỉ `to_qltb` cùng đơn vị hiệu lực; admin/global tự thêm/gỡ
  chính mình qua self-action. Lưu danh sách bảo toàn protected entries của người khác.
- Enqueue và mỗi claim/retry kiểm tra eligibility mới bên cạnh quyền đọc cũ.
  Khối ZBS không thay đổi; migration claim chỉ thay điều kiện recipient.

## Kiểm chứng đã thực hiện

- Focused Web Push TS: 35 PASS, 1 integration test Phase 4 SKIP vì chưa bật fixture.
- Typecheck, no-explicit-any, diff-only dedupe PASS; React Doctor diff 100/100.
- `supabase/tests/web_push_phase45.sql` chạy trực tiếp trên disposable clone
  `dq_webpush_phase45_dev` của Oracle `qltbyt_test`: hai nhóm assertion PASS,
  transaction kết thúc ROLLBACK. Đã kiểm tra candidate scope, ownership, stale
  metadata, atomic save, fan-out A-only, enqueue/claim/retry và ZBS coexistence.
- Test được đăng ký migration-specific cho cả ba migration Phase 4.5.

## Phân loại lỗi trong quá trình kiểm chứng

Lần thử apply trực tiếp đầu tiên thiếu lifecycle cấp `public CREATE` tạm cho
`postgres`; đây là lỗi cách chạy của agent, không phải drift baseline hay lỗi
migration. Đã chạy lại theo lifecycle của harness trên clone: cấp tạm bởi
`supabase_admin`, apply bằng `postgres`, thu hồi và xác minh CREATE=false.
Ba migration candidate apply thành công. Không thay quyền trên restored baseline.

Fixture retry ban đầu đặt lease hết hạn trước `leased_at`, vi phạm CHECK.
Đã sửa đồng thời hai timestamp để mô phỏng lease hết hạn hợp lệ; runtime không
được nới constraint để chiều test.

## Trạng thái Quality Gate

Static checkpoint `9513ccab`: INCOMPLETE, digest
`fc710729c00100c1bc36711928fddc48ea885bf43c88f748885329ea04e9b945`, report
`/root/Oracle/web-push-phase45-evidence/9513ccab-static.json`.
Report này có trước sửa overload và registry; không dùng làm chứng nhận cuối.

Các finding `jwt-guards` cần đối chiếu helper chain và service-role grants;
không thêm guard giả hoặc exemption để làm xanh. `GRANT/DELETE` phải được review
theo authorization và transaction thực tế. SQL PASS chạy tay không thay thế
baseline-forward. Aggregate vẫn BLOCKING / INCOMPLETE cho tới khi hai lane PASS
trên cùng exact commit với report/digest đọc được.

Historical tasks 2.4/3.4/4.5 và #1000 giữ nguyên. Chưa tick 4.5.6, chưa live review.
