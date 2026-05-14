# Đánh giá điểm nghẽn hiệu năng & lộ trình rollout VM Oracle

**Ngày đo:** 2026-05-14  
**Phạm vi:** Next.js app trên Vercel Free + Supabase Cloud Free (project `cdthersvldpnlbvpufrr`)  
**Mục tiêu:** Xác định nghẽn hiệu năng thực tế và đề xuất thứ tự rollout tận dụng VM Oracle (4 vCPU, 24 GB RAM) với rủi ro thấp.

---

## 1) Safety & phương pháp đo

Các đo đạc DB được thực hiện **read-only**, không có thao tác ghi/xóa/sửa dữ liệu:

- `SELECT` trên `extensions.pg_stat_statements`, `pg_stat_user_tables`, `pg_stat_database`, `pg_stat_activity`
- `list_tables`, `list_extensions`, `get_advisors(performance)`
- Không chạy `INSERT/UPDATE/DELETE/ALTER/DROP`, không apply migration.

---

## 2) Bức tranh hiện trạng (số liệu chính)

## 2.1 App/kiến trúc runtime

- App Router Next.js 15, API routes chạy Node runtime cho nhiều endpoint chính.
- Luồng DB chuẩn qua RPC proxy: `callRpc -> /api/rpc/[fn] -> Supabase PostgREST`.
- Có 2 API route trung gian cho transfer (`/api/transfers/list`, `/api/transfers/counts`) gọi vòng vào `/api/rpc/*` (thêm 1 hop HTTP nội bộ).
- `QueryProvider` có default khá "chatty":
  - `refetchOnWindowFocus: true`
  - `refetchOnReconnect: true`
  - `refetchInterval: 10 phút` (global default)
- `RealtimeProvider` subscribe nhiều bảng và invalidate/refetch nhiều query key khi có event.

## 2.2 DB footprint & tài nguyên

- DB size: **~30 MB**
- Số bản ghi còn nhỏ:
  - `thiet_bi`: 3169
  - `yeu_cau_sua_chua`: 29
  - `yeu_cau_luan_chuyen`: 7
  - `nhat_ky_su_dung`: 1
- Kết nối:
  - `max_connections`: 60
  - `total_connections`: 16
  - `active_connections`: 5
- Buffer cache hit: **~100%**
- Deadlock: **0**

## 2.3 Tải query (cumulative)

Phân loại từ `pg_stat_statements`:

- `realtime/internal`:  
  - calls: **27,895,116**
  - total_exec_time: **165,299,282.64 ms**
  - mean: 5.93 ms
- `postgrest/rpc`:  
  - calls: **205,490**
  - total_exec_time: **1,883,217.53 ms**
  - mean: 9.16 ms

=> Tải tích lũy chủ yếu đến từ **realtime/internal** (WAL/change stream), không phải business RPC nặng.

## 2.4 Top RPC theo tổng thời gian

- `authenticate_user_dual_mode`: 2290 calls, mean 282.47 ms, total 646,846.19 ms
- `equipment_list_enhanced`: 9188 calls, mean 17.77 ms, total 163,259.19 ms
- `header_notifications_summary`: 9479 calls, mean 11.89 ms, total 112,752.45 ms
- `usage_log_list`: 6172 calls, mean 14.69 ms, total 90,687.36 ms
- `dashboard_kpi_summary`: 582 calls, mean 61.86 ms, total 36,002.21 ms

Nhận xét:

- Business RPC cốt lõi (equipment/usage/repair/dashboard) đang ở mức mean hợp lý cho workload hiện tại.
- Điểm "đắt" nhất theo mean là auth/login path (`authenticate_user_dual_mode`), không phải query list chính.

## 2.5 Advisor performance

- 51 cảnh báo, **đều ở mức INFO** (không có WARN/ERROR):
  - nhiều `unused_index`
  - một số `unindexed_foreign_keys`
- Đây là tín hiệu tối ưu dần, chưa phải blocker rollout.

---

## 3) Điểm nghẽn hiệu năng có khả năng cao nhất

Thứ tự ưu tiên nghẽn (cao -> thấp):

1. **Realtime fan-out + invalidation/refetch rộng ở client**
2. **Refetch mặc định tương đối aggressive** (`focus`, `reconnect`, interval global)
3. **Hop API nội bộ dư thừa** ở transfer routes (`/api/transfers/*` -> `/api/rpc/*`)
4. **Chi phí login/auth RPC** (quan trọng về UX đăng nhập, nhưng không phải nghẽn throughput toàn hệ thống)
5. **DB compute/storage** (hiện chưa phải nghẽn chính theo số liệu)

---

## 4) Khuyến nghị rollout: migrate cái gì trước?

## Kết luận chính

**Nên migrate app sang Coolify trước, giữ Supabase Cloud trước mắt.**  
**Chưa nên self-host Supabase ngay ở phase đầu.**

Lý do:

- DB hiện nhỏ, cache hit rất cao, connection còn dư.
- Tải lớn tích lũy đang nằm ở realtime/internal pattern và hành vi refetch của app.
- Self-host Supabase sớm sẽ tăng rủi ro vận hành (backup, failover, patching, observability) nhưng chưa chắc cải thiện đáng kể latency tổng thể.

---

## 5) Lộ trình rollout đề xuất (rủi ro thấp)

1. **Phase A - Tối ưu hành vi app trước (không đổi hạ tầng DB)**
   - Giảm phạm vi invalidate/refetch từ realtime.
   - Rà soát query nào thực sự cần `refetchOnWindowFocus/reconnect`.
   - Cân nhắc bỏ hop nội bộ tại transfer routes.
   - Đặt baseline metric p50/p95 cho login, dashboard, equipment list, transfer list.

2. **Phase B - Deploy app lên Coolify trên VM Oracle (giữ Supabase Cloud)**
   - Chạy canary/smoke thật với traffic thực.
   - So sánh p50/p95 với baseline Vercel.
   - Chỉ chuyển full traffic khi ổn định.

3. **Phase C - Đánh giá lại sau khi app đã ổn**
   - Nếu DB mới là bottleneck thực sự (connection saturation, CPU/IO pressure, query latency tăng), mới mở phương án self-host Supabase từng phần.
   - Nếu chưa có bottleneck DB rõ ràng, tiếp tục dùng Supabase Cloud để giảm ops burden.

---

## 6) Rủi ro nếu self-host Supabase quá sớm

- Tăng gánh nặng vận hành: backup/restore drill, monitoring, upgrade, incident response.
- Single VM trở thành điểm tập trung rủi ro (app + DB cùng máy).
- Mất một số lợi thế managed platform nếu chưa có năng lực SRE tương ứng.

---

## 7) Checklist đánh giá lại trước rollout thật

- So sánh p50/p95 các luồng:
  - Login
  - Dashboard KPI
  - Equipment list + filter
  - Transfer list/counts
- Theo dõi:
  - request rate
  - error rate
  - DB active connections
  - RPC mean/total time cho top functions
  - realtime queue/churn
- Chạy kiểm thử ở giờ cao điểm (hoặc synthetic load gần thực tế).

---

## 8) Ghi chú quan trọng (bắt buộc)

**Toàn bộ số liệu trong tài liệu này chỉ mang tính tham khảo tại thời điểm đo (snapshot).**  
Khi rollout thực tế, **bắt buộc đo lại trên môi trường thực và lưu lượng thực** trước khi chốt quyết định hạ tầng cuối cùng.

