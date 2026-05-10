# Repair Completion Time Visualization Plan

## Bối cảnh

Trang **Reports → tab "Bảo trì / Sửa chữa"** hiện có card "Lịch sử sửa chữa gần đây" (component `MaintenanceReportRepairTables`, card thứ 2). Card này trùng chức năng với trang **Repair Requests**, nơi đã có lịch sử đầy đủ và bộ lọc mạnh hơn.

Mục tiêu: **xóa card "Lịch sử sửa chữa gần đây"** và thay bằng visualization mới giúp trả lời câu hỏi "**Yêu cầu sửa chữa thường mất bao lâu để hoàn thành?**" (tính từ `ngay_yeu_cau` đến `ngay_hoan_thanh`).

## Quyết định thiết kế

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Visualization | **2 card**: KPI + Histogram (combo D) **và** Trend line p50/p90/avg theo tháng (option B) | KPI cho cái nhìn nhanh, histogram cho phân phối, trend line cho phát hiện regression theo thời gian |
| Đơn vị thời gian | **Tự động**: <24h hiển thị giờ, ≥24h hiển thị ngày | Phù hợp cả ca sửa nhanh trong ngày và ca dài hạn |
| Backend | **Migration mới qua Supabase MCP** + **bỏ field `recentRepairHistory`** khỏi RPC | Gọn payload, đảm bảo tính chính xác (data hiện tại bị `LIMIT 20`) |
| Ngưỡng thời gian mục tiêu | **14 ngày** | Cân bằng cho đa số thiết bị y tế |
| Việt hóa thuật ngữ thống kê | Không dùng "SLA", "p50", "p90" trên UI | Người dùng cuối là cán bộ BV, cần ngôn ngữ thường |

### Bảng Việt hóa thuật ngữ

| Thuật ngữ kỹ thuật | Hiển thị trên UI | Ghi chú |
|---|---|---|
| median / p50 | **Trung vị** hoặc **Thời gian giữa** | Tooltip: "Một nửa số yêu cầu xong trước thời gian này" |
| p90 | **90% hoàn thành trong** | Tooltip: "9/10 yêu cầu xong nhanh hơn mức này" |
| average | **Trung bình** | |
| SLA / SLA target | **Ngưỡng thời gian mục tiêu** hoặc **Đúng hạn (≤14 ngày)** | |
| % within SLA | **Tỉ lệ đúng hạn** | |
| over SLA | **Chậm** / **Trễ hạn** | Bucket >14 ngày tô cam, >30 ngày tô đỏ |

## Thiết kế chi tiết

### Card 1 — "Thời gian hoàn thành yêu cầu sửa chữa"

**KPI strip (3 stat ngang trên cùng):**
- **Thời gian giữa (trung vị)** — ví dụ "4 ngày"
- **Thời gian trung bình** — ví dụ "7,2 ngày"
- **Tỉ lệ đúng hạn (≤14 ngày)** — ví dụ "72%" với progress bar

**Histogram bên dưới** (`DynamicBarChart`):
- Buckets cố định: `0–1 ngày`, `1–3 ngày`, `3–7 ngày`, `7–14 ngày`, `14–30 ngày`, `>30 ngày`
- Trục Y: số yêu cầu trong bucket
- Bucket `14–30 ngày` tô màu cam cảnh báo, bucket `>30 ngày` tô đỏ
- Tooltip: "<bucket>: N yêu cầu (%X tổng)"

### Card 2 — "Xu hướng thời gian hoàn thành theo tháng"

**Line chart 3 đường** (`DynamicLineChart`):
- **Trung vị** — line màu chính
- **90% hoàn thành trong** — line màu phụ (cảnh báo)
- **Trung bình** — line nét đứt

Trục X: tháng (đồng bộ format với `repairFrequencyByMonth` đã có).
Tháng có <3 yêu cầu hoàn thành sẽ render điểm rỗng (gap) để tránh nhiễu.

### Empty state

- Không có yêu cầu nào hoàn thành trong khoảng thời gian: hiển thị icon `Inbox` + dòng "Chưa có yêu cầu hoàn thành trong khoảng thời gian đã chọn." (cùng pattern như `maintenance-report-repair-charts.tsx`)

## Triển khai

### Backend (migration mới qua Supabase MCP)

File: `supabase/migrations/<timestamp>_add_repair_completion_time_charts.sql`

#### Tuân thủ tenant isolation & security model

Migration là `CREATE OR REPLACE FUNCTION public.get_maintenance_report_data(p_date_from date, p_date_to date, p_don_vi bigint DEFAULT NULL)` — **giữ nguyên tên & signature** với migration trước (`20260413152000_add_repair_cost_usage_visualizations.sql`). Vì vậy thừa hưởng nguyên si security model:

| # | Pattern bắt buộc | Áp dụng cho migration mới |
|---|---|---|
| 1 | `LANGUAGE plpgsql SECURITY DEFINER` | Giữ nguyên |
| 2 | `SET search_path = public, pg_temp` | Giữ nguyên |
| 3 | JWT claim qua `public._get_jwt_claim('app_role')` & `_get_jwt_claim('user_id')`; raise `42501` nếu thiếu | Giữ nguyên block khởi tạo |
| 4 | `v_is_global := v_role IN ('global', 'admin')` (khớp `isGlobalRole()` frontend) | Giữ nguyên |
| 5 | Non-global: `public.allowed_don_vi_for_session_safe()`; raise `42501` nếu `p_don_vi` không thuộc allow-list; allow-list rỗng ⇒ trả empty payload không raise | Giữ nguyên block scope; **cập nhật default empty payload**: bỏ `recentRepairHistory`, thêm 2 key mới với struct rỗng đúng schema |
| 6 | Equipment scope: `WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))` | Giữ nguyên CTE `scoped_equipment` & `repair_data` (filter qua `INNER JOIN scoped_equipment`) |
| 7 | `GRANT EXECUTE TO anon, authenticated, service_role` + `REVOKE FROM PUBLIC` | Re-issue (signature không đổi nhưng giữ convention) |
| 8 | `COMMENT ON FUNCTION ...` | Cập nhật mô tả: thay `recent history` bằng `repair completion time distribution and monthly trend` |
| 9 | Wrap `BEGIN; ... COMMIT;` | Giữ nguyên |
| 10 | JSONB output **camelCase** (smoke test enforce) | 2 key mới cũng camelCase: `repairCompletionTime`, `repairCompletionTimeByMonth`, sub-keys: `medianMinutes`, `p90Minutes`, `averageMinutes`, `onTimePercent`, `bucketKey`, `isOverThreshold` |
| 11 | KHÔNG cần đổi tên RPC ⇒ KHÔNG đụng `src/app/api/rpc/[fn]/allowed-functions.ts` (đã có sẵn `get_maintenance_report_data`) | — |
| 12 | KHÔNG thêm RLS policy: RPC `SECURITY DEFINER` không truy vấn trực tiếp từ client; scoping nằm trong function | — |

#### Smoke test bắt buộc

File: `supabase/tests/repair_completion_time_smoke.sql` — theo cùng pattern với <ref_file file="/root/qltbyt-nam-phong/supabase/tests/repair_cost_usage_visualizations_smoke.sql" />:

- Wrap trong `BEGIN; ... ROLLBACK;` (non-destructive).
- Helper `pg_temp._rct_set_claims(role, user_id, don_vi)` set `request.jwt.claims`.
- Seed 2 tenant (`v_tenant`, `v_other_tenant`); user role `to_qltb` thuộc `v_tenant`.
- Seed yeu_cau_sua_chua trong cả 2 tenant với các durations đa dạng (cover các bucket: 0-1d, 1-3d, 3-7d, 7-14d, 14-30d, >30d) và mix `Hoàn thành` / chưa hoàn thành.
- Assertions:
  - `repairCompletionTime.stats.totalCompleted` chỉ đếm rows có `ngay_hoan_thanh IS NOT NULL` AND `is_completed = true`
  - `distribution` đủ 6 buckets, count đúng, `isOverThreshold = true` cho 2 bucket cuối
  - `medianMinutes`, `p90Minutes`, `averageMinutes` khớp với data seed
  - `onTimePercent` tính đúng với threshold 14 ngày
  - `repairCompletionTimeByMonth` group đúng theo month, ignore tháng có `completedCount < 3` (gap)
  - **Cross-tenant**: với role `to_qltb`, không có dữ liệu của `v_other_tenant` lọt vào payload (giống line 437-439 ở smoke test cũ)
  - **Admin/global + p_don_vi**: payload bị scope theo `p_don_vi` (giống line 441-452 ở smoke test cũ)
  - **camelCase enforce**: không có key snake_case lọt vào (regex `~ '_'` check)
  - **Backward-compat keys still present**: `summary`, `charts.repairStatusDistribution`, `charts.maintenancePlanVsActual`, `charts.repairFrequencyByMonth`, `charts.repairCostByMonth`, `charts.repairCostByFacility`, `charts.repairUsageCostCorrelation`, `topEquipmentRepairs`, `topEquipmentRepairCosts` → **KHÔNG còn** `recentRepairHistory`

#### Nội dung migration

Mở rộng RPC `get_maintenance_report`:

1. Thêm key `charts.repairCompletionTime`:
   ```jsonc
   {
     "stats": {
       "totalCompleted": 42,
       "medianMinutes": 5760,
       "averageMinutes": 10368,
       "p90Minutes": 21600,
       "onTimeCount": 30,
       "onTimePercent": 71.4,
       "thresholdDays": 14
     },
     "distribution": [
       { "bucketKey": "0-1d", "label": "0–1 ngày", "count": 12, "isOverThreshold": false },
       { "bucketKey": "1-3d", "label": "1–3 ngày", "count": 15, "isOverThreshold": false },
       { "bucketKey": "3-7d", "label": "3–7 ngày", "count": 8, "isOverThreshold": false },
       { "bucketKey": "7-14d", "label": "7–14 ngày", "count": 5, "isOverThreshold": false },
       { "bucketKey": "14-30d", "label": "14–30 ngày", "count": 2, "isOverThreshold": true },
       { "bucketKey": "30d+", "label": ">30 ngày", "count": 0, "isOverThreshold": true }
     ]
   }
   ```

2. Thêm key `charts.repairCompletionTimeByMonth`:
   ```jsonc
   [
     { "period": "2025-01", "medianMinutes": 5760, "p90Minutes": 21600, "averageMinutes": 10368, "completedCount": 12 },
     ...
   ]
   ```

3. **Bỏ key `recentRepairHistory`** + bỏ CTE `recent_repairs` (LIMIT 20).

4. Nguồn dữ liệu: filter `repair_data` theo `dateRange` & tenant scope, chỉ tính rows có `ngay_hoan_thanh IS NOT NULL` AND `trang_thai = 'Hoàn thành'`.
   - Median/p90 dùng `percentile_cont(0.5/0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (ngay_hoan_thanh - reference_timestamp)) / 60)`.
   - Buckets tính bằng `CASE WHEN ... END` group by.

5. Sau migration: gọi `get_advisors(security)` + `get_advisors(performance)` (theo AGENTS.md).

### Frontend

**Tạo mới:**
- `src/app/(app)/reports/components/maintenance-report-completion-time.tsx` — render 2 card mới
- `src/app/(app)/reports/components/__tests__/maintenance-report-completion-time.test.tsx` — test render, edge cases

**Sửa:**
- `src/app/(app)/reports/components/maintenance-report-repair-tables.tsx` — xóa card 2 (lines 74-113); cân nhắc đổi tên file thành `maintenance-report-top-equipment-table.tsx` (giữ nguyên cũng được, sẽ confirm)
- `src/app/(app)/reports/components/maintenance-report-tab.tsx` — bỏ `recentRepairHistory`, gắn `<MaintenanceReportCompletionTime />` ngay sau `MaintenanceReportRepairCharts`, trước `MaintenanceReportPlanChart`
- `src/app/(app)/reports/components/maintenance-report-utils.ts`:
  - Bỏ `RecentRepairHistoryRow`
  - Thêm `buildCompletionTimeChartData(stats, distribution)`, `buildCompletionTimeTrendData(byMonth)`, `formatDurationAuto(minutes)`, `parseRepairCompletionTime`
- `src/app/(app)/reports/hooks/use-maintenance-data.types.ts`:
  - Bỏ `RecentRepairHistoryEntry` & `recentRepairHistory` field
  - Thêm `RepairCompletionTimeStats`, `RepairCompletionBucket`, `RepairCompletionTimeChart`, `RepairCompletionTimeByMonthPoint`
  - Update `defaultMaintenanceReportData` & `mergeMaintenanceReportData`

**Tests cần update:**
- `src/app/(app)/reports/components/__tests__/maintenance-report-sections.test.tsx` — bỏ assertion card "Lịch sử sửa chữa gần đây" (line 153, 171), thêm test render KPI + histogram + trend chart
- `src/app/(app)/reports/components/__tests__/maintenance-report-tab.test.tsx` — bỏ `recentRepairHistory` mock (line 101), thêm mock `repairCompletionTime` + assert mount component mới
- `src/app/(app)/reports/components/__tests__/maintenance-report-utils.test.ts` — thêm test cho util mới

### Quy tắc file size (theo AGENTS.md)

Nếu `maintenance-report-completion-time.tsx` > 350 dòng, tách:
- `maintenance-report-completion-time-kpi-strip.tsx` — sub-component KPI
- `maintenance-report-completion-time-utils.ts` — formatter + bucket logic riêng (nếu cần)

## Verification (theo AGENTS.md)

Thứ tự **bắt buộc** cho diff TS/React:

1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run typecheck`
3. Focused vitest: `maintenance-report-completion-time`, `maintenance-report-sections`, `maintenance-report-tab`, `maintenance-report-utils`
4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

Migration:
- Apply qua Supabase MCP `apply_migration` (KHÔNG dùng CLI)
- Sau apply: `get_advisors(security)`, `get_advisors(performance)`
- Nếu có thay đổi public types: `generate_typescript_types`

Manual verify:
- Vào Reports → tab "Bảo trì / Sửa chữa"
- Xác nhận card cũ "Lịch sử sửa chữa gần đây" đã biến mất
- 2 card mới render: KPI tính đúng (median, average, % đúng hạn), histogram buckets >14 ngày tô màu cảnh báo
- Đổi date range → cả 2 chart cập nhật
- Thử case không có dữ liệu (date range không có repair completed) → empty state hiển thị đúng
- Thử với user role `global` (full data) và role `to_qltb` (scoped 1 tenant) — đảm bảo RBAC

## Rủi ro & Lưu ý

- **Backward compat:** Bỏ `recentRepairHistory` khỏi RPC ⇒ migration + frontend phải cùng release. Nếu lo race condition khi deploy, có thể giữ field 1 release rồi xóa sau.
- **Performance:** `percentile_cont` per month có thể nặng nếu `repair_data` lớn. Cần index trên `(don_vi, ngay_hoan_thanh)` nếu chưa có. Verify qua `get_advisors(performance)`.
- **Edge case nhỏ tháng:** tháng có <3 yêu cầu hoàn thành render gap (NULL) thay vì điểm sai lệch.
- **Role admin = global:** Component không dùng `role === 'global'` trực tiếp, dữ liệu đã được RPC scope theo tenant — không có rủi ro `isGlobalRole` ở frontend.
- **i18n:** Toàn bộ label tiếng Việt, không dùng "SLA"/"p50"/"p90" trên UI.

## Files to Modify / Create

**Tạo mới:**
- `supabase/migrations/<timestamp>_add_repair_completion_time_charts.sql`
- `supabase/tests/repair_completion_time_smoke.sql`
- `src/app/(app)/reports/components/maintenance-report-completion-time.tsx`
- `src/app/(app)/reports/components/__tests__/maintenance-report-completion-time.test.tsx`

**Sửa:**
- `src/app/(app)/reports/components/maintenance-report-repair-tables.tsx`
- `src/app/(app)/reports/components/maintenance-report-tab.tsx`
- `src/app/(app)/reports/components/maintenance-report-utils.ts`
- `src/app/(app)/reports/hooks/use-maintenance-data.types.ts`
- `src/app/(app)/reports/components/__tests__/maintenance-report-sections.test.tsx`
- `src/app/(app)/reports/components/__tests__/maintenance-report-tab.test.tsx`
- `src/app/(app)/reports/components/__tests__/maintenance-report-utils.test.ts`
