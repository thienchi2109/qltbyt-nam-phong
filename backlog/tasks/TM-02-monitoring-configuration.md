# TM-02 — Monitoring configuration and effective versions

- Status: In Progress
- Milestone: Temperature Monitoring / Foundation
- Depends on: TM-01
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Allow an authorized user to configure monitoring per equipment without changing historical interpretation.

## Scope

- Opt-in monitoring flag and effective-dated configuration versions.
- Celsius lower/upper limits, schedule reference, responsible person and recording method.
- Validation of physical input range and configuration date overlaps.
- Tenant/department/RBAC enforcement and audit of configuration changes.

## Acceptance criteria

- A device can have one effective configuration at a time and a traceable version history.
- Historical readings can resolve the threshold snapshot that was effective at measurement time.
- Unauthorized users cannot create, edit or read configurations outside their equipment scope.
- Invalid ranges, overlapping effective periods and missing responsible/method data fail with actionable errors.

## Chốt thiết kế trước implementation

- Chỉ `to_qltb`/quản lý thiết bị trong tenant được phép tạo, bật/tắt và version hóa cấu hình; `global/admin` dùng `isGlobalRole()` ngoài RPC proxy.
- Không cho cấu hình có hiệu lực ngược sau khi đã có slot hoặc số đo trong khoảng đó. Cấu hình mới bắt đầu từ hiện tại hoặc thời điểm tương lai theo ranh giới ngày/ca.
- Tắt monitoring giữ nguyên lịch sử và deviation; không sinh slot tương lai sau thời điểm tắt, còn slot đã phát sinh vẫn giữ nghĩa vụ và trạng thái.
- Đơn vị là °C, giá trị có một chữ số thập phân, `lower < upper`, và giới hạn vật lý phải hữu hạn nhưng không khóa vào một khoảng hẹp dùng chung cho mọi thiết bị.
- Mỗi version bao gồm toàn bộ policy: ngưỡng, `schedule_profile_id`, timezone không-null, người phụ trách chính/danh sách thay thế tùy chọn và phương pháp; lý do thay đổi là bắt buộc và audit append-only.
- Phương pháp ghi nhận là danh mục có mã ổn định; metadata thiết bị đo/hiệu chuẩn thuộc task reading sau, không mở rộng TM-02.
- Thiết bị bật monitoring nhưng thiếu người phụ trách, method hoặc schedule hợp lệ được coi là “Cấu hình chưa hoàn chỉnh”, không sinh slot và không nhận reading.
- TM-02 chỉ làm domain/schema/RPC/RBAC và test seam. Không làm màn hình cấu hình hoặc layout frontend trước khi người dùng chốt thiết kế.

## Verification note

DB Quality Gate hiện có false positive chưa được khắc phục. Kết quả gate không được xem là bằng chứng tuyệt đối cho TM-02; mọi bất thường phải đối chiếu bằng static checks, focused tests, schema/read-back evidence và review độc lập. Không bypass gate trong task này. Bypass chỉ có thể được xem xét ở bước apply live sau khi người dùng cấp quyền rõ ràng cho thao tác live cụ thể.

## Takeover gate

The takeover agent must survey current equipment profile/configuration seams, role helpers, schema conventions and test patterns, then write and review a detailed TM-02 plan before implementation.

## TM-02 detailed implementation plan (2026-10-17)

1. **Read-only seam survey (complete before code):** use `public.thiet_bi(id, don_vi)` as the equipment boundary; resolve actor/tenant from `request.jwt.claims` (`user_id`, `don_vi`, `app_role`); keep `admin`/`global` handling fail-closed in SQL while application callers use `isGlobalRole()`. Reuse `nhan_vien` for responsible users and add narrow catalog tables for schedule profiles and recording methods.
2. **Schema:** add an opt-in device configuration table plus immutable effective-dated policy versions. Version rows contain Celsius limits (`numeric(6,1)`), schedule/method references, non-null timezone defaulting to `Asia/Ho_Chi_Minh`, primary/reserve responsible users, and mandatory change reason. Use a GiST exclusion constraint to prevent overlapping ranges per equipment and checks for finite values/lower < upper. Add append-only audit rows and a trigger that rejects updates/deletes.
3. **RPC seam:** expose scoped list/read and a single transactional upsert/toggle RPC. The RPC verifies role (`to_qltb` or global/admin), tenant ownership, mandatory reason, no retroactive start after existing slot/reading rows (when those tables exist), and appends an audit event. Incomplete policy (missing responsible, method or schedule) is represented explicitly and never marked operationally enabled.
4. **Tests first:** add a focused SQL characterization test that asserts table/column/check/index/trigger/function grants and static guards. Run it red before migration, then green after migration in the disposable/static harness; no live writes.
5. **Verification:** run migration static checks and the focused test; report static and baseline-forward lanes separately because the current gate has known false positives. Keep migration and test files under the repository size ceiling and avoid frontend/UI changes.

## Implementation evidence (2026-10-17)

- Added `20261017100000_temperature_monitoring_configuration.sql` with catalogs, per-equipment enablement, effective-dated version snapshots, GiST non-overlap protection, tenant/role-guarded RPCs, history read seam and append-only audit trigger.
- Added `supabase/tests/temperature_monitoring_configuration_smoke.sql` covering object existence, exclusion constraint, append-only trigger, RPC signatures and anonymous read denial.
- `git diff --check`: PASS. Files are 176/53 lines (below the 450-line ceiling).
- DB static gate: `node scripts/npm-run.js run db:quality-gate:local` did not complete within 45 seconds (`EXIT:124`); this is recorded as INCOMPLETE and was not bypassed. Baseline-forward: NOT RUN (no disposable Oracle gate evidence available in this worker turn).
