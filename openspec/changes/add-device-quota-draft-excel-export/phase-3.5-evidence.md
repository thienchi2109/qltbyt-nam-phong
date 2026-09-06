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

## Final current status

Analyzer/direct-claims implementation landed at `bfbeb9a6f986081e33482ca261ac31247fb3744b`;
the tenant-mismatch SQLSTATE correction landed at
`70bc703b398fce6e3684c15fd8e5b2471b868d1a`.

TDD Red reproduced the exact direct `app_role` → `role` claim fallback being
rejected as `migration.jwt-guards`: focused Red was `27 passed / 1 failed`.
Green focused static-policy verification was `3 files / 53 tests PASS`.
Ordered gates passed: format, no-explicit-any, dedupe, typecheck, focused tests,
React Doctor `100/100`, OpenSpec strict, and `git diff --check`.

The exact-commit static result remains `FAILED`, digest
`515f8050e36f9697ce538546f40b3855950ee249d32ed4a2dcfdd65018aebfe3`, with
`warnings=1538`, `dangerous=1`, and `blocking=0`. The target
`public.don_vi_branding_get` `migration.jwt-guards` finding disappeared. The
sole dangerous finding is the unchanged
`GRANT EXECUTE ON FUNCTION public.device_quota_regulatory_catalog_get() TO authenticated`,
fingerprint `fdc544e5530ead760dec5fa4540018f3ae80ea84576bae6c095d8a7261c9469d`.
Parent/head statement SHA is
`993721bc96881ffb14bdb5e4ef74b78de97a1076c0cc44f45558876ca9886975` in both
inputs; it was not touched by the diff, so this is an exact-diff false positive,
but the static outcome remains `FAILED`.

The first Oracle run on `bfbeb9a6f986081e33482ca261ac31247fb3744b` failed with
digest `b13beac6dbdcb573358bb6e9e5c585a66cb2d5804eeed61af39654eb5fcec778`:
the candidate Phase 3.5 test returned SQLSTATE `P0001` because the
`tenant_mismatch` raise omitted `ERRCODE`. The final exact-commit Oracle run
passed with digest `361646d66e30484094690216041189bc0eca7dc389b663e583022aaf3625bdc2`,
run ID `phase35-tenant-sqlstate-70bc703b-20260906-1420`,
`requiredChecksComplete=true`, disposable SSH/Docker execution, 54 warnings,
and no candidate non-warning. The control Phase 3.5 `42501` result remains a
baseline warning while the candidate passes.

Aggregate status is `BLOCKING / INCOMPLETE` solely because static is `FAILED`.
There was no live apply/write. `tasks.md` was checked: Phase 3.5 items
3.5.1–3.5.7 and Phase 4 items 4.1–4.7 remain unchecked; no checkbox was
changed. USER REVIEW for Phase 3.5 has not been reached and Phase 4 remains
untouched.

## DB gate remediation status

Trên commit cuối đã kiểm tra `b96264c851358dfb79a0cbf449945fc5317d8a8f`,
static ghi nhận `FAILED` với digest
`90ce5caf4e2075deb8f4f6abaec9ee43adb04b40c589e17e51ff62af21b2516b`; blocker
duy nhất là `migration.jwt-guards` trên `public.don_vi_branding_get`,
fingerprint `43d25fb...`. Đây là false positive của scanner vì helper lịch sử
`_get_jwt_claim` không được bộ phân tích nhận diện dù runtime đã có guards.
Baseline-forward ghi nhận `FAILED` với digest
`bf8a2ee1012bd87accebd573d1fc0a86b78e2a5518152fb3b332559020a96d18`; test
Phase 3.5 vẫn `P0001` permission-denied, fingerprint `b76a747b...`, sau khi
đã bỏ actor lookup; statement chính xác vẫn chưa xác định và không điều tra
thêm. Aggregate là `BLOCKING / INCOMPLETE`; không có live write. Phase 3.5
gate/task và Phase 4 vẫn unchecked.

Functional gates `121/121` và các gate TS/React/OpenSpec bắt buộc đã PASS;
React Doctor đạt `93/100` với hai cảnh báo complexity đã biết. Không claim
USER REVIEW.

Migration `20260906090000_device_quota_draft_excel_export_coherence.sql` và
test `supabase/tests/device_quota_draft_excel_export_phase35.sql` đã được tạo và
đăng ký với `requiredForMigrations`, nhưng static/Oracle baseline-forward là
gate của parent và chưa được tuyên bố PASS trong bằng chứng này. Không có live
write. Luna đã sở hữu implementation và refactor trong scope; parent chỉ xác
minh/review, chạy gate, independent review và reconciliation cuối.
