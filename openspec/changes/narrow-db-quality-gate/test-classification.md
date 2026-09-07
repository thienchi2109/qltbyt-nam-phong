# Bảng phân loại SQL test — Chunk 2 BATCH1

## Phạm vi và provenance

Đây là evidence của Chunk 2 BATCH1, chỉ phân loại 20 entry đầu tiên trong
inventory `default-safe`. Không sửa SQL test, registry, source, database,
Oracle hoặc live system trong lượt này.

- `subjectCommit`: `1940887e9fe09d2264912602e43aee3b785a06bd`
- Registry: `supabase/db-quality-gate-tests.json`
- Registry SHA-256 tại subject commit:
  `c1a2f1ceac663b815cfbf96a3c9b2551c37a46132b34464c02d524d6b6ecf477`
- Cách lấy inventory: chỉ đọc `git show
1940887e9fe09d2264912602e43aee3b785a06bd:supabase/db-quality-gate-tests.json`,
  không dùng HEAD đang trỏ động; lọc `safety == "default-safe"`, rồi sắp path
  theo thứ tự byte UTF-8 tăng dần.
- Trước khi dùng snapshot phải kiểm tra SHA-256 của đúng bytes tại subject
  commit bằng giá trị ở trên. Nếu SHA mismatch, dừng và reconcile lại
  snapshot/provenance; không tự chuyển sang HEAD mới hoặc tiếp tục phân loại.
- Registry hiện có `103` test: `77` `default-safe`, `25` `opt-in`, `1`
  `live-only`. Inventory này có đúng `77` path và không có duplicate.
- Mọi entry BATCH1 hiện giữ nguyên `safety: "default-safe"`,
  `fixtureContract: "isolated-fixture"`,
  `transactionContract: "rollback-required"`, timeout `30` giây.

`gateScope` dưới đây là đề xuất tài liệu, chưa ghi vào registry. `mixed →
core-security (temporary)` nghĩa là giữ nguyên test hỗn hợp trong selected set
cho tới Chunk 4; coverage business vẫn được giữ trong test hiện tại và phải
tách thành file migration-specific đã nêu. Test `core-security` không cần
`requiredForMigrations`; test business lịch sử không có mapping được ghi là
intentional-unmapped; mixed test giữ core coverage và ghi riêng mapping còn
thiếu cho business half. Không có test nào bị loại vì chưa có mapping.

## Snapshot path-only và batching

### Batch 1 — đã review (1–20)

1. `supabase/tests/ai_kill_switch_smoke.sql`
2. `supabase/tests/dashboard_badges_department_scope_smoke.sql`
3. `supabase/tests/dashboard_kpi_summary_smoke.sql`
4. `supabase/tests/device_quota_draft_excel_export_phase35.sql`
5. `supabase/tests/device_quota_regulatory_catalog_phase_gate.sql`
6. `supabase/tests/device_quota_unit_catalog_draft_phase_gate.sql`
7. `supabase/tests/device_quota_unit_catalog_draft_security_phase_gate.sql`
8. `supabase/tests/equipment_bulk_delete_smoke.sql`
9. `supabase/tests/equipment_department_distribution_smoke.sql`
10. `supabase/tests/equipment_department_scope_reads_smoke.sql`
11. `supabase/tests/equipment_department_scope_workflow_guards_smoke.sql`
12. `supabase/tests/equipment_filter_buckets_smoke.sql`
13. `supabase/tests/equipment_list_enhanced_active_repair_smoke.sql`
14. `supabase/tests/equipment_list_enhanced_liquidation_order_smoke.sql`
15. `supabase/tests/equipment_list_enhanced_model_search_smoke.sql`
16. `supabase/tests/equipment_soft_delete_delete_restore_audit_smoke.sql`
17. `supabase/tests/equipment_soft_delete_historical_reads_smoke.sql`
18. `supabase/tests/equipment_soft_delete_partial_unique_smoke.sql`
19. `supabase/tests/equipment_soft_delete_reports_smoke.sql`
20. `supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql`

### Batch 2 — kế tiếp (21–40), chưa review

21. `supabase/tests/header_notifications_facility_scope_smoke.sql`
22. `supabase/tests/maintenance_audit_notfound_smoke.sql`
23. `supabase/tests/maintenance_write_role_guards_smoke.sql`
24. `supabase/tests/repair_completion_time_smoke.sql`
25. `supabase/tests/repair_cost_usage_visualizations_smoke.sql`
26. `supabase/tests/repair_request_active_for_equipment_smoke.sql`
27. `supabase/tests/repair_request_cost_smoke.sql`
28. `supabase/tests/repair_request_equipment_status_invariant_smoke.sql`
29. `supabase/tests/repair_request_lifecycle_audit_smoke.sql`
30. `supabase/tests/repair_request_read_scope_smoke.sql`
31. `supabase/tests/repair_request_status_counts_overdue_summary_smoke.sql`
32. `supabase/tests/session_authorization_profile_for_jwt_smoke.sql`
33. `supabase/tests/technical_configuration_authorized_user_guard_phase_gate.sql`
34. `supabase/tests/technical_configuration_baseline_cross_dossier_copy_phase_gate.sql`
35. `supabase/tests/technical_configuration_baseline_documents_phase_gate.sql`
36. `supabase/tests/technical_configuration_baseline_hierarchy_import_apply_phase_gate.sql`
37. `supabase/tests/technical_configuration_baseline_hierarchy_import_apply_security_phase_gate.sql`
38. `supabase/tests/technical_configuration_baseline_hierarchy_import_preview_phase_gate.sql`
39. `supabase/tests/technical_configuration_baseline_hierarchy_import_preview_security_phase_gate.sql`
40. `supabase/tests/technical_configuration_baseline_hierarchy_mutations_phase_gate.sql`

### Batch 3 — chưa review (41–60)

41. `supabase/tests/technical_configuration_baseline_hierarchy_server_activation_security_gate.sql`
42. `supabase/tests/technical_configuration_baseline_hierarchy_snapshots_phase_gate.sql`
43. `supabase/tests/technical_configuration_baseline_import_atomicity_phase_gate.sql`
44. `supabase/tests/technical_configuration_baseline_import_phase_gate.sql`
45. `supabase/tests/technical_configuration_comparison_phase_gate.sql`
46. `supabase/tests/technical_configuration_comparison_set_read_phase_gate.sql`
47. `supabase/tests/technical_configuration_copy_reentrant_workspace_phase_gate.sql`
48. `supabase/tests/technical_configuration_dossier_delete_audit_failure_phase_gate.sql`
49. `supabase/tests/technical_configuration_dossier_delete_audit_phase_gate.sql`
50. `supabase/tests/technical_configuration_dossier_delete_phase_gate.sql`
51. `supabase/tests/technical_configuration_dossier_search_phase_gate.sql`
52. `supabase/tests/technical_configuration_evaluation_criteria_filter_phase_gate.sql`
53. `supabase/tests/technical_configuration_evaluation_hierarchy_order_phase_gate.sql`
54. `supabase/tests/technical_configuration_evaluation_hierarchy_order_security_phase_gate.sql`
55. `supabase/tests/technical_configuration_expert_account_assignment_phase_gate.sql`
56. `supabase/tests/technical_configuration_expert_account_scope_phase_gate.sql`
57. `supabase/tests/technical_configuration_expert_account_scope_review_regression.sql`
58. `supabase/tests/technical_configuration_manual_assessments_phase_gate.sql`
59. `supabase/tests/technical_configuration_option_documents_phase_gate.sql`
60. `supabase/tests/technical_configuration_option_import_phase_gate.sql`

### Batch 4 — chưa review (61–77)

61. `supabase/tests/technical_configuration_option_responses_constraints_phase_gate.sql`
62. `supabase/tests/technical_configuration_option_responses_phase_gate.sql`
63. `supabase/tests/technical_configuration_options_phase_gate.sql`
64. `supabase/tests/technical_configuration_reference_products_phase_gate.sql`
65. `supabase/tests/technical_configuration_reference_ranking_phase_gate.sql`
66. `supabase/tests/technical_configuration_result_export_axes_pagination_phase_gate.sql`
67. `supabase/tests/technical_configuration_result_export_axes_phase_gate.sql`
68. `supabase/tests/technical_configuration_result_export_manifest_phase_gate.sql`
69. `supabase/tests/technical_configuration_result_export_pages_phase_gate.sql`
70. `supabase/tests/technical_configuration_suppliers_phase_gate.sql`
71. `supabase/tests/transfer_external_location_sync_smoke.sql`
72. `supabase/tests/transfer_request_delete_tenant_cast_smoke.sql`
73. `supabase/tests/transfer_request_lifecycle_audit_smoke.sql`
74. `supabase/tests/transfer_request_page_data_overdue_summary_smoke.sql`
75. `supabase/tests/unused_equipment_report_smoke.sql`
76. `supabase/tests/usage_log_split_status_smoke.sql`
77. `supabase/tests/user_create_role_allowlist_phase_gate.sql`

## Evidence phân loại BATCH1

Các line reference dưới đây lấy từ SQL test tại exact subject commit. Chúng
chỉ các assertion thực tế, không chỉ JWT hoặc tenant fixture setup. Một line
fixture đơn lẻ không được coi là tenant assertion.

### 1. `ai_kill_switch_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent, so an
  eventual migration-specific split is intentional-unmapped unless a later
  review adds an exact migration mapping.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: global/admin/service-role authorization and normalization
  (`50–63`, `83–112`); missing app role/claims/role/user ID and non-global
  write denial with SQLSTATE `42501` (`128–209`).
- Business to extract: default state/reason and enable/disable behavior
  (`22–30`, `50–63`), plus NULL/blank reason input semantics
  (`226–256`).
- Coverage and extraction: retain the whole current test now. Proposed Chunk 4
  files are
  `supabase/tests/ai_kill_switch_smoke_core_security.sql` and
  `supabase/tests/ai_kill_switch_smoke_migration_specific.sql`. Exact split of
  the global write assertions remains mixed/unresolved until the SQL blocks are
  separated.

### 2. `dashboard_badges_department_scope_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần business giữ nguyên coverage và chờ mapping khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: cross-tenant denial and SQLSTATE `42501` (`205–228`),
  blank department fail-closed behavior (`231–263`), selected-facility/global
  tenant isolation (`266–301`), regional-leader role behavior
  (`304–321`), and pinned `search_path` (`340`).
- Business to extract: dashboard, notification and maintenance badge count
  values (`171–202`, with the global count assertions in `278–301` reviewed
  as the mixed boundary).
- Coverage and extraction: retain all count and isolation assertions. Proposed
  files:
  `supabase/tests/dashboard_badges_department_scope_smoke_core_security.sql`
  and
  `supabase/tests/dashboard_badges_department_scope_smoke_migration_specific.sql`.
  The count-vs-isolation boundary is unresolved pending Chunk 4 extraction.

### 3. `dashboard_kpi_summary_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent, an
  intentional-unmapped historical business test.
- Proposed scope: `migration-specific`.
- Business assertions: object shape and required response keys (`76–87`),
  then equipment, maintenance, repair-request and draft-plan counts
  (`89–103`). Lines `66–74` only install JWT fixture claims; they are not
  tenant assertions.
- Coverage: retain the business smoke test for a future exact migration mapping;
  no security extraction file is proposed.

### 4. `device_quota_draft_excel_export_phase35.sql`

- Registry: `phase-gate`, `default-safe`; `requiredForMigrations` is exactly
  `supabase/migrations/20260906090000_device_quota_draft_excel_export_coherence.sql`,
  and that path exists at `subjectCommit`.
- Proposed scope: `mixed → core-security (temporary)`; the exact migration
  mapping remains recorded for the eventual business half.
- Security kept: expected error/SQLSTATE helper and actor/tenant claim checks
  (`6–27`, `91–160`), canonical cross-tenant branding guards
  (`181–209`).
- Business to extract: canonical UUID/catalog identity and branded tenant
  response behavior (`106`, `181–209`); fixture ASSERTs at `65`, `74`,
  and `89` are setup preconditions, not standalone security assertions.
- Coverage and extraction: keep the mapped phase gate selected and preserve all
  assertions. Proposed files:
  `supabase/tests/device_quota_draft_excel_export_phase35_core_security.sql`
  and
  `supabase/tests/device_quota_draft_excel_export_phase35_migration_specific.sql`.
  The UUID-vs-tenant-branding boundary is unresolved pending Chunk 4.

### 5. `device_quota_regulatory_catalog_phase_gate.sql`

- Registry: `phase-gate`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần catalog business giữ nguyên coverage và chờ mapping khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security/migration-integrity assertions kept: RLS and direct table privilege
  denial (`31–58`), `SECURITY DEFINER` plus pinned `search_path` and
  EXECUTE grants (`127–140`), mutation denial (`145–154`), and
  missing/malformed/unsupported JWT rejection with SQLSTATE handling
  (`227–276`).
- Business to extract: canonical ready snapshot, source order, frozen counts
  and item names (`71–122`, `190–224`).
- Coverage and extraction: preserve both security and catalog contracts. Proposed
  files:
  `supabase/tests/device_quota_regulatory_catalog_phase_gate_core_security.sql`
  and
  `supabase/tests/device_quota_regulatory_catalog_phase_gate_migration_specific.sql`.
  The catalog-content boundary is unresolved pending Chunk 4.

### 6. `device_quota_unit_catalog_draft_phase_gate.sql`

- Registry: `phase-gate`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần draft business giữ nguyên coverage và chờ mapping khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: authenticated/anon direct table denial, RPC EXECUTE grants and
  pinned `search_path` (`34–58`), missing-claims denial (`61–65`), and
  role-based mutation denial (`69–77`).
- Business to extract: draft save/reentrant stale-state behavior
  (`112–161`) and the create/open response contract (`61–112`) where it is
  not an authorization assertion.
- Coverage and extraction: retain all draft lifecycle assertions. Proposed
  files:
  `supabase/tests/device_quota_unit_catalog_draft_phase_gate_core_security.sql`
  and
  `supabase/tests/device_quota_unit_catalog_draft_phase_gate_migration_specific.sql`.
  The stale-save boundary is unresolved pending Chunk 4.

### 7. `device_quota_unit_catalog_draft_security_phase_gate.sql`

- Registry: `phase-gate`, `default-safe`; `requiredForMigrations` absent, but
  this is a security contract and does not need a migration mapping.
- Proposed scope: `core-security`.
- Security assertions: the expected-error calls exercise JWT actor/role
  authorization (`178–237`, `281–332`); cross-tenant and unauthorized draft
  operations must fail, and authenticated/anon direct table access must fail
  (`253–262`). The helper validates exact expected SQLSTATE and message
  (`3–34`).
- Coverage: keep the entire test as core security. No business extraction file
  is proposed; no unsupported tenant inference is made from setup-only lines.

### 8. `equipment_bulk_delete_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần bulk-delete business giữ nguyên coverage và chờ mapping ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: missing `don_vi` claim and `42501` (`191–214`),
  cross-tenant and mixed-ID not-found behavior with unchanged rows
  (`228–313`).
- Business to extract: successful deletion/audit, deduplication, empty input,
  already-deleted guard, rollback and max-size validation (`69–179`,
  `328–332`).
- Coverage and extraction: retain every deletion and isolation assertion.
  Proposed files:
  `supabase/tests/equipment_bulk_delete_smoke_core_security.sql` and
  `supabase/tests/equipment_bulk_delete_smoke_migration_specific.sql`.
  The all-or-nothing behavior around the tenant guard remains mixed/unresolved.

### 9. `equipment_department_distribution_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần business giữ nguyên coverage và chờ mapping khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: role-user scoped distribution (`174–193`) and the associated
  tenant/department isolation check. Fixture inserts alone at `15–105` are
  not counted as security assertions.
- Business to extract: department bucket counts and selected filter result
  (`115–171`).
- Coverage and extraction: retain the complete aggregation and scope contract.
  Proposed files:
  `supabase/tests/equipment_department_distribution_smoke_core_security.sql`
  and
  `supabase/tests/equipment_department_distribution_smoke_migration_specific.sql`.
  The single role-user count assertion is mixed/unresolved pending Chunk 4.

### 10. `equipment_department_scope_reads_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần business giữ nguyên coverage và chờ mapping khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: same-department allow and same-tenant cross-department deny
  with `42501` (`158–230`), scoped option derivation (`239–283`), blank
  claim fail-closed behavior (`286–369`), missing-claim denial
  (`376–419`), admin/global control behavior (`422–450`), and helper
  `search_path` pinning (`463`).
- Business to extract: normalization equivalence and NULL/blank semantics
  (`28–54`), while preserving the read result assertions that prove scope.
- Coverage and extraction: retain all read, option, and ACL assertions. Proposed
  files:
  `supabase/tests/equipment_department_scope_reads_smoke_core_security.sql`
  and
  `supabase/tests/equipment_department_scope_reads_smoke_migration_specific.sql`.
  Normalization-vs-scope boundaries are unresolved pending Chunk 4.

### 11. `equipment_department_scope_workflow_guards_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần business giữ nguyên coverage và chờ mapping khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: role-user cross-department, NULL-equipment, blank department,
  missing user and missing tenant claim denials with `42501`
  (`317–474`, `494–524`, `543–621`, `656–724`), plus missing role/user
  guard checks (`728–732`).
- Business to extract: same-department create success and persisted row
  behavior (`147–192`), and preserved non-user behavior (`248–297`).
- Coverage and extraction: retain all workflow and no-persistence checks.
  Proposed files:
  `supabase/tests/equipment_department_scope_workflow_guards_smoke_core_security.sql`
  and
  `supabase/tests/equipment_department_scope_workflow_guards_smoke_migration_specific.sql`.
  The no-persistence assertions are mixed with authorization and remain
  unresolved pending Chunk 4.

### 12. `equipment_filter_buckets_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần business giữ nguyên coverage và chờ mapping khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: cross-tenant/deleted bucket exclusion (`161–185`), role-user
  department scope and leak prevention (`282–314`), and blank claim
  fail-closed buckets (`317–336`).
- Business to extract: bucket shape, status/search filtering and fallback-label
  cascade (`161–279`), retaining the security-relevant filters in the current
  test until split.
- Coverage and extraction: preserve all filter and scope assertions. Proposed
  files:
  `supabase/tests/equipment_filter_buckets_smoke_core_security.sql` and
  `supabase/tests/equipment_filter_buckets_smoke_migration_specific.sql`.
  Filter-vs-isolation assertions are unresolved pending Chunk 4.

### 13. `equipment_list_enhanced_active_repair_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần business giữ nguyên coverage và chờ mapping khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: cross-tenant equipment must not leak (`159`), while global
  tenant-B behavior is explicitly checked (`163–170`).
- Business to extract: no-history/completed-only/active/latest-active and
  soft-deleted equipment selection (`102–151`).
- Coverage and extraction: retain all active-repair and tenant assertions.
  Proposed files:
  `supabase/tests/equipment_list_enhanced_active_repair_smoke_core_security.sql`
  and
  `supabase/tests/equipment_list_enhanced_active_repair_smoke_migration_specific.sql`.
  The global list result combines scope and business selection and is unresolved
  pending Chunk 4.

### 14. `equipment_list_enhanced_liquidation_order_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent, an
  intentional-unmapped historical business test.
- Proposed scope: `migration-specific`.
- Business assertions: liquidation ordering codes and expected total
  (`47–62`, `220`). JWT setup at `16–30` is only fixture setup and has no
  tenant/ACL assertion.
- Coverage: retain the ordering behavior for a future exact migration mapping;
  no security extraction file is proposed.

### 15. `equipment_list_enhanced_model_search_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent, an
  intentional-unmapped historical business smoke test.
- Proposed scope: `migration-specific`.
- Business assertions: searchable model-only equipment availability (`38`)
  and model-search result contract (`52–78`). Global-role setup at
  `41–49` is not itself an authorization assertion.
- Coverage: retain the complete search smoke test; no security extraction file
  is proposed.

### 16. `equipment_soft_delete_delete_restore_audit_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần business giữ nguyên coverage và chờ mapping khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: inactive-tenant restore denial and error contract
  (`87–99`); this is retained as tenant lifecycle protection pending a
  narrower review.
- Business to extract: delete/restore state transitions and audit row counts
  (`41–82`).
- Coverage and extraction: retain all state and guard assertions. Proposed files:
  `supabase/tests/equipment_soft_delete_delete_restore_audit_smoke_core_security.sql`
  and
  `supabase/tests/equipment_soft_delete_delete_restore_audit_smoke_migration_specific.sql`.
  The inactive-tenant guard's security-vs-domain boundary is unresolved pending
  Chunk 4.

### 17. `equipment_soft_delete_historical_reads_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần business giữ nguyên coverage và chờ mapping khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: regional-leader allowed/blocked tenant scope
  (`315–352`) and function-level `search_path` assertion (`432`).
- Business to extract: historical soft-deleted reads and wildcard escaping
  (`132–226`, `355–414`).
- Coverage and extraction: retain every historical-read and scope assertion.
  Proposed files:
  `supabase/tests/equipment_soft_delete_historical_reads_smoke_core_security.sql`
  and
  `supabase/tests/equipment_soft_delete_historical_reads_smoke_migration_specific.sql`.
  The legacy/new usage-log assertions that also inspect scope remain unresolved
  pending Chunk 4.

### 18. `equipment_soft_delete_partial_unique_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent.
  Core migration-integrity không cần mapping; không ghi entry này là
  intentional-unmapped vì nó là core coverage.
- Proposed scope: `core-security` (migration integrity).
- Migration-integrity assertions: code reuse after soft-delete, active duplicate
  rejection and restore conflict behavior (`52–118`, `127–152`), and exact
  old constraint removal plus partial unique index definition (`84–100`).
- Coverage: keep the whole test as core migration-integrity coverage; no
  extraction file is proposed and no `requiredForMigrations` backfill is made
  in this chunk.

### 19. `equipment_soft_delete_reports_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent and
  Phần core-security tạm thời không cần mapping; phần report business giữ nguyên coverage và chờ mapping ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`.
- Security kept: report scope, blocked-tenant exclusion, and admin/global scope
  assertions (`315–539`, `566–599`, `631–736`), including JWT role
  transitions around `604–729`.
- Business to extract: soft-deleted equipment/report exclusion and returned
  report counts (`183–285`, `617–653`, `674–736`). The dynamic
  `RAISE EXCEPTION` bodies at the cited lines are assertion sites; exact
  sub-assertion grouping is marked unresolved until Chunk 4 reads the
  surrounding blocks for extraction.
- Coverage and extraction: retain the complete report test now. Proposed files:
  `supabase/tests/equipment_soft_delete_reports_smoke_core_security.sql` and
  `supabase/tests/equipment_soft_delete_reports_smoke_migration_specific.sql`.
  No assertion is silently excluded.

### 20. `equipment_soft_delete_workflow_guards_smoke.sql`

- Registry: `smoke`, `default-safe`; `requiredForMigrations` absent, an
  intentional-unmapped historical business workflow test.
- Proposed scope: `migration-specific`.
- Business assertions: repair/transfer create, transfer update and usage-session
  start must reject soft-deleted equipment with the expected `P0002` contract
  (`75–196`); the admin-role variant preserves the same soft-delete guard
  (`204–238`). JWT setup at `63–68` is fixture setup only.
- Coverage: retain all soft-delete workflow guards for future exact migration
  mapping; no security extraction file is proposed.

## Trạng thái BATCH1 và evidence chưa giải quyết

- Đã review: `20/20` entry của BATCH1; còn `57` entry chưa review trong
  BATCH2–4.
- Số lượng đề xuất: `2` `core-security`, `4` `migration-specific`, và
  `14` test mixed tạm thời giữ trong core-security.
- `requiredForMigrations`: một path được khai báo trong BATCH1 và hợp lệ tại
  exact subject commit; trong 19 entry còn lại, 2 core-security không cần
  mapping, 4 migration-specific là intentional-unmapped lịch sử, và 13 mixed
  đang giữ tạm core với business mapping chờ Chunk 4. Declared-path invalid
  count là `0` cho BATCH1.
- `14` dòng mixed là phần extraction chưa giải quyết được ghi rõ cho Chunk 4.
  Toàn bộ test hiện tại vẫn giữ coverage; tài liệu này không backfill mapping,
  sửa SQL hoặc loại assertion.
- BATCH2 (path 21–40) là đơn vị review tiếp theo. BATCH3 và BATCH4 vẫn giữ
  nguyên trạng và đang chờ.
- Artifact BATCH1 này không tuyên bố thay đổi selector, registry, static lane,
  baseline-forward hoặc Oracle behavior.
