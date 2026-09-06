# Bằng chứng Phase 3.5 — Coherence catalog, tenant và branding

## Phạm vi

Phase này bổ sung coherence tối thiểu giữa catalog canonical, draft export,
trusted RPC claims và branding. Migration là forward-only, không sửa migration
lịch sử và không apply hoặc ghi live DB. Phase 4 vẫn bị chặn; các checkbox task
và USER REVIEW giữ nguyên unchecked cho tới khi parent hoàn tất review và các
gate bắt buộc.

## TDD Red ban đầu

Focused Red ban đầu chạy qua `ctx_execute` với source label `execute:shell`
trên branch Phase 3.5, trước khi thêm route/branding/registry cases:

```text
node scripts/npm-run.js npx vitest run \
  'src/app/(app)/device-quota/categories/_queries/__tests__/deviceQuotaRegulatoryCatalogQuery.phase35.test.ts' \
  'src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export-context.phase35.test.ts' \
  'src/app/api/rpc/__tests__/rpc-session-claims.phase35.test.ts' --reporter verbose
```

Kết quả ban đầu là `TEST_EXIT=1`, `3 files / 7 failed tests`: parser không giữ
UUID thật và không fail khi thiếu UUID; export context vẫn tạo context khi UUID
canonical lệch hoặc thiếu; claims vẫn dùng raw `don_vi` cho target roles.

Sau đó chạy thêm Red matrix với các case route, branding và registry:

```text
node scripts/npm-run.js npx vitest run \
  'src/app/(app)/device-quota/categories/_queries/__tests__/deviceQuotaRegulatoryCatalogQuery.phase35.test.ts' \
  'src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export-context.phase35.test.ts' \
  'src/app/api/rpc/__tests__/rpc-session-claims.phase35.test.ts' \
  'src/app/api/rpc/__tests__/rpc-same-origin.unit.test.ts' \
  'src/hooks/__tests__/use-tenant-branding.test.ts' \
  'scripts/__tests__/device-quota-draft-excel-export-phase35-registry.test.ts' \
  --reporter verbose
```

Kết quả là `TEST_EXIT=1`: các failure ban đầu vẫn giữ nguyên; branding nhận
tenant `7` thay vì trusted current tenant `12`, route forward `p_don_vi=17`
thay vì `99`, và registry chưa có test path required cho migration.

Red bổ sung chạy cùng source label để cô lập hai seam còn lại:

```text
node scripts/npm-run.js npx vitest run \
  'src/hooks/__tests__/use-tenant-branding.test.ts' \
  'src/app/api/rpc/__tests__/rpc-same-origin.unit.test.ts' --reporter verbose
```

Kết quả lần đó là `BRANDING_EXIT=1` (nhận tenant `7`, cần trusted current
tenant `12`) và `ROUTE_EXIT=1` (forward `p_don_vi=17`, cần `99`). Đây là failure
hành vi đúng nguyên nhân trước khi sửa runtime.

## Green focused

- Catalog parser, export context, claims, RPC route và branding hook: `5 files /
39 tests`, `PHASE35_CAST_CLEAN_EXIT=0`, source `execute:shell` lúc 11:16 UTC.
- Adjacent export fixture và server JWT claim tests: `3 files / 32 tests`,
  `TS_ADJACENT_EXIT=0`.
- SQL registry assertion: `1 file / 1 test`, `SQL_REGISTRY_TEST_EXIT=0`, source
  `execute:shell` lúc 11:12 UTC.

Green hiện chứng minh parser giữ UUID canonical hợp lệ, fail closed với
absent/blank/malformed UUID, export context chỉ tạo khi UUID canonical và draft
trùng nhau và unit đúng, target roles dùng `current_don_vi ?? don_vi`, role
không thuộc target giữ raw `don_vi`, và JWT route không tin body tenant.

## Review follow-up Red → Green

Reviewer reproduction initially exposed the existing hook fixture contract:
four `useDeviceQuotaDraftCatalog*.test.tsx` files supplied no canonical
`catalog_version.id` and used `catalog-1`; fixtures now use one valid matching
UUID. The new hook mismatch regression first failed with `status: ready` while
the canonical and draft UUIDs differed. The stale-branding regression first
failed because `placeholderData` was `keepPreviousData`.

The focused follow-up command covered these exact paths:

```text
src/app/(app)/device-quota/categories/_queries/__tests__/deviceQuotaRegulatoryCatalogQuery.phase35.test.ts
src/app/(app)/device-quota/categories/draft-catalog/__tests__/device-quota-draft-catalog-excel-export-context.phase35.test.ts
src/app/api/rpc/__tests__/rpc-session-claims.phase35.test.ts
src/app/api/rpc/__tests__/rpc-same-origin.unit.test.ts
src/hooks/__tests__/use-tenant-branding.test.ts
scripts/__tests__/device-quota-draft-excel-export-phase35-registry.test.ts
src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.test.tsx
src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.validation.test.tsx
src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.isolation.test.tsx
src/app/(app)/device-quota/categories/_hooks/__tests__/useDeviceQuotaDraftCatalog.mutation-recovery.test.tsx
src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogExport.test.tsx
```

Kết quả `REVIEW_FINDINGS_FOCUSED_EXIT=0`: `11 files / 89 tests` pass lúc
11:37 UTC. Hook mismatch now yields no `rows`, `lastSavedRows`, editable
updates, save RPC or export context. The saved-export seam also refuses to
merge rows until UUID identity is coherent. Branding no longer carries
previous-tenant placeholder data while a new tenant query is pending. The
catalog migration now resolves `current_don_vi ?? don_vi` for global/admin/
to_qltb before actor verification; the SQL test requires an assigned-A/current-B
to_qltb fixture and exercises nonmatching-current rejection.

## Reuse and graph limits

Code Review Graph was current at base `a54d0fb930a601e79d5101e0a85c9bf69d994e98`;
its change analysis prioritized the parser/context/session-claims seams, but
new untracked tests were under-indexed and therefore do not prove coverage.
GitNexus plus `rg` found and reused `isEquipmentManagerRole`, the existing JWT
claim builder, branding guard, and Excel helpers. GitNexus also surfaced a
domain-specific `uuidValue()` decoder in technical configurations; it was not
reused because importing that typed-error/path decoder would couple this draft
catalog domain. No semantic embedding or full-graph test-coverage claim is
made.

## Còn chờ parent xác minh

## DB gate remediation status

Trên commit amended `750bccf8`, DB gate ghi nhận `static FAILED` với digest
`c474ef8c...` và `baseline-forward FAILED` với digest `f474a87d...`. Static
chặn `migration.jwt-guards` cho `don_vi_branding_get` vì bộ phân tích không
nhận diện helper lịch sử `_get_jwt_claim`; đây là false positive của scanner,
không phải thiếu guard runtime. Baseline-forward ghi nhận candidate Phase
3.5 SQL test `P0001` permission-denied sau khi fixture assigned/current đã
được tạo; nguyên nhân là branding invoker truy vấn `public.nhan_vien`, bảng
được bảo vệ khỏi role chạy test. Remediation bỏ lookup actor-table này, giữ
claim validation, tenant mismatch denial và actor verification trong catalog
SECURITY DEFINER RPC. Parent cần rerun static và baseline-forward trên commit
amended; chưa claim PASS.

Migration `20260906090000_device_quota_draft_excel_export_coherence.sql` và
test `supabase/tests/device_quota_draft_excel_export_phase35.sql` đã được tạo và
đăng ký với `requiredForMigrations`, nhưng static/Oracle baseline-forward là
gate của parent và chưa được tuyên bố PASS trong bằng chứng này. Không có live
write. Luna đã sở hữu implementation và refactor trong scope; parent chỉ xác
minh/review, chạy gate, independent review và reconciliation cuối.
