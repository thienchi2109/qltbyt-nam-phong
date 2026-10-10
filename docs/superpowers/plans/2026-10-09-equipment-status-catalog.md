# Equipment Status Catalog Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add “Thanh lý nội bộ” as a supported equipment status while replacing scattered status allowlists with one database-backed catalog that drives validation, UI options, filters, reports, and terminal behavior.

**Architecture:** Keep the existing `thiet_bi.tinh_trang_hien_tai` text values for compatibility in this change. Add a shared, system-wide catalog keyed by the exact stored value, with only the metadata needed by lifecycle behavior. Write RPCs validate against active catalog rows; read RPCs expose inactive metadata for history and active rows for options/zero counts. Preserve distribution/report wire shapes. A later migration may introduce stable codes; it is outside this plan.

**Tech Stack:** Supabase/Postgres migrations and RPCs, Next.js/React, TypeScript, Zod, Vitest, SQL quality-gate registry, Oracle baseline-forward validation.

**Required skills:** @superpowers:writing-plans, @superpowers:test-driven-development, @next-best-practices, @supabase-postgres-best-practices, @code-deduplication, @vercel-react-best-practices, @superpowers:verification-before-completion.

---

## Chunk 1: Catalog contract and immutable database foundation

Phạm vi đã chốt: catalog toàn hệ thống, bảy nhãn tiếng Việt; không tùy biến tenant, không trang quản trị, không dependency mới, không mã mới, không FK, không tự sửa/xóa lịch sử. Sửa tài liệu không cho phép chạy migration hay ghi live.

Cập nhật yêu cầu của người dùng (2026-10-10): không backfill hay tự chuyển trạng thái bất kỳ thiết bị hiện có; người dùng tự chọn “Thanh lý nội bộ” trên UI theo quyền chuyển trạng thái hiện hữu, không thay đổi RBAC. Badge của trạng thái mới có nền xám đậm và chữ trắng; áp dụng nhất quán ở desktop/mobile/QR, kiểm tra tương phản và giữ màu sáu trạng thái cũ.

Mỗi checkbox là một thao tác 2–5 phút; ma trận lớn thực hiện một ca mỗi lượt. Dùng context-mode cho tìm kiếm/test/gate; RTK cho Git ngắn. Trước đổi symbol: kiểm tra Code Review Graph/GitNexus impact, rồi `@code-deduplication` cho logic tái sử dụng. Đọc `AGENTS.md`, `CLAUDE.md`, `docs/runbooks/db-quality-gate-oracle.md`, `/root/Oracle/supabase-test.md`. Giữ hooks, không `--no-verify`. Gom unit tests RED với Green của task. SQL RED/Green chỉ được gọi sau candidate commit: baseline-forward control clone là RED nếu thiếu hành vi, candidate clone là GREEN; static PASS không phải SQL execution PASS.

| status_value             | order | terminal | requires_end_date | blocks_operational_actions | is_liquidation |
| ------------------------ | ----- | -------- | ----------------- | -------------------------- | -------------- |
| Hoạt động                | 1     | false    | false             | false                      | false          |
| Chờ sửa chữa             | 2     | false    | false             | false                      | false          |
| Chờ bảo trì              | 3     | false    | false             | false                      | false          |
| Chờ hiệu chuẩn/kiểm định | 4     | false    | false             | false                      | false          |
| Ngưng sử dụng            | 5     | true     | false             | false                      | false          |
| Chưa có nhu cầu sử dụng  | 6     | false    | false             | false                      | false          |
| Thanh lý nội bộ          | 7     | true     | true              | true                       | true           |

Tất cả row ban đầu active. `Ngưng sử dụng` vẫn cho phép end date và autofill UI hiện hữu; server không bắt buộc ngày lịch sử. Cờ false của sáu trạng thái không xóa giới hạn UI/RPC cũ. `requires_end_date => is_terminal`; terminal riêng lẻ không kéo theo chặn toàn bộ thao tác hay ngày bắt buộc.

Read RPC trả cả inactive để hiển thị lịch sử; dropdown/import chỉ nhận active. Create/chuyển trạng thái nhận active hoặc null theo hợp đồng cũ. Update giữ nguyên inactive đã biết được phép sửa metadata; chuyển vào inactive bị từ chối. Unknown đọc/hiển thị nhãn thô, đếm `khac` như cũ; ghi phải chọn active hợp lệ, không tự sửa lịch sử. Lỗi catalog lần đầu: thông báo + retry, khóa ghi và tải template; dùng cache React Query hiện hữu, không fallback sáu nhãn. Edit/restore theo quyền hiện hữu.

### Task 1: Freeze the seven-value contract with pre-implementation unit/UI RED tests and committed SQL gate

**Files:**

- Create: `supabase/tests/equipment_status_catalog_smoke.sql`
- Modify: `supabase/db-quality-gate-tests.json`
- Modify: `src/app/api/rpc/__tests__/equipment-status-validation.unit.test.ts`

- [ ] **Step 1: Write the real SQL fixture before the migration.** In one rollback transaction, read `equipment_status_catalog_list()` and assert the exact seven Vietnamese stored labels, unique deterministic `display_order`, and metadata: `requires_end_date` implies `is_terminal`; `Thanh lý nội bộ` is terminal, requires a date, blocks operational actions, and is liquidation; terminal by itself does not imply either date or global blocking. Call `equipment_create`/`equipment_update` with an unknown status and assert the existing invalid-status SQLSTATE/message. This is the real RPC contract; the TypeScript mock remains only a fast unit check.
- [ ] **Step 2: Register this file as `default-safe`, `rollback-required`, `runnerRequirements: ["psql"]`, and `requiredForMigrations` for the three foundation migrations in Task 2; consumer/AI tests bind their separate migrations.** Keep registry evidence in the committed diff; harness binds source SHA-256 in reports.
- [ ] **Step 3: Giữ unit mock cũ như smoke phụ, ghi rõ nó không chứng minh RPC SQL. Viết RED vào hàm UI thật ở Task 4/6.**
- [ ] **Step 4: Run the focused unit/UI tests before implementation.** The existing RPC unit mock may PASS because it models the old six-label behavior; genuine RED coverage belongs in the production helper/UI cases added by Tasks 4/6. Do not run `psql` against live or a restored baseline here, and do not claim SQL RED before a candidate migration exists.

```bash
node scripts/npm-run.js run test:run -- src/app/api/rpc/__tests__/equipment-status-validation.unit.test.ts
```

Expected: supplementary mock may PASS; newly added production helper/UI assertions fail for missing catalog/terminal behavior. The SQL fixture is committed with the candidate migration and is executed only by Task 8 baseline-forward control/candidate clones: control is the expected RED (missing catalog/behavior), candidate is GREEN. Both results bind to the exact landed SHA; no test-only commit is treated as gate evidence.

- [ ] **Step 5: Keep the SQL fixture and registry in the candidate migration commit.** SQL fixture uses `BEGIN`/`ROLLBACK`, creates tenant/equipment/claims, and is never run against live; do not run the entire SQL corpus.

### Task 2: Add immutable catalog, create, and update migrations

**Files (each migration is immutable and must stay below the 450-line source ceiling):**

- Create: `supabase/migrations/20261009100000_add_equipment_status_catalog.sql` (catalog table, seed, RLS, read RPC; no equipment write bodies)
- Create: `supabase/migrations/20261009100100_equipment_create_catalog_validation.sql` (latest `equipment_create`; date autofill and active catalog admission)
- Create: `supabase/migrations/20261009100200_equipment_update_catalog_validation.sql` (latest `equipment_update`; transition/date rules; bulk import continues to call create)
- Modify: `supabase/tests/equipment_status_catalog_smoke.sql` (test can grow; migrations never edited after commit)
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/api/rpc/__tests__/rpc-expert-disposition-completeness.test.ts`

- [ ] **Step 1: Perform a read-only audit of distinct `thiet_bi.tinh_trang_hien_tai` values through Supabase MCP and the Oracle control.** Do not add an FK based on this result. Unknown historical values become fail-closed validation/read-display debt; no backfill, delete, or history rewrite.
- [ ] **Step 2: Create the system-wide catalog with exact stored Vietnamese `status_value` as primary key, unique `display_order`, `is_active`, `is_terminal`, `requires_end_date`, `blocks_operational_actions`, and `is_liquidation`. Add `CHECK (NOT requires_end_date OR is_terminal)`. Seed the six existing labels unchanged plus `Thanh lý nội bộ`; preserve legacy policy metadata for the six values rather than broadening it. Add a deterministic catalog display order; list sort order ở Task 3, không reorder sáu trạng thái cũ trong list.**
- [ ] **Step 3: Put only table/seed/RLS and `equipment_status_catalog_list()` in `20261009100000...`. Table RLS: authenticated SELECT only; revoke DML from PUBLIC/anon/authenticated. Function revoke EXECUTE PUBLIC/anon/service_role, grant authenticated; fixed `SET search_path = public, pg_temp`; add the RPC allowlist/completeness fixture. Client writes to the catalog are not exposed; future metadata edits require a separate reviewed migration. Keep this file below 450 lines.**
- [ ] **Step 4: Recreate only the latest `equipment_create` definition in `20261009100100...`, replacing the literal allowlist with active catalog `EXISTS`, preserving tenant/auth/error/null behavior and all existing field writes. Keep the complete function body and migration file below 450 lines; do not edit an applied migration.**
- [ ] **Step 5: Recreate only the latest `equipment_update` definition in `20261009100200...`, preserving inactive-known metadata edits and rejecting inactive transitions. Keep date rules here and the complete function body below 450 lines. `equipment_bulk_import` already calls `equipment_create`; do not duplicate its validator or create a fourth bulk body.**
- [ ] **Step 6: Leave out a conditional FK in this change.** The audit is evidence for validation and anomaly reporting only; adding an FK later requires a separate migration after a human-approved cleanup policy.
- [ ] **Step 7: Implement server date rules in the create/update migrations: for create/update/import, create/entry vào `requires_end_date` với effective date trống dùng `to_char(transaction_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`; explicit date hợp lệ và ngày cũ hợp lệ có ưu tiên. Update thiếu key giữ giá trị cũ; explicit null/blank chỉ autofill khi vừa vào trạng thái mới, xóa ngày khi trạng thái mới không đổi bị từ chối. Không autofill metadata-only trên lịch sử thiếu ngày. Restore tới active không-terminal phải clear end date theo validation cũ. ISO full date và end >= start vẫn được kiểm tra. Giữ server optional-date của Ngưng sử dụng. Add SQL smoke cases for create, update, import, timezone boundary, explicit-date precedence, and unchanged historical rows.**
- [ ] **Step 8: Run static quality gate and commit all three immutable migrations atomically with tests/registry.**

```bash
node -e 'const fs=require("fs"); for (const p of ["supabase/migrations/20261009100000_add_equipment_status_catalog.sql", "supabase/migrations/20261009100100_equipment_create_catalog_validation.sql", "supabase/migrations/20261009100200_equipment_update_catalog_validation.sql"]) { const n=fs.readFileSync(p,"utf8").split("\n").length; if (n>=450) throw new Error(`${p}: ${n} lines`); }'
node scripts/npm-run.js run db:quality-gate:local
git add -- supabase/migrations/20261009100000_add_equipment_status_catalog.sql supabase/migrations/20261009100100_equipment_create_catalog_validation.sql supabase/migrations/20261009100200_equipment_update_catalog_validation.sql supabase/tests/equipment_status_catalog_smoke.sql supabase/db-quality-gate-tests.json 'src/app/api/rpc/[fn]/allowed-functions.ts' src/app/api/rpc/__tests__/rpc-expert-disposition-completeness.test.ts src/app/api/rpc/__tests__/equipment-status-validation.unit.test.ts
git commit -m "feat: add equipment status catalog and write validation"
```

No later task may edit these committed migrations. Chỉ commit khi format/no-any/dedupe/typecheck/focused tests/react-doctor theo Task 8 đã PASS cho diff JS/TS; static SQL phải PASS. Baseline-forward riêng cho clean committed SHA.

Registry entry mẫu (đặt vào `tests`, cùng dạng các entries hiện hữu):

```json
{
  "path": "supabase/tests/equipment_status_catalog_smoke.sql",
  "evidence": ["Equipment status catalog seven-label contract"],
  "fixtureContract": "isolated-fixture",
  "requiredForMigrations": [
    "supabase/migrations/20261009100000_add_equipment_status_catalog.sql",
    "supabase/migrations/20261009100100_equipment_create_catalog_validation.sql",
    "supabase/migrations/20261009100200_equipment_update_catalog_validation.sql"
  ],
  "purpose": "phase-gate",
  "runnerRequirements": ["psql"],
  "safety": "default-safe",
  "timeoutSeconds": 30,
  "transactionContract": "rollback-required",
  "gateScope": "core-security"
}
```

Consumers/AI smoke dùng entries tương tự, mỗi entry chỉ liệt kê đúng migration tương ứng; không miễn trừ test bảo vệ candidate. Không thêm field source hash ngoài schema: source hash được harness ghi trong evidence.

**Migration foundation hoàn chỉnh:** đặt DDL/seed/RLS/read RPC trong migration catalog; đặt từng `CREATE OR REPLACE FUNCTION` đầy đủ vào migration create/update tương ứng sau khi đọc latest qua `pg_get_functiondef`. Trước commit, đếm dòng từng file và tách thêm migration nếu một function body vượt 450 dòng; không dùng regex ghép một migration lịch sử bất kỳ làm source of truth.

```sql
CREATE TABLE public.equipment_status_catalog (
  status_value text PRIMARY KEY,
  display_order integer NOT NULL UNIQUE CHECK (display_order > 0),
  is_active boolean NOT NULL DEFAULT true,
  is_terminal boolean NOT NULL DEFAULT false,
  requires_end_date boolean NOT NULL DEFAULT false,
  blocks_operational_actions boolean NOT NULL DEFAULT false,
  is_liquidation boolean NOT NULL DEFAULT false,
  CHECK (NOT requires_end_date OR is_terminal)
);
INSERT INTO public.equipment_status_catalog
  (status_value, display_order, is_terminal, requires_end_date,
   blocks_operational_actions, is_liquidation)
VALUES
  ('Hoạt động', 1, false, false, false, false),
  ('Chờ sửa chữa', 2, false, false, false, false),
  ('Chờ bảo trì', 3, false, false, false, false),
  ('Chờ hiệu chuẩn/kiểm định', 4, false, false, false, false),
  ('Ngưng sử dụng', 5, true, false, false, false),
  ('Chưa có nhu cầu sử dụng', 6, false, false, false, false),
  ('Thanh lý nội bộ', 7, true, true, true, true);
ALTER TABLE public.equipment_status_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.equipment_status_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.equipment_status_catalog TO authenticated;
CREATE POLICY equipment_status_catalog_authenticated_read
  ON public.equipment_status_catalog FOR SELECT TO authenticated USING (true);
CREATE FUNCTION public.equipment_status_catalog_list()
RETURNS SETOF public.equipment_status_catalog
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT status_value, display_order, is_active, is_terminal, requires_end_date,
         blocks_operational_actions, is_liquidation
  FROM public.equipment_status_catalog ORDER BY display_order;
$$;
REVOKE ALL ON FUNCTION public.equipment_status_catalog_list()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.equipment_status_catalog_list() TO authenticated;
```

**SQL fixture chạy RPC thật (RED control / GREEN candidate after commit):** tạo file Task 1 với đoạn sau; bổ sung mỗi ca matrix một assertion, cùng transaction. Không dùng `ASSERT` PostgreSQL (có thể bị tắt), luôn `RAISE EXCEPTION`. Không lưu/chạy file này trên live.

```sql
BEGIN;
DO $$
DECLARE
  v_tenant bigint;
  v_equipment public.thiet_bi;
  v_explicit public.thiet_bi;
  v_summary jsonb;
  v_suffix text := txid_current()::text;
  v_today text := to_char(transaction_timestamp()
    AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
  v_labels text[];
BEGIN
  SELECT array_agg(status_value ORDER BY display_order) INTO v_labels
  FROM public.equipment_status_catalog_list() WHERE is_active;
  IF v_labels IS DISTINCT FROM ARRAY[
    'Hoạt động', 'Chờ sửa chữa', 'Chờ bảo trì',
    'Chờ hiệu chuẩn/kiểm định', 'Ngưng sử dụng',
    'Chưa có nhu cầu sử dụng', 'Thanh lý nội bộ'
  ]::text[] THEN RAISE EXCEPTION 'catalog labels differ: %', v_labels; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.equipment_status_catalog
    WHERE status_value = 'Thanh lý nội bộ' AND is_terminal AND requires_end_date
      AND blocks_operational_actions AND is_liquidation
  ) THEN RAISE EXCEPTION 'liquidation metadata missing'; END IF;
  INSERT INTO public.don_vi(name, active)
    VALUES ('Status gate ' || v_suffix, true) RETURNING id INTO v_tenant;
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated', 'user_id', '1',
    'sub', '1', 'don_vi', v_tenant::text
  )::text, true);
  SELECT * INTO v_equipment FROM public.equipment_create(jsonb_build_object(
    'ma_thiet_bi', 'STATUS-' || v_suffix, 'ten_thiet_bi', 'Status gate',
    'khoa_phong_quan_ly', 'Khoa Gate', 'tinh_trang_hien_tai', 'Thanh lý nội bộ'
  ));
  IF v_equipment.ngay_ngung_su_dung IS DISTINCT FROM v_today
    THEN RAISE EXCEPTION 'server autofill missing'; END IF;
  SELECT * INTO v_explicit FROM public.equipment_create(jsonb_build_object(
    'ma_thiet_bi', 'STATUS-DATE-' || v_suffix, 'ten_thiet_bi', 'Explicit date',
    'tinh_trang_hien_tai', 'Thanh lý nội bộ',
    'ngay_dua_vao_su_dung', '2026-09-01', 'ngay_ngung_su_dung', '2026-10-01'
  ));
  IF v_explicit.ngay_ngung_su_dung IS DISTINCT FROM '2026-10-01'
    THEN RAISE EXCEPTION 'explicit date overwritten'; END IF;
  PERFORM public.equipment_update(v_explicit.id, '{"ghi_chu":"metadata"}'::jsonb);
  IF (SELECT ngay_ngung_su_dung FROM public.thiet_bi WHERE id = v_explicit.id)
    IS DISTINCT FROM '2026-10-01' THEN RAISE EXCEPTION 'metadata edit changed date'; END IF;
  BEGIN
    PERFORM public.equipment_update(v_explicit.id,
      '{"tinh_trang_hien_tai":"UNKNOWN-GATE"}'::jsonb);
    RAISE EXCEPTION 'unknown update accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.equipment_create(jsonb_build_object(
      'ma_thiet_bi', 'STATUS-BAD-' || v_suffix, 'ten_thiet_bi', 'Invalid',
      'tinh_trang_hien_tai', 'UNKNOWN-GATE'
    ));
    RAISE EXCEPTION 'unknown create accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  v_summary := public.equipment_bulk_import(jsonb_build_array(jsonb_build_object(
    'ma_thiet_bi', 'STATUS-IMPORT-' || v_suffix, 'ten_thiet_bi', 'Import',
    'tinh_trang_hien_tai', 'Thanh lý nội bộ'
  )));
  IF (v_summary->>'inserted')::integer IS DISTINCT FROM 1
    OR (SELECT ngay_ngung_su_dung FROM public.thiet_bi
      WHERE ma_thiet_bi = 'STATUS-IMPORT-' || v_suffix AND don_vi = v_tenant)
      IS DISTINCT FROM v_today THEN RAISE EXCEPTION 'import bypasses date rules'; END IF;
END;
$$;
ROLLBACK;
```

- [ ] **Bổ sung ca SQL: update Hoạt động -> Thanh lý nội bộ khi thiếu key/date blank; explicit date; invalid ISO/chronology; xóa ngày khi terminal không đổi; metadata-only lịch sử không date; inactive unchanged vs entry; unknown import per-row error; tenant/department denial.** Một ca mỗi lượt, không làm test mutate baseline ngoài rollback.
- [ ] **Bổ sung ca ACL/RLS: authenticated SELECT/read RPC được, anon không EXECUTE/SELECT, authenticated không INSERT/UPDATE/DELETE catalog.** Kiểm tra `has_function_privilege`/`has_table_privilege`, `relrowsecurity` và policy; test role thật trên disposable clone nếu cần.
- [ ] **Chụp `ngay_ngung_su_dung`/label trước và sau để chứng minh chỉ fixture thay đổi, không historical backfill.** Timezone test của UI dùng fake clock `2026-10-09T17:30:00Z` -> `2026-10-10`; RPC autofill kiểm tra against transaction timestamp như trên, không thêm clock config runtime chỉ để test.

### Task 3: Add an append-only consumer RPC migration

Source clarification (2026-10-10): the current `equipment_filter_buckets` returns bucket arrays and has no `status_counts` field. Preserve those arrays and add `status_catalog`; preserve the existing `status_counts` in the primary `equipment_status_distribution`, where that field exists. The legacy distribution overload returns `TABLE(tinh_trang, so_luong)` and must retain that shape. These clarifications do not introduce new response contracts.

Review correction (2026-10-10): use the specified shared OR predicate for liquidation rank and its date chronology. Keep raw unknown status labels in filter buckets so exact list filtering still works; aggregate unknown history as `khac` only in reports. Read metadata includes inactive catalog rows, with inactive history counts retained. Add `20261009102300_maintenance_tasks_delete_lock_order.sql` to align the existing delete RPC with equipment-before-task/plan locking introduced here, preserving every existing authorization and closing rule. Bind this additional migration in the consumer test registry and retain a deterministic two-session update/delete regression check. This correctness extension supersedes the thirteen-migration count below.

The two-session check also reproduced `40P01` between the existing `repair_request_update` joint row lock and the new equipment-first completion lock. Add `20261009102400_repair_request_update_lock_order.sql` with equipment-before-request locking and association recheck only, preserving all existing permissions and update behavior. Register all fifteen consumer migrations and retain the update/complete race check. These two peer-lock migrations prevent regressions introduced by the new lock order; they do not change transition permissions.

**Files (one RPC/responsibility per immutable migration; each file must stay below 450 lines):**

- Create: `supabase/migrations/20261009101000_equipment_filter_buckets_catalog.sql` (equipment_filter_buckets)
- Create: `supabase/migrations/20261009101100_equipment_status_distribution_catalog.sql` (primary equipment_status_distribution overload)
- Create: `supabase/migrations/20261009101200_equipment_status_distribution_legacy_catalog.sql` (legacy distribution overload/wrapper)
- Create: `supabase/migrations/20261009101300_equipment_list_liquidation_catalog.sql` (equipment_list_enhanced liquidation rank)
- Create: `supabase/migrations/20261009101400_repair_request_create_terminal_guard.sql` (repair_request_create)
- Create: `supabase/migrations/20261009101500_usage_session_start_terminal_guard.sql` (usage_session_start)
- Create: `supabase/migrations/20261009101600_maintenance_bulk_insert_terminal_guard.sql` (maintenance_tasks_bulk_insert)
- Create: `supabase/migrations/20261009101700_maintenance_task_update_terminal_guard.sql` (maintenance_task_update)
- Create: `supabase/migrations/20261009101800_maintenance_task_complete_terminal_guard.sql` (maintenance_task_complete)
- Create: `supabase/migrations/20261009101900_repair_request_sync_terminal_policy.sql` (repair_request_sync_equipment_status)
- Create: `supabase/migrations/20261009102000_repair_request_approve_terminal_guard.sql` (repair_request_approve)
- Create: `supabase/migrations/20261009102100_repair_request_complete_terminal_preserve.sql` (repair_request_complete)
- Create: `supabase/migrations/20261009102200_repair_request_delete_terminal_preserve.sql` (repair_request_delete)
- Create: `supabase/tests/equipment_status_catalog_consumers_smoke.sql`
- Modify: `supabase/db-quality-gate-tests.json`

- [ ] **Step 1: Add RED SQL assertions for catalog-aware filter buckets, zero-count distribution, liquidation-last ordering independent of department, workflow guards, and status-writer sync. Register this test under all thirteen exact consumer migration paths above.**
      Guard SQL fixture tái dùng cấu trúc tenant/plan/equipment/claims của `supabase/tests/equipment_department_scope_workflow_guards_smoke_core_security.sql` (không copy baseline debt exemption). Mỗi entry/start RPC thực gọi với fixture terminal và fixture Hoạt động đối chứng; assert SQLSTATE `55000` + message `equipment_status_blocks_operational_actions`, không insert task/repair/usage, không rewrite trạng thái, không enqueue notification. Thêm ca metadata edit/restore thành công và existing usage end không bị chặn. Register `requiredForMigrations` đúng migration consumer; không dùng text/regex SQL test thay execution.

- [ ] **Step 2: Put only the latest `equipment_filter_buckets` function in `20261009101000...`; its complete body must remain below 450 lines.** Replace `equipment_filter_buckets` with catalog-aware definitions. Preserve the existing `status_counts` object and all legacy overloads/callers; add `status_catalog` array metadata trong response JSON, không tạo companion RPC. Left-join active rows so zero-count `Thanh lý nội bộ` remains selectable and reportable. Giữ sáu snake_case keys + `khac` trong totals/department/location; thêm key exact `Thanh lý nội bộ` cho trạng thái mới. Client reuse một legacy label-to-key map ở adapter, metadata iterate dynamic; unknown historical vẫn `khac`, không double-count totals. Không thêm `report_key`/stable-code schema ngoài metadata đã chốt.**
- [ ] **Step 3: Put the primary distribution overload in `20261009101100...`, its legacy overload/wrapper in `20261009101200...`, and only `equipment_list_enhanced` in `20261009101300...`; each complete body and file remain below 450 lines. Update liquidation ordering to sort new `is_liquidation` rows last trên mọi list/export scope, kể cả `p_liquidation_last=false`, đồng thời giữ rank cũ: `catalog.is_liquidation OR (p_liquidation_last AND status='Ngưng sử dụng' AND _normalize_department_scope(department)=_normalize_department_scope('VT-TBYT- KHO THANH LÍ'))`. Không bật flag toàn cục để kéo Ngưng sử dụng ở scope trước đây không áp dụng xuống cuối. Giữ secondary sort, chronology và tie-break cũ; test single/multi/no department, flag false/true, tenant isolation và export pagination. Do not infer liquidation solely from department text.**
- [ ] **Step 4: Put the latest repair/use/maintenance entry definitions separately in `20261009101400...` through `20261009101800...`, one named RPC per file as listed above; keep every file below 450 lines. Add fail-closed guards to `repair_request_create`, `usage_session_start`, `maintenance_tasks_bulk_insert`, `maintenance_task_update` when changing/starting work, and `maintenance_task_complete` based on catalog `blocks_operational_actions`; lock equipment before check to avoid races, bulk lock ids ascending, and check before insert/status rewrite/notification/outbox. Preserve department/soft-delete/role/transaction guards. Block start/new work; keep usage-session close and history reads. UI/QR does not replace server. Metadata edit and explicitly permitted restore remain available.**
- [ ] **Step 5: In `20261009101900...`, update `repair_request_sync_equipment_status` from `20260415113000_repair_request_equipment_status_invariant.sql` / latest live definition.** Acquire equipment row lock before inspecting catalog metadata. If its row has `blocks_operational_actions=true`, return without writing either `tinh_trang_hien_tai` or `ngay_ngung_su_dung`; never rewrite terminal to `Chờ sửa chữa`/`Hoạt động`. Preserve the existing helper behavior for the six old statuses and missing/not-found authorization guards. This preservation applies even when the helper is called from approve/complete/delete rather than create.
- [ ] **Step 6: Put the complete latest approve/complete/delete definitions in `20261009102000...`, `20261009102100...`, and `20261009102200...`, respectively.** Approve and other new operational steps check catalog blocking under the equipment lock and raise `55000` / `equipment_status_blocks_operational_actions` before request mutation/audit/outbox/notification. Completing/deleting a pre-existing repair request is a historical closing operation only where the current authorization already allows it; retain its authorized closing behavior and existing required close/audit effects while the sync helper preserves terminal status/date. Do not grant new close rights or suppress unrelated required audit. Use the same lock order (equipment before request; sorted equipment ids in bulk), recheck request equipment association under lock, and reuse the existing transaction; terminal transition races must not permit resurrection or a post-terminal new operational side effect.
- [ ] **Step 7: Add regression cases with separate pre-existing open repair requests before terminal transition.** Approve on terminal fails before mutation/outbox; authorized complete/delete close historical work but cannot change terminal label/date. Verify the same operations on non-terminal controls preserve prior behavior, unauthorized close still fails, and terminal transition racing approve/complete/delete leaves terminal/date intact. Run two sessions only against disposable gate databases with bounded locks/timeouts and cleanup; a sequential SQL assertion is insufficient race evidence.
- [ ] **Step 8: Add authenticated read grants/RLS for catalog only; no client catalog write path. Count lines for all thirteen migration files, run the actual SQL smoke test against disposable databases, then commit all thirteen migrations and registry in one commit.**

```bash
node -e 'const fs=require("fs"); for (const p of ["supabase/migrations/20261009101000_equipment_filter_buckets_catalog.sql", "supabase/migrations/20261009101100_equipment_status_distribution_catalog.sql", "supabase/migrations/20261009101200_equipment_status_distribution_legacy_catalog.sql", "supabase/migrations/20261009101300_equipment_list_liquidation_catalog.sql", "supabase/migrations/20261009101400_repair_request_create_terminal_guard.sql", "supabase/migrations/20261009101500_usage_session_start_terminal_guard.sql", "supabase/migrations/20261009101600_maintenance_bulk_insert_terminal_guard.sql", "supabase/migrations/20261009101700_maintenance_task_update_terminal_guard.sql", "supabase/migrations/20261009101800_maintenance_task_complete_terminal_guard.sql", "supabase/migrations/20261009101900_repair_request_sync_terminal_policy.sql", "supabase/migrations/20261009102000_repair_request_approve_terminal_guard.sql", "supabase/migrations/20261009102100_repair_request_complete_terminal_preserve.sql", "supabase/migrations/20261009102200_repair_request_delete_terminal_preserve.sql"]) { const n=fs.readFileSync(p,"utf8").split("\n").length; if (n>=450) throw new Error(`${p}: ${n} lines`); }'
node scripts/npm-run.js run db:quality-gate:local
git add -- supabase/migrations/20261009101000_equipment_filter_buckets_catalog.sql supabase/migrations/20261009101100_equipment_status_distribution_catalog.sql supabase/migrations/20261009101200_equipment_status_distribution_legacy_catalog.sql supabase/migrations/20261009101300_equipment_list_liquidation_catalog.sql supabase/migrations/20261009101400_repair_request_create_terminal_guard.sql supabase/migrations/20261009101500_usage_session_start_terminal_guard.sql supabase/migrations/20261009101600_maintenance_bulk_insert_terminal_guard.sql supabase/migrations/20261009101700_maintenance_task_update_terminal_guard.sql supabase/migrations/20261009101800_maintenance_task_complete_terminal_guard.sql supabase/migrations/20261009101900_repair_request_sync_terminal_policy.sql supabase/migrations/20261009102000_repair_request_approve_terminal_guard.sql supabase/migrations/20261009102100_repair_request_complete_terminal_preserve.sql supabase/migrations/20261009102200_repair_request_delete_terminal_preserve.sql supabase/tests/equipment_status_catalog_consumers_smoke.sql supabase/db-quality-gate-tests.json
git commit -m "feat: make equipment status consumers catalog-aware"
```

The consumer smoke registry entry has `requiredForMigrations` equal to this exact array (with the same default-safe/rollback fields as the foundation example):

```json
[
  "supabase/migrations/20261009101000_equipment_filter_buckets_catalog.sql",
  "supabase/migrations/20261009101100_equipment_status_distribution_catalog.sql",
  "supabase/migrations/20261009101200_equipment_status_distribution_legacy_catalog.sql",
  "supabase/migrations/20261009101300_equipment_list_liquidation_catalog.sql",
  "supabase/migrations/20261009101400_repair_request_create_terminal_guard.sql",
  "supabase/migrations/20261009101500_usage_session_start_terminal_guard.sql",
  "supabase/migrations/20261009101600_maintenance_bulk_insert_terminal_guard.sql",
  "supabase/migrations/20261009101700_maintenance_task_update_terminal_guard.sql",
  "supabase/migrations/20261009101800_maintenance_task_complete_terminal_guard.sql",
  "supabase/migrations/20261009101900_repair_request_sync_terminal_policy.sql",
  "supabase/migrations/20261009102000_repair_request_approve_terminal_guard.sql",
  "supabase/migrations/20261009102100_repair_request_complete_terminal_preserve.sql",
  "supabase/migrations/20261009102200_repair_request_delete_terminal_preserve.sql"
]
```

Source-size check on existing definitions: create 148 lines, update 187, filter buckets 199, primary distribution 219, list 294, repair create 228, usage start 145, maintenance 74/97/76, repair sync 66, approve 110, complete 140, delete 89. Count the final copied definitions plus new guards/comments/grants before commit; a file at 450 or more fails the plan check. Each split retains the full function signature/ACL/search_path; do not edit the immutable source definitions.

## Chunk 2: Dynamic application consumers

### Task 4: Create one client catalog adapter

Source clarification (2026-10-10): the catalog uses the existing QueryClient cache and is cleared when that client is cleared. Automatic clearing on logout has not been established in the current session wiring; Task 4 does not add session handling. Catalog readiness is a prerequisite for writes, combined with the existing authorization at each consumer, and grants no new permissions. Unknown metadata is represented by an absent lookup result; consumers retain the raw label and neutral display without an identity-only helper.

**Files:**

- Create: `src/hooks/use-equipment-status-catalog.ts`
- Create: `src/lib/equipment-status.ts`
- Create: `src/lib/__tests__/equipment-status.test.ts`
- Create: `src/hooks/__tests__/use-equipment-status-catalog.test.tsx`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify: `src/app/api/rpc/__tests__/rpc-expert-disposition-completeness.test.ts`

- [ ] **Step 1: Viết RED helper tests cho order/metadata và hook tests cho load error/retry/cache.** Create `src/hooks/__tests__/use-equipment-status-catalog.test.tsx`; reuse local per-test React Query mocking conventions, không helper test utility mới.
- [ ] **Step 2: Đặt narrow row type trong `src/lib/equipment-status.ts`, implement query hook using existing RPC/query conventions, stable cache key, and fail-closed write-form state. Do not duplicate an existing RPC hook; verify with `@code-deduplication`.**
- [ ] **Step 3: Implement pure metadata helpers and a neutral fallback for unknown/future labels. Keep legacy display aliases only where existing report/export consumers require them; do not create a new status allowlist.**
- [ ] **Step 4: Run focused RED/GREEN tests.**

```bash
node scripts/npm-run.js run test:run -- src/lib/__tests__/equipment-status.test.ts src/hooks/__tests__/use-equipment-status-catalog.test.tsx
```

**Ví dụ helper và một regression chạy trên hàm thật** (`src/lib/equipment-status.ts` và test tương ứng):

```ts
export interface EquipmentStatusRow {
  status_value: string
  display_order: number
  is_active: boolean
  is_terminal: boolean
  requires_end_date: boolean
  blocks_operational_actions: boolean
  is_liquidation: boolean
}

export function getActiveEquipmentStatusValues(rows: readonly EquipmentStatusRow[]): string[] {
  return rows
    .filter((row) => row.is_active)
    .sort((a, b) => a.display_order - b.display_order)
    .map((row) => row.status_value)
}
```

```ts
import { describe, expect, it } from "vitest"
import { getActiveEquipmentStatusValues, type EquipmentStatusRow } from "../equipment-status"

describe("getActiveEquipmentStatusValues", () => {
  it("keeps active labels ordered and excludes inactive rows", () => {
    const base = {
      is_terminal: false,
      requires_end_date: false,
      blocks_operational_actions: false,
      is_liquidation: false,
    }
    const rows: EquipmentStatusRow[] = [
      { ...base, status_value: "Thanh lý nội bộ", display_order: 7, is_active: true },
      { ...base, status_value: "Hoạt động", display_order: 1, is_active: true },
      { ...base, status_value: "Historical", display_order: 8, is_active: false },
    ]
    expect(getActiveEquipmentStatusValues(rows)).toEqual(["Hoạt động", "Thanh lý nội bộ"])
  })
})
```

Hook tái dùng `callRpc` + React Query conventions của `src/hooks/use-equipment-distribution.ts`, một query key system-wide nằm dưới session/query-cache clear hiện hữu, không tenant customization. Không gọi RPC riêng cho từng row. Validate DTO tại boundary bằng Zod hiện có: nonempty unique labels/order, boolean metadata, required-date implies terminal; lỗi payload cũng khóa submit và cho retry. Không thêm custom cache, loader wrapper, style factory hoặc một hook cho mỗi cờ. Metadata lookup tại consumer bằng `find`; dữ liệu chỉ bảy row.

### Task 5: Replace UI, form, import, export, filter, and distribution literals

Source clarification (2026-10-10): usage-session initial/final condition fields are existing free-text descriptions, distinct from equipment status admission. Replace their datalist suggestions and expose catalog retry, preserving free text and authorized session closing; catalog readiness does not grant or remove those permissions. Preserve the existing import trim of new user input before exact catalog admission, without adding fuzzy matching, normalization or historical rewrites.

Necessary direct-owner wiring is included for add-dialog/detail-dialog schema and catalog props, raw edit defaults, distribution utilities/chart/inventory consumers and narrow equipment status type compatibility. Keep lifecycle date/transition rules for Task 6. Extract the existing template generator to `src/lib/equipment-import-template.ts`, import validator to `src/components/import-equipment-validation.ts`, and status assignment section to `AddEquipmentStatusSection.tsx` where needed to keep changed source files below the documented ceiling. Use focused catalog test files for oversized existing suites, preserving their unrelated coverage.

The distribution chart tab and tooltip are direct consumers too: replace their six-status rendering list and preserve raw payload labels in tooltips. Reuse the existing distribution summary utilities; retain one legacy label-to-wire-key map only for response compatibility, never for admission.

**Files:**

- Modify: `src/components/equipment/equipment-table-columns.tsx`
- Modify: `src/components/equipment-edit/EquipmentEditTypes.ts`
- Modify: `src/components/add-equipment-dialog.schema.ts`
- Modify: `src/components/add-equipment-dialog.sections.tsx`
- Modify: `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailStatusSection.tsx`
- Modify: `src/components/import-equipment-dialog.tsx`
- Modify: `src/lib/excel-utils.ts`
- Modify: `src/components/start-usage-dialog.tsx`
- Modify: `src/components/end-usage-dialog.tsx`
- Modify: `src/app/(app)/equipment/_hooks/useEquipmentFilterBuckets.ts`
- Modify: `src/app/(app)/equipment/_hooks/EquipmentDataQueryParams.ts`
- Modify: `src/app/(app)/equipment/_hooks/useEquipmentExport.ts`
- Modify: `src/hooks/use-equipment-distribution.ts`
- Modify: `src/components/equipment-distribution-summary.tsx`
- Modify: `src/app/(app)/reports/components/export-report-dialog.utils.ts`
- Modify: `src/components/__tests__/add-equipment-dialog.schema.test.ts`
- Modify: `src/components/__tests__/import-equipment-validation.test.ts`
- Modify: `src/lib/__tests__/excel-template-generation.test.ts`
- Modify: `src/components/__tests__/equipment-distribution-summary.utils.test.ts`
- Modify: `src/components/__tests__/equipment-distribution-summary.donut.test.tsx`
- Modify: `src/app/(app)/reports/components/__tests__/export-report-dialog.test.tsx`
- Modify: `src/app/(app)/equipment/_hooks/__tests__/useEquipmentData.filter-buckets.test.tsx`
- Modify: `src/app/(app)/equipment/_hooks/__tests__/EquipmentDataQueryParams.test.ts`
- Modify: `src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts`
- Modify only admission/mock generation if required: `src/lib/data.ts`
- Modify only compatible labels/display if required: `src/components/dashboard/dashboard-tabs/DashboardEquipmentTab.tsx`

- [ ] **Step 1: Add RED assertions for all seven values, zero-count filters/distribution, import template validation, and report export. Include the actual report utility path above and every distribution overload caller.**
- [ ] **Step 2: Pass catalog values into dynamic Zod schema factories and selects; remove six-value admission arrays. Preserve exact stored Vietnamese labels and unknown-status read fallback.**
- [ ] **Step 3: Keep distribution’s `status_counts` and department/location overloads backward-compatible while iterating catalog metadata for labels, percentages, zero rows, and `Thanh lý nội bộ` last. Export catalog rows without dropping unknown historical keys.**
- [ ] **Step 4: Thread selected values unchanged through list/filter/export/import. Ensure catalog load errors expose retry and disable write submission rather than silently inventing options.**
- [ ] **Step 5: Run focused UI tests and commit only these consumer files.**

```bash
node scripts/npm-run.js run test:run -- src/components/__tests__/add-equipment-dialog.schema.test.ts src/components/__tests__/import-equipment-validation.test.ts src/lib/__tests__/excel-template-generation.test.ts 'src/app/(app)/reports/components/__tests__/export-report-dialog.test.tsx' src/components/__tests__/equipment-distribution-summary.utils.test.ts 'src/app/(app)/equipment/_hooks/__tests__/useEquipmentData.filter-buckets.test.tsx' 'src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts'
git add -- src/hooks/use-equipment-status-catalog.ts src/lib/equipment-status.ts src/lib/__tests__/equipment-status.test.ts src/hooks/__tests__/use-equipment-status-catalog.test.tsx src/components/equipment/equipment-table-columns.tsx src/components/equipment-edit/EquipmentEditTypes.ts src/components/add-equipment-dialog.schema.ts src/components/add-equipment-dialog.sections.tsx src/components/import-equipment-dialog.tsx src/lib/excel-utils.ts src/components/start-usage-dialog.tsx src/components/end-usage-dialog.tsx src/hooks/use-equipment-distribution.ts src/components/equipment-distribution-summary.tsx 'src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailStatusSection.tsx' 'src/app/(app)/equipment/_hooks/useEquipmentFilterBuckets.ts' 'src/app/(app)/equipment/_hooks/EquipmentDataQueryParams.ts' 'src/app/(app)/equipment/_hooks/useEquipmentExport.ts' 'src/app/(app)/reports/components/export-report-dialog.utils.ts'
# Stage từng test thực sự đổi bằng đường dẫn trong Files; không stage thư mục.
git commit -m "feat: load equipment status options from catalog"
```

## Chunk 3: Lifecycle, AI compatibility, and verification

### Task 6: Apply catalog metadata to lifecycle surfaces

Source clarification (2026-10-10): retain DD/MM/YYYY where the existing date input displays it; assert the persisted ISO date at the Asia/Ho_Chi_Minh day boundary. QR usage/history actions navigate rather than create a session, so keep those paths available and guard new operations at the actual start/repair entry and submission. Initial/final usage condition text stays free text, while equipment metadata governs new operational eligibility; existing-session close stays available under its existing RBAC. Preserve the differing legacy policies of each surface rather than broadening all terminal states.

For metadata-only edits, omit an unchanged missing historical end-date field from the update patch; do not send an explicit clear or autofill it. Preserve explicit date edits, real restore clears, and unrelated null-valued fields.

Necessary direct-owner wiring includes the equipment content owner (catalog props to mobile rows), QR sheet owner, detail form/tabs/index, existing add/edit schema owners, `mobile-usage-actions.tsx`, and `start-usage-dialog.tsx`. Reuse the existing status/date modules and catalog subscription; no duplicate transition helper, per-row catalog hook, or new provider framework.

**Files:**

- Modify: `src/components/equipment-decommission-form.ts`
- Modify: `src/components/mobile-equipment-list-item.tsx`
- Modify: `src/components/qr-action-sheet-config.tsx`
- Modify: `src/components/qr-action-sheet-actions.tsx`
- Modify: `src/components/equipment-edit/EquipmentEditTransitions.ts`
- Test: `src/components/equipment-edit/__tests__/EquipmentEditTransitions.test.ts`
- Modify: `src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx`
- Modify: `src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx`
- Modify: `src/app/(app)/equipment/__tests__/equipment-liquidation-order-scope.test.ts`
- Modify: `src/components/__tests__/mobile-equipment-list-item.test.tsx`
- Modify: `src/components/__tests__/qr-action-sheet.test.tsx`
- Modify: `src/components/equipment-edit/useEquipmentEditUpdate.ts`
- Modify: `src/components/add-equipment-dialog.tsx`
- Inspect only: `src/components/equipment-edit/EquipmentEditTypes.ts` and `src/components/equipment-edit/useEquipmentEditUpdate.ts`; modify the existing schema owner found by symbol search, never create `src/components/equipment-edit-form.tsx`
- Preserve: `src/lib/equipment-attention-preset.ts`

- [ ] **Step 1: Write RED tests at the real paths above for transition detection, terminal date autofill, explicit-date precedence, Asia/Ho_Chi_Minh boundary, a dark-gray badge with white text for Thanh lý nội bộ, blocked repair/use/maintenance actions, metadata edit, and permitted restore.**
- [ ] **Step 2: Use catalog metadata for new behavior while preserving verified legacy six-status UI policy. `blocks_operational_actions` must govern new terminal action blocking; do not broaden all terminal rows. `Ngưng sử dụng` remains compatible with its existing UI behavior through an explicit legacy policy helper, and `Thanh lý nội bộ` is not added to the attention preset.**
- [ ] **Step 3: Keep `EquipmentEditTransitions.ts` at `src/components/equipment-edit/EquipmentEditTransitions.ts`; do not invent an app-path duplicate. Ensure `didEnterLiquidationEndState` handles catalog liquidation independent of department while preserving old warehouse semantics.**
- [ ] **Step 4: Run the focused lifecycle suite.**

```bash
node scripts/npm-run.js run test:run -- src/components/equipment-edit/__tests__/EquipmentEditTransitions.test.ts src/components/__tests__/mobile-equipment-list-item.test.tsx src/components/__tests__/qr-action-sheet.test.tsx 'src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx' 'src/app/(app)/equipment/__tests__/equipment-liquidation-order-scope.test.ts' 'src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx'
```

### Task 7: Keep Go AI status compatibility

**Files:**

- Create: `supabase/migrations/20261009103000_ai_equipment_lookup_status_catalog.sql`
- Create: `supabase/tests/ai_equipment_status_catalog_smoke.sql`
- Modify: `supabase/db-quality-gate-tests.json`
- Modify only if descriptor/propagation cần thay: `services/ai-service/internal/qltbyt/catalog.go`, `services/ai-service/internal/qltbyt/arguments.go`, `services/ai-service/internal/qltbyt/system_prompt.txt`
- Modify if hard-coded descriptor needs compatibility: `src/lib/ai/tools/query-catalog.ts`
- Test: `services/ai-service/internal/qltbyt/arguments_test.go`
- Test: `src/lib/ai/tools/__tests__/query-catalog.test.ts`
- Test: `services/ai-service/internal/qltbyt/query_broker_test.go` and existing AI RPC/tool tests

- [ ] **Step 1: Add RED tests for `Thanh lý nội bộ`, catalog-compatible raw stored values, legacy aliases, and unknown status behavior. The Go path must pass exact stored labels or an explicitly catalog-approved alias; it must not maintain a second six-value allowlist.**
- [ ] **Step 2: Implement SQL/Go compatibility using exact catalog label trước, rồi legacy alias normalization đang có; raw known/inactive historical status được query read; unknown giữ zero-result behavior hiện hữu and preserve existing tool descriptors and requested names.**
- [ ] **Step 3: Run Go and AI-focused tests, then commit only AI files and its migration.**

```bash
go -C services/ai-service test ./internal/qltbyt/...
node scripts/npm-run.js run test:run -- src/lib/ai/tools/__tests__/query-catalog.test.ts 'src/app/api/internal/ai/broker/v1/__tests__/route.test.ts'
git add -- supabase/migrations/20261009103000_ai_equipment_lookup_status_catalog.sql supabase/tests/ai_equipment_status_catalog_smoke.sql supabase/db-quality-gate-tests.json services/ai-service/internal/qltbyt/query_broker_test.go services/ai-service/internal/qltbyt/arguments_test.go
# Stage thêm chỉ file thực sự đổi trong Files, bằng đường dẫn exact.
git commit -m "feat: keep AI equipment status filters catalog-compatible"
```

### Task 8: Repository gates and exact handoff evidence

**Files:**

- Modify only focused tests/registry when required
- Create: `tmp/YYYYMMDD/` handoff evidence if the runbook requires it

- [ ] **Step 1: Run the required order in one batch:**

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/lib/__tests__/equipment-status.test.ts src/hooks/__tests__/use-equipment-status-catalog.test.tsx src/components/equipment-edit/__tests__/EquipmentEditTransitions.test.ts src/components/__tests__/add-equipment-dialog.schema.test.ts src/components/__tests__/import-equipment-validation.test.ts src/lib/__tests__/excel-template-generation.test.ts src/components/__tests__/mobile-equipment-list-item.test.tsx src/components/__tests__/qr-action-sheet.test.tsx src/components/__tests__/equipment-distribution-summary.utils.test.ts src/components/__tests__/equipment-distribution-summary.donut.test.tsx 'src/app/(app)/equipment/_hooks/__tests__/EquipmentDataQueryParams.test.ts' 'src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts' 'src/app/(app)/equipment/_hooks/__tests__/useEquipmentData.filter-buckets.test.tsx' 'src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx' 'src/app/(app)/equipment/__tests__/equipment-liquidation-order-scope.test.ts' 'src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx' 'src/app/(app)/reports/components/__tests__/export-report-dialog.test.tsx' src/lib/ai/tools/__tests__/query-catalog.test.ts
go -C services/ai-service test ./internal/qltbyt/...
node scripts/npm-run.js run react-doctor
```

- [ ] **Step 2: Run semantic deduplication review for the new hook/helpers and record reuse decisions.**
- [ ] **Step 3: Run static and baseline-forward separately for the exact landed commit. Use the repository’s actual Oracle command shape and pinned environment from `docs/runbooks/db-quality-gate-oracle.md`; never substitute a guessed config path. Reuse documented pinned environment only; do not guess/export fingerprint. Stop with baseline-forward INCOMPLETE if missing. Command after validating existing variables:**

```bash
node -e 'for (const key of ["ORACLE_DATABASE_QUALITY_GATE_HOST", "ORACLE_DATABASE_QUALITY_GATE_SSH_USER", "ORACLE_DATABASE_QUALITY_GATE_SSH_KEY_PATH", "ORACLE_DATABASE_QUALITY_GATE_SSH_KNOWN_HOSTS_PATH", "ORACLE_DATABASE_QUALITY_GATE_SSH_HOST_KEY_FINGERPRINT"]) { if (!process.env[key]) throw new Error("Missing " + key); }'
node scripts/npm-run.js run db:quality-gate -- --lane static --run-id "equipment-status-static-$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%d%H%M%S)" --subject-commit "$(git rev-parse HEAD)"
node scripts/npm-run.js run db:quality-gate -- --lane baseline-forward --run-id "equipment-status-$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%d%H%M%S)" --subject-commit "$(git rev-parse HEAD)"
```

- [ ] **Step 4: Confirm append-only migration identity/hashes, grants/RLS, rollback evidence, no historical backfill/deletion, and no client catalog write RPC. Report static and baseline-forward independently; aggregate PASS only when both pass on the same SHA.**
- [ ] **Step 5: Commit lifecycle diff after gates, với path exact, giữ hooks.**

```bash
git add -- src/components/equipment-decommission-form.ts src/components/mobile-equipment-list-item.tsx src/components/qr-action-sheet-config.tsx src/components/qr-action-sheet-actions.tsx src/components/equipment-edit/EquipmentEditTransitions.ts src/components/equipment-edit/__tests__/EquipmentEditTransitions.test.ts src/components/__tests__/mobile-equipment-list-item.test.tsx src/components/__tests__/qr-action-sheet.test.tsx 'src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx' 'src/app/(app)/equipment/__tests__/equipment-liquidation-order-scope.test.ts' 'src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx'
git commit -m "feat: apply catalog terminal equipment lifecycle"
```

- [ ] **Step 6: Update issue status and create follow-up issues only for explicitly deferred work. Do not use broad `git add .`; list exact paths. Live apply remains outside this plan and needs operation-specific authorization through Supabase MCP.**
- [ ] **Step 7: Land và revalidate exact SHA.** Pull/rebase/push theo nhánh được user cho phép; nếu SHA đổi, chạy lại static + baseline-forward trên SHA mới trước claim aggregate PASS. Ghi SHA, migration hashes, digest/report path từng lane, control RED/candidate GREEN, focused outputs, grants/RLS, clean/up-to-date status. Không coi timeout/Oracle unavailable là PASS.

```bash
git pull --rebase
git push
git status --short --branch
```

Expected: clean và up to date with origin. Không ghi live, không áp candidate vào restored baseline. Applied-history lock chỉ append nếu có migration đã được live xác nhận riêng; candidate không được relabel là applied.

---

## Acceptance criteria

- The seven exact Vietnamese labels, including `Thanh lý nội bộ`, are catalog-backed and accepted by create/update/import; unknown/inactive values fail closed at the server boundary cho create/chuyển trạng thái; inactive đã biết không đổi vẫn sửa metadata được.
- Catalog metadata is constrained (`requires_end_date` implies terminal); terminal alone does not silently imply date or all-server action blocking.
- Existing six labels, historical rows, legacy UI action policy, and report/distribution overloads remain compatible; no auto backfill, deletion, or client catalog writes occur.
- New terminal status gets server and UI date autofill with explicit-date precedence, operational blocking, metadata-edit/permitted-restore paths, a dark-gray badge with white text, and liquidation-last ordering independent of department.
- Filters, zero-count distribution, import/template, export/report (`src/app/(app)/reports/components/export-report-dialog.utils.ts`), and Go AI status filters use the catalog/raw stored values.
- Actual SQL smoke tests cover write validation, workflow guards, and repair sync approve/complete/delete; TypeScript mocks are supplementary. Every migration source file remains below 450 lines; repair approve fails closed while authorized historical complete/delete preserve terminal label/date and applied migrations are untouched.
- Static and baseline-forward database lanes PASS on the same exact commit; TypeScript/React/Go focused gates PASS.
