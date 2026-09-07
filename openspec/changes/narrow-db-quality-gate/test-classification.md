# Bảng phân loại SQL test — Chunk 2 BATCH1–4

## Phạm vi và provenance

Đây là evidence của Chunk 2 BATCH1–4, đã phân loại đủ 77 entry trong
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
- Mọi entry BATCH1–2 hiện giữ nguyên `safety: "default-safe"`,
  `fixtureContract: "isolated-fixture"`,
  `transactionContract: "rollback-required"`; timeout được ghi theo từng
  entry từ registry tại subject commit (BATCH2 có phase-gate 90 giây ở path
  33–34, các path còn lại 30 giây).

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

### Batch 2 — đã review (21–40)

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

## Evidence phân loại BATCH2

Các entry dưới đây được đối chiếu với registry và SQL tại exact
`subjectCommit`. Dòng fixture chỉ tạo JWT/tenant không được tính là security
assertion. Với `migration-specific` lịch sử không có mapping, ghi rõ
`intentional-unmapped`, giữ ngoài default lane và không backfill. Với test
mixed, giữ toàn bộ coverage hiện tại trong core tạm thời; file tách ở Chunk 4
chỉ là hướng đi tương lai, chưa tạo hoặc sửa SQL.

### 21. `header_notifications_facility_scope_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây.
  `requiredForMigrations` absent; phần core không cần mapping và phần business
  chưa có mapping exact để backfill.
- Proposed scope: `mixed → core-security (temporary)`. Security assertion là
  global gọi toàn hệ thống và facility-scoped phải trả số repair badge khác
  nhau (`93–103`), regional leader cũng phải phân biệt all-facility với
  facility A (`118–125`). Các kiểm tra routine phải join đúng equipment và
  không dùng `LEFT JOIN` làm phình count (`131–135`).
- Business to extract: contract số lượng badge trong payload global/regional
  (`93–125`), sau khi tách khỏi phần scope. Đây là boundary chưa chốt vì cùng
  một response vừa chứng minh count vừa chứng minh isolation.
- Coverage và hướng tách: giữ nguyên toàn bộ test hiện tại. Chunk 4 có thể
  tạo `supabase/tests/header_notifications_facility_scope_smoke_core_security.sql`
  và `supabase/tests/header_notifications_facility_scope_smoke_migration_specific.sql`;
  không assertion nào bị loại hoặc được coi là security chỉ vì fixture.

### 22. `maintenance_audit_notfound_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared path để validate.
- Proposed scope: `migration-specific`. Đây là historical business test
  `intentional-unmapped`: mapping trống có rationale, giữ ngoài default lane,
  không ép backfill. Test không có assertion ACL/tenant denial; JWT
  `to_qltb` ở `37–44` chỉ là fixture setup.
- Actual assertions: task không tồn tại phải raise `P0002` (`48–68`); tạo
  maintenance plan phải sinh đúng một audit row và giữ `entity_label`,
  `loai_cong_viec`, `khoa_phong` (`115–141`).
- Coverage: giữ nguyên not-found và audit-detail behavior cho một migration
  tương lai nếu được review thêm mapping exact; chưa đề xuất core extraction.

### 23. `maintenance_write_role_guards_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Phần core không cần mapping; business half
  chỉ được map exact khi tách ở Chunk 4.
- Proposed scope: `mixed → core-security (temporary)`. Security giữ allow
  contract của `to_qltb` và các write/delete được phép (`86–191`), từ chối
  `admin`/`global` bằng `42501` (`191–221`), từ chối `user`/`regional_leader`
  trên create/update/approve/reject/task operations (`223–387`), và từ chối
  cross-tenant hoặc mismatched-equipment mutations (`391–461`).
- Business to extract: tạo/cập nhật/approve/reject maintenance plan, bulk task
  insert/update/complete/delete và xác nhận task được lưu/xóa (`102–191`).
  Ranh giới allow-role với workflow persistence còn mixed.
- Coverage và hướng tách: giữ toàn bộ role, tenant và workflow assertions.
  Chunk 4 có thể tạo
  `supabase/tests/maintenance_write_role_guards_smoke_core_security.sql` và
  `supabase/tests/maintenance_write_role_guards_smoke_migration_specific.sql`;
  không backfill mapping trong lượt này.

### 24. `repair_completion_time_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Core không cần mapping; phần report business
  chưa có mapping exact.
- Proposed scope: `mixed → core-security (temporary)`. Security assertion là
  report của admin/global khi truyền `p_don_vi` vẫn chỉ có facility-scoped
  completion total `8` (`348–356`). Không tính các `set_config` JWT ở `17–30`
  như assertion.
- Business to extract: presence/removal của payload keys (`243–251`), stats
  total/median/p90/average/on-time/threshold và sáu bucket (`255–313`),
  monthly completion range/total và các key report cũ (`317–345`).
- Coverage và hướng tách: giữ toàn bộ visualization payload cùng scope guard.
  Chunk 4 có thể tạo
  `supabase/tests/repair_completion_time_smoke_core_security.sql` và
  `supabase/tests/repair_completion_time_smoke_migration_specific.sql`;
  boundary payload-vs-facility scope được đánh dấu unresolved.

### 25. `repair_cost_usage_visualizations_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Core migration-integrity không cần mapping;
  report business chưa có mapping exact.
- Proposed scope: `mixed → core-security (temporary)`. Security/migration
  integrity giữ schema `chi_phi_sua_chua` nullable `numeric(14,2)`, không
  default, non-negative constraint và type compatibility (`42–106`), cùng
  other-tenant exclusion cho non-global và facility-scoped admin/global
  (`432–451`). Fixture JWT ở `17–20` không phải assertion.
- Business to extract: top repair-cost rows, sorting, usage/cumulative points,
  camelCase/dataQuality, totals and existing report keys (`328–429`). Ranh
  giới schema/tenant guard với visualization payload chờ Chunk 4.
- Coverage và hướng tách: giữ nguyên toàn bộ schema, report, NULL-aware cost và
  tenant assertions. Có thể tạo
  `supabase/tests/repair_cost_usage_visualizations_smoke_core_security.sql`
  và `supabase/tests/repair_cost_usage_visualizations_smoke_migration_specific.sql`;
  chưa sửa SQL/registry.

### 26. `repair_request_active_for_equipment_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Core không cần mapping; selection business
  chưa có mapping exact.
- Proposed scope: `mixed → core-security (temporary)`. Security giữ soft-delete
  equipment bị loại (`100–105`), cross-tenant user không đọc được (`119–124`)
  và global role được đọc cross-tenant khi đúng contract (`128–134`). Đây là
  assertion thực tế; claim setup không được tính riêng.
- Business to extract: equipment chỉ có completed history trả rỗng, nhiều
  active request trả request mới nhất và tie-break `id DESC` khi cùng
  `ngay_duyet` (`91–118`, `137–159`). Các count/result này đang trộn với
  tenant scope.
- Coverage và hướng tách: giữ toàn bộ soft-delete, tenant/global, active
  selection và tie-break coverage. Chunk 4 có thể tạo
  `supabase/tests/repair_request_active_for_equipment_smoke_core_security.sql`
  và `supabase/tests/repair_request_active_for_equipment_smoke_migration_specific.sql`;
  boundary selection-vs-scope còn unresolved.

### 27. `repair_request_cost_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Schema/auth core không cần mapping; cost
  report business chưa có mapping exact.
- Proposed scope: `mixed → core-security (temporary)`. Migration-integrity
  assertions giữ nullable `numeric(14,2)`, không default và non-negative check
  (`74–119`); security giữ missing-claims và wrong-tenant rejection với
  `42501` (`286–349`).
- Business to extract: NULL/zero/positive cost semantics và invalid/repeated
  completion (`125–285`), list/detail/report/stats cost totals and averages
  (`351–468`), cùng blank/control-character no-mutation contracts
  (`474–604`).
- Coverage và hướng tách: giữ toàn bộ schema, authorization, cost storage,
  report và no-mutation assertions. Chunk 4 có thể tạo
  `supabase/tests/repair_request_cost_smoke_core_security.sql` và
  `supabase/tests/repair_request_cost_smoke_migration_specific.sql`; mapping
  business không được backfill trong batch này.

### 28. `repair_request_equipment_status_invariant_smoke.sql`

- Registry hiện tại: `purpose: "invariant"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Đây là historical business/invariant test
  `intentional-unmapped`, không có canonical declared path để validate và giữ
  ngoài default lane.
- Proposed scope: `migration-specific`. Actual assertions chỉ kiểm tra
  equipment status transitions và restore snapshot: complete/delete và sibling
  open request (`31–204`), baseline restore (`209–281`), failed/FIFO clusters
  (`284–484`), current cluster and legacy NULL snapshot (`487–684`), follow-up
  sau failed repair (`684–779`).
- JWT `to_qltb` ở các block (`70`, `169`, `245`, `322`, `436`, `525`, `667`,
  `721`) chỉ tạo execution fixture; không có ACL, tenant mismatch hoặc
  authorization denial assertion để giữ trong core.
- Coverage: giữ nguyên toàn bộ invariant workflow cho mapping exact tương lai;
  không đề xuất security extraction và không sửa SQL/registry.

### 29. `repair_request_lifecycle_audit_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Audit/fail-closed core không cần mapping;
  lifecycle business half chưa có mapping exact.
- Proposed scope: `mixed → core-security (temporary)`. Security/integrity giữ
  audit row count, persisted audit details và equipment history cho update,
  approve, complete, delete (`8–291`, `294–436`), cùng fail-closed khi
  `audit_log` trả `FALSE`: không mutate request/history/audit ở update
  (`928–1056`), approve (`1059–1169`) và create (`1172–1270`). Pinned
  `search_path` của temporary audit helper được giữ ở `938`.
- Business to extract: lifecycle transitions, audit field values, equipment
  status/history, duplicate completion/approve-after-terminal and delete
  behavior (`8–925`). Ranh giới audit security với field-level business audit
  details còn unresolved.
- Coverage và hướng tách: giữ toàn bộ audit, history, terminal-state và
  fail-closed assertions. Chunk 4 có thể tạo
  `supabase/tests/repair_request_lifecycle_audit_smoke_core_security.sql` và
  `supabase/tests/repair_request_lifecycle_audit_smoke_migration_specific.sql`;
  JWT setup ở các block không tự nâng scope.

### 30. `repair_request_read_scope_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Không có migration mapping cần validate.
- Proposed scope: `core-security`. Đây là read-scope contract thuần security:
  same-tenant/same-department allow và list/active result đúng (`171–208`),
  cross-department/cross-tenant fail-closed với `42501` hoặc rỗng
  (`210–274`), missing department fail-closed (`276–312`), non-user tenant
  role/global compatibility (`316–347`), missing role claim (`348–390`) và
  missing user-id claim (`394–437`).
- Không có business workflow assertion độc lập; các row/count result chỉ là
  bằng chứng isolation của ba RPC. `set_config`/fixture claims không được
  tính là security assertion riêng.
- Coverage: giữ toàn bộ test trong core-security, không cần file migration
  extraction và không cần `requiredForMigrations`.

### 31. `repair_request_status_counts_overdue_summary_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Core scope/search handling không cần mapping;
  counts business chưa có mapping exact.
- Proposed scope: `mixed → core-security (temporary)`. Security giữ role/facility
  boundaries: global explicit facility (`191–207`), regional leader A+B nhưng
  không C và filter facility B (`209–219`), tenant chỉ facility A (`221–227`),
  department user loại Khoa B và departmentless fail-closed về zero
  (`229–241`). Sanitized literal `%` search giữ ở `243–247` vì chứng minh
  không mở rộng ILIKE ngoài marker.
- Business to extract: status counts và overdue summary shape/values trong
  từng scenario (`193–227`, `231–255`), sau khi tách phần scope. Các count
  vừa là kết quả nghiệp vụ vừa là bằng chứng isolation nên boundary còn
  unresolved.
- Coverage và hướng tách: giữ toàn bộ role, facility, department, search và
  date-range assertions. Chunk 4 có thể tạo
  `supabase/tests/repair_request_status_counts_overdue_summary_smoke_core_security.sql`
  và `supabase/tests/repair_request_status_counts_overdue_summary_smoke_migration_specific.sql`;
  chưa backfill mapping.

### 32. `session_authorization_profile_for_jwt_smoke.sql`

- Registry hiện tại: `purpose: "invariant"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Đây là core JWT/RPC security, không cần
  migration mapping.
- Proposed scope: `core-security`. RPC phải trả profile authoritative cho
  đúng `user_id` claim và không trả row cho user không tồn tại (`64–81`,
  `96–102`). Missing claims, thiếu/mismatch/malformed/overflow user id,
  unsupported app role và malformed JWT phải fail với `42501`
  (`103–224`); database role unsupported/blank cũng bị từ chối (`241–267`).
- Routine posture giữ `SECURITY DEFINER`, pinned `search_path` và ACL
  `PUBLIC/anon` bị revoke, chỉ authenticated/service_role được EXECUTE
  (`269–326`). Các `UPDATE` fixture role ở `28–29`, `241–255` không tự là
  authorization assertion.
- Coverage: giữ nguyên toàn bộ test core-security; không tách business file và
  không cần `requiredForMigrations`.

### 33. `technical_configuration_authorized_user_guard_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `90` giây;
  `requiredForMigrations` absent. Core guard không cần mapping.
- Proposed scope: `core-security`. Test xác nhận canonical guard tồn tại,
  `SECURITY DEFINER`, pinned `search_path`, không public/anon/authenticated
  EXECUTE và vẫn cho service role (`101–148`). Missing claims, wrong/missing
  actor claims và denied roles phải bị permission denied; global/admin/chuyên
  gia được canonical guard và compatibility wrapper chấp nhận (`151–225`).
- Migration-integrity assertions tiếp tục khóa wrapper không parse JWT trùng,
  preview metadata guard không duplicate parser và transitive RPC graph không
  lộ execute ngoài allow-list (`235–292`, `347–355`). Đây là assertion routine
  thực tế; `set_claims` ở `16–31` chỉ là helper.
- Coverage: giữ toàn bộ guard, ACL, parser-deduplication và transitive graph
  coverage trong core-security; không đề xuất extraction/mapping.

### 34. `technical_configuration_baseline_cross_dossier_copy_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `90` giây;
  `requiredForMigrations` đúng canonical path
  `supabase/migrations/20260830090000_technical_configuration_copy_reentrant_workspace.sql`,
  path tồn tại tại `subjectCommit`, nên mapping hợp lệ. Path này được giữ
  nguyên; không backfill hoặc đổi registry.
- Proposed scope: `migration-specific`. Đây là phase gate business/integrity
  cho source listing, preview/apply cross-dossier, lineage, replacement và
  atomic rollback: archived source được chọn còn draft/same-target bị loại
  (`252–286`); create/replacement phải copy đúng counts, roots và linked
  domains (`290–432`); stale preview/fingerprint errors phải giữ nguyên target
  snapshot (`337–387`).
- Không có assertion ACL/JWT/tenant denial: `set_claims` global ở `32–39` chỉ
  là execution fixture. Cross-dossier boundary ở đây là workflow contract,
  không tự suy ra authorization.
- Coverage: giữ nguyên toàn bộ mapped phase gate và chỉ chọn khi pending path
  khớp exact; chưa đề xuất core extraction.

### 35. `technical_configuration_baseline_documents_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Security core không cần mapping; document
  workflow business chưa có mapping exact.
- Proposed scope: `mixed → core-security (temporary)`. Security giữ deny-all
  RLS và table ACL cho public/anon/authenticated, service_role grants
  (`70–96`), routine `SECURITY DEFINER`/pinned `search_path`/EXECUTE grants
  (`100–126`), missing role và denied-role errors (`172–196`).
- Business to extract: baseline/reference document create, citation upsert and
  reuse, pagination/version isolation, cascade delete, stale revision,
  archived/locked immutability và copy remapping (`197–445`).
- Coverage và hướng tách: giữ toàn bộ ACL, auth, document/citation, revision,
  copy và delete assertions. Chunk 4 có thể tạo
  `supabase/tests/technical_configuration_baseline_documents_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_baseline_documents_phase_gate_migration_specific.sql`;
  boundary security-vs-workflow chờ extraction thật.

### 36. `technical_configuration_baseline_hierarchy_import_apply_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Đây là historical phase-gate business test
  `intentional-unmapped`; không có declared canonical path để validate và giữ
  ngoài default lane.
- Proposed scope: `migration-specific`. Rejected stale revision, tampered identity,
  validation error và injected failure phải giữ nguyên hierarchy snapshot
  (`65–108`, `231–275`). Apply thành công phải parity với preview/snapshot và
  đúng effect counts (`277–301`); group/subgroup/criterion identity, delete,
  membership, sequential code allocation và revision increment phải đúng
  (`302–413`). Empty-tree replacement phải delete đúng tree và tăng revision
  đúng một lần (`415–445`).
- Không có ACL/tenant denial assertion; `set_claims('global', ...)` ở helper
  chỉ cấp context cho routine. Rollback/atomicity ở đây là domain import
  workflow, nên không được mở rộng core chỉ vì có chữ phase-gate.
- Coverage: giữ toàn bộ apply/rollback/parity/identity coverage cho một exact
  migration mapping tương lai; không tạo security extraction và không
  backfill mapping.

### 37. `technical_configuration_baseline_hierarchy_import_apply_security_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Đây là security phase gate, không cần
  migration mapping.
- Proposed scope: `core-security`. Test khóa đủ public/internal/legacy apply
  và preview function signatures; public v2 apply chưa active phải trả đúng
  error (`38–65`). Legacy/public/internal execute grants phải đúng và không
  được lộ cho anon/service_role hoặc client (`66–86`); legacy function source
  hashes phải đúng (`87–101`) và không có PUBLIC execute leak (`104–106`).
- Đây là ACL/activation/integrity assertion thực tế; không có business
  workflow half và không dựa vào fixture setup để kết luận security.
- Coverage: giữ nguyên toàn bộ function existence, activation, privilege và
  hash coverage trong core-security.

### 38. `technical_configuration_baseline_hierarchy_import_preview_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Proposed scope: `migration-specific`. Đây là historical import workflow
  `intentional-unmapped`: giữ ngoài default lane với rationale, không backfill.
  Valid preview phải chuẩn hóa hierarchy order và effect counts, đồng thời
  không ghi dữ liệu (`283–318`). Row validation phải giữ error codes cho
  content-before-section, malformed/physical row, partial/wrong/foreign
  identity, changed code và duplicate (`319–410`); identity fallback, empty
  tree delete effects và stale metadata tiếp tục được kiểm tra (`411–442`).
- Unsupported input được flag rõ: marker `1.1` phải trả
  `unsupported_marker` (`331–336`); assertion này là validation workflow,
  không phải ACL/JWT và vẫn giữ coverage.
- Coverage: giữ nguyên toàn bộ preview/validation/effects contract cho exact
  migration mapping tương lai; không đề xuất core extraction.

### 39. `technical_configuration_baseline_hierarchy_import_preview_security_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Security core không cần mapping.
- Proposed scope: `core-security`. Public preview chỉ được authenticated
  execute, anon/service_role/internal helpers bị từ chối theo privilege
  contract (`104–117`); missing claims và non-global role phải fail closed
  với expected error (`119–134`); raw `admin` preview được phép theo role
  normalization contract (`135–142`).
- Các helper `set_claims`/fixture writes không được tính là assertion riêng;
  chỉ các privilege và expected error checks trên là evidence security.
- Coverage: giữ toàn bộ preview authorization/ACL coverage trong
  core-security, không extraction và không mapping.

### 40. `technical_configuration_baseline_hierarchy_mutations_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Đây là historical phase-gate business test
  `intentional-unmapped`; không có declared canonical path để validate và giữ
  ngoài default lane.
- Proposed scope: `migration-specific`. Mutation workflow giữ create/move/reorder
  identity, canonical subgroup/criterion ordering và legacy compatibility
  (`149–272`); atomic rejection của non-empty delete, duplicate reorder,
  foreign scope, unsupported depth, stale revision và locked version phải
  không đổi state (`275–372`). Linked reference records phải giữ identity,
  direct-criterion partition và final delete state (`377–441`).
- Unsupported input được flag rõ: `unsupported_hierarchy_depth` ở
  (`336–350`) phải giữ error và không tạo subgroup; đây là domain mutation
  phase gate, không phải JWT/tenant setup. JWT global ở `4–17` chỉ là helper.
- Coverage: giữ nguyên toàn bộ mutation/atomicity/ordering/lock coverage cho
  một exact migration mapping tương lai; không tạo security extraction và
  không backfill mapping.

## Trạng thái BATCH1–2 và evidence chưa giải quyết

- BATCH1 vẫn giữ evidence `20/20`: `2` `core-security`, `4`
  `migration-specific`, `14` mixed tạm thời giữ trong core; một mapping
  `requiredForMigrations` hợp lệ tại exact subject commit, bốn migration
  business là intentional-unmapped lịch sử, declared-path invalid count `0`.
- BATCH2 đã review `20/20` (path 21–40): `5` `core-security`, `6`
  `migration-specific`, `9` mixed tạm thời giữ trong core. Một mapping
  `requiredForMigrations` được khai báo đúng canonical path và tồn tại tại
  exact `subjectCommit` (path 34); năm migration business còn lại
  intentional-unmapped lịch sử. Declared-path invalid count của BATCH2 là `0`.
- Tổng đã review: `40/77`; còn `37` path pending. Tổng đề xuất trong hai batch
  là `7` `core-security`, `10` `migration-specific`, và `23` mixed giữ tạm
  trong core-security. Hai mapping declared đều hợp lệ; không có mapping
  declared invalid. Chín migration-specific lịch sử không mapping được giữ
  ngoài default lane với rationale; `23` mixed chưa backfill mapping business
  và chờ Chunk 4.
- Toàn bộ assertion của BATCH1–2 vẫn được giữ trong test hiện tại; tài liệu
  này không backfill mapping, sửa SQL/registry, hoặc loại coverage. Không có
  entry nào bị để `unsupported classification`; các input error cụ thể đã
  được flag tại entry 38 và 40.
- BATCH3 là lượt kế tiếp với `20` path pending (41–60); BATCH4 còn `17` path
  pending (61–77), tổng cộng `37` path chưa review. Không thêm evidence chi
  tiết cho các batch sau trong lượt này.
- Artifact này không tuyên bố thay đổi selector, registry, static lane,
  baseline-forward hoặc Oracle behavior.

## BATCH3 — paths 41–60

Provenance của batch này vẫn dùng đúng snapshot `default-safe` ổn định tại
`subjectCommit` `1940887e9fe09d2264912602e43aee3b785a06bd`: registry có `103`
entry, trong đó `77` entry `default-safe`; registry bytes tại subject và HEAD
đều khớp SHA-256 `c1a2f1ceac663b815cfbf96a3c9b2551c37a46132b34464c02d524d6b6ecf477`.
Chỉ đọc assertion body của đúng paths 41–60 tại subject commit; không sửa SQL,
registry, source, database, Oracle hoặc test runner.

### 41. `supabase/tests/technical_configuration_baseline_hierarchy_server_activation_security_gate.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent. Core-security assertion không cần mapping;
  business half chưa có mapping declared nhưng mixed test vẫn giữ trong default
  lane cho tới khi tách ở Chunk 4.
- Actual assertions: function identity/contract và privilege của internal/public
  apply (`58–112`); public/authenticated ACL, missing claims và non-global
  role phải fail `42501/permission_denied` (`171–203`). Raw `admin` đi tới
  target guard `PT404/not_found` cho apply và hierarchy authoring (`205–225`)
  là business target/version guard, không phải authorization denial. `set_claims`
  và `nhan_vien` chỉ tạo execution fixture.
- Proposed scope: `mixed → core-security (temporary)`. Function identity,
  privilege, JWT missing-claims/non-global denials giữ trong core; raw-admin
  target guards là migration-specific business.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact và rationale.
- Coverage và hướng tách: giữ toàn bộ privilege, missing-claims, role-denial,
  target-guard và normalized `admin` coverage. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_baseline_hierarchy_server_activation_security_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_baseline_hierarchy_server_activation_security_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 42. `supabase/tests/technical_configuration_baseline_hierarchy_snapshots_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` khai báo đúng canonical path
  `supabase/migrations/20260830090000_technical_configuration_copy_reentrant_workspace.sql`,
  path tồn tại tại exact `subjectCommit`, nên declared mapping hợp lệ.
- Actual assertions: copy/remap hierarchy và criterion identity (`280–318`),
  mixed subgroup ordering (`318–332`), wrapper leaf remap (`374`), locked
  hierarchy identity (`413`), và rollback probe (`416–428`). Global/expert
  `set_claims` ở `59`, `416`, `435` chỉ là fixture; không có ACL/JWT denial,
  tenant mismatch hoặc search_path assertion.
- Proposed scope: `migration-specific`. Các assertion là workflow/domain
  snapshot copy, remap, ordering, lock identity và rollback; theo boundary của
  Chunk 2, domain ordering/locked-version/atomicity không được gọi là core
  migration integrity.
- Mapping/rationale: mapping exact path hợp lệ; giữ nguyên để selector chỉ chọn
  test khi pending migration path khớp exact, không backfill hoặc đổi registry.
- Coverage: giữ toàn bộ copy/remap/identity/order/rollback coverage trong
  migration-specific; không đề xuất split file.

### 43. `supabase/tests/technical_configuration_baseline_import_atomicity_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions: import tạo group/criterion và cập nhật revision/counter
  (`199–229`), giữ criterion identity/source linkage và xóa row bị omit
  (`249–260`), reorder và code allocation (`270–303`), rollback cho row,
  duplicate, relationship, stale revision và overflow (`304–342`).
  `set_claims('global', ...)` ở `194` chỉ là fixture.
- Proposed scope: `migration-specific`. Đây là domain import reconciliation và
  atomicity phase gate; revision, ordering, lock/overflow và rollback business
  không phải migration/schema/evidence safety core.
- Mapping/rationale: intentional-unmapped lịch sử; rationale đã đủ ở assertion
  body nhưng chưa có canonical migration identity, nên giữ ngoài default lane
  và không ép backfill.
- Coverage: giữ toàn bộ import reconciliation, identity, allocation và rollback
  coverage; không đề xuất split file.

### 44. `supabase/tests/technical_configuration_baseline_import_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: missing claims và non-global role bị từ chối cho
  cả preview/apply (`149–189`). Actual business assertions: raw `admin`/expert
  preview success, preview read-only và expert apply rollback probe
  (`191–223`), metadata/template binding, malformed/tampered rows, global apply
  result, stale/locked/archived target (`230–362`).
- Proposed scope: `mixed → core-security (temporary)`. Chỉ phần JWT role/claim
  denial và role authorization giữ trong core; metadata, preview, validation,
  revision, locked/archived target là migration-specific business để tách ở
  Chunk 4. Không coi `set_claims` fixture là security evidence nếu không có
  assertion denial/authorization đi kèm.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Không loại mixed test khỏi
  default lane; chỉ business half sau khi tách ở Chunk 4 mới cần exact mapping
  và rationale migration-specific.
- Coverage và hướng tách: giữ toàn bộ assertion hiện tại trong test đang chạy.
  Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_baseline_import_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_baseline_import_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 45. `supabase/tests/technical_configuration_comparison_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: comparison RPC tồn tại, `SECURITY DEFINER`,
  fixed `search_path`, authenticated-only ACL và public/anon/service-role
  denial (`144–165`). Actual business assertions: exact response keys, option
  request ordering, evidence/response shape, archived/locked read behavior,
  read immutability and bounded set-based plan (`877–1293`).
- Proposed scope: `mixed → core-security (temporary)`. Catalog/ACL/search_path
  checks stay core; comparison payload, evidence, ordering, pagination and
  performance behavior are migration-specific business. `set_claims` and
  fixture rows do not independently prove tenant security.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; chỉ business half sau Chunk 4 mới cần exact mapping, không tự
  phát minh migration mapping.
- Coverage và hướng tách: retain all current assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_comparison_phase_gate_core_security.sql`
  and
  `supabase/tests/technical_configuration_comparison_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 46. `supabase/tests/technical_configuration_comparison_set_read_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: missing/malformed/nonnumeric claims và non-global
  role bị từ chối (`470–528`); authenticated/service-role/anon function ACL và
  fixed `search_path` (`610–647`). Actual business assertions: cross-dossier
  validation, missing/existing pair payload, response ordering, archived read và
  audit/revision immutability (`530–600`). Cross-dossier là workflow boundary,
  không tự suy ra tenant-security.
- Proposed scope: `mixed → core-security (temporary)`. Giữ JWT/role/ACL/search_path
  thật trong core; tách read payload, cross-dossier validation và audit behavior
  thành migration-specific. JWT fixture `set_claims` không tính riêng là core.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane, không backfill canonical path hoặc đổi safety/registry; business
  half sau Chunk 4 sẽ có rationale riêng.
- Coverage và hướng tách: giữ toàn bộ assertion hiện tại. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_comparison_set_read_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_comparison_set_read_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 47. `supabase/tests/technical_configuration_copy_reentrant_workspace_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `120` giây;
  `requiredForMigrations` khai báo canonical path
  `supabase/migrations/20260830090000_technical_configuration_copy_reentrant_workspace.sql`,
  tồn tại tại exact `subjectCommit`, nên mapping declared hợp lệ.
- Actual assertions: copy workspace/source listing, preview/apply lineage and
  replacement, stale preview guards và result snapshots (`263–381`); baseline
  rollback và cross-workspace rollback probes (`401–453`). `global` claim ở
  `206` chỉ là execution fixture; không có JWT/ACL/tenant-denial assertion.
- Proposed scope: `migration-specific`. Nội dung là copy/reentrant business
  workflow, identity, revision/atomicity and rollback; domain atomicity/order/
  locked-version không được nâng thành core migration integrity.
- Mapping/rationale: exact canonical path tồn tại và được giữ nguyên; selector
  chỉ dùng khi pending path match exact, không đổi registry.
- Coverage: giữ toàn bộ copy, preview, replacement, stale và rollback coverage;
  không đề xuất split file.

### 48. `supabase/tests/technical_configuration_dossier_delete_audit_failure_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions: injected audit failure phải không xóa dossier (`113`),
  trả `PT500/audit_log_failed` (`120–124`), giữ nguyên aggregate (`142–145`)
  và không tạo audit row (`153`). `SECURITY DEFINER SET search_path` ở `16–17`
  thuộc helper/fixture definition, không có assertion search_path; global claims
  chỉ là setup.
- Proposed scope: `migration-specific`. Đây là failure atomicity/audit business
  behavior; không có RPC authorization, JWT/tenant denial hoặc ACL assertion.
- Mapping/rationale: intentional-unmapped lịch sử; không backfill migration path,
  giữ ngoài default lane.
- Coverage: giữ toàn bộ failure injection, rollback, aggregate và audit-row
  coverage; không đề xuất split file.

### 49. `supabase/tests/technical_configuration_dossier_delete_audit_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions: audited delete response (`94`), đúng một audit row với
  expected detail (`113–117`), và không còn aggregate residue (`133–135`).
  Global claims/active-user lookup chỉ tạo fixture; không có JWT, tenant, ACL
  hoặc search_path assertion.
- Proposed scope: `migration-specific`. Đây là dossier deletion và audit-row
  workflow contract, không phải core migration/schema/evidence safety.
- Mapping/rationale: intentional-unmapped lịch sử; không ép backfill hoặc biến
  business audit test thành required migration mapping.
- Coverage: giữ response, audit count/detail và residue cleanup coverage; không
  đề xuất split file.

### 50. `supabase/tests/technical_configuration_dossier_delete_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: `qltb_khoa` role denial, missing claims và
  expected `permission_denied` (`340–351`). Actual business assertions:
  `can_delete`/locked/archived state (`333–338`), stale/archived/missing/locked
  guards (`354–372`), lock rejection, global/raw-admin response and cascade
  deletion, list disappearance cùng set-based plan (`383–445`).
- Proposed scope: `mixed → core-security (temporary)`. Chỉ role/authorization
  denial giữ core; can-delete, lock, cascade, response and query-plan behavior
  là migration-specific business. Fixture `set_claims` không tự là security
  evidence.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact, không backfill
  trong Chunk 2.
- Coverage và hướng tách: giữ toàn bộ test hiện tại. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_dossier_delete_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_dossier_delete_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 51. `supabase/tests/technical_configuration_dossier_search_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions security: normalized list signature/ACL (`66–81`), helper
  internal ACL và immutable/non-definer fixed `search_path` (`85–108`). Actual
  business assertions: normalization vectors (`120–127`), matching/ranking,
  wildcard/Unicode behavior, pagination, length validation and index plans
  (`293–494`). `set_claims('global', ...)` chỉ là fixture.
- Proposed scope: `mixed → core-security (temporary)`. ACL/search_path/catalog
  assertions stay core; text normalization, ranking, pagination, wildcard and
  index-plan outcomes are migration-specific business/performance behavior.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact, không gán path
  theo tên `search` hoặc phase gate.
- Coverage và hướng tách: giữ mọi assertion hiện tại. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_dossier_search_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_dossier_search_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 52. `supabase/tests/technical_configuration_evaluation_criteria_filter_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions security: missing claims/non-global denial (`254–276`) và
  authenticated/service-role/anon function ACL (`393–401`). Actual business
  assertions: raw-admin page, filter results/canonical indexes, invalid paging
  and immutability (`287–390`); raw `admin` setup is retained only where it
  participates in role authorization behavior.
- Proposed scope: `mixed → core-security (temporary)`. JWT/role/ACL assertions
  remain core; filter semantics, canonical page/index, bounds and assessment
  read behavior are migration-specific business. No migration-integrity core
  claim is inferred from revision/order-like result fields.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact, không backfill
  hoặc loại test vì thiếu mapping.
- Coverage và hướng tách: retain all current assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_evaluation_criteria_filter_phase_gate_core_security.sql`
  and
  `supabase/tests/technical_configuration_evaluation_criteria_filter_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 53. `supabase/tests/technical_configuration_evaluation_hierarchy_order_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions: hierarchy ordering across 50/51 and 100/101 boundaries
  (`314–339`), transport page/canonical index behavior (`341–356`), sparse
  filtered hierarchy and evidence ordering (`358–386`), plus read non-mutation
  snapshots (`389–428`). Global/admin claims only establish the fixture.
- Proposed scope: `migration-specific`. These are domain evaluation ordering,
  filtering and snapshot invariants; they are explicitly outside core migration
  integrity even where they mention pages, revisions or non-mutation.
- Mapping/rationale: intentional-unmapped lịch sử; no canonical migration path
  declared or validated.
- Coverage: giữ toàn bộ hierarchy order/filter/non-mutation coverage; không đề
  xuất split file.

### 54. `supabase/tests/technical_configuration_evaluation_hierarchy_order_security_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions security: missing claims và non-global role denial (`81–105`),
  hardened `SECURITY DEFINER/search_path` and ACL (`130–150`). Actual business
  assertions: invalid filter and oversized page rejection before lookup
  (`107–128`). `set_claims` is fixture setup unless paired with a denial.
- Proposed scope: `mixed → core-security (temporary)`. Keep JWT/role/ACL/search_path
  in core; extract endpoint validation/bounds into migration-specific. The
  validation is not migration/schema/evidence safety and must not be promoted
  to core merely because the file name says security.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact, không backfill
  trong batch này.
- Coverage và hướng tách: keep all current assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_evaluation_hierarchy_order_security_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_evaluation_hierarchy_order_security_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 55. `supabase/tests/technical_configuration_expert_account_assignment_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `90` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions security: unauthorized caller/JWT-stored-role mismatch and
  expert-caller denials (`265–269`, `380–390`); function `SECURITY DEFINER`,
  fixed `search_path`, PUBLIC/anon denial and authenticated/service-role ACL
  (`414–437`). Actual business assertions: canonical expert assignment/scope,
  membership retirement, profile/audit updates and rollback (`219–406`).
- Proposed scope: `mixed → core-security (temporary)`. Role/tenant/scope denial,
  ACL and search_path stay core; canonical scope, memberships, audit and
  transaction behavior are migration-specific business. Fixture tenant columns
  alone are not isolation evidence.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact, không backfill
  hoặc âm thầm loại test.
- Coverage và hướng tách: retain all current assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_expert_account_assignment_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_expert_account_assignment_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 56. `supabase/tests/technical_configuration_expert_account_scope_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `90` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions security: reassignment RPC identity, fixed `search_path` and
  authenticated/anon ACL (`226–270`), plus role/user/invalid-claim denial cases
  (`342–406`). Actual business assertions: global/admin scope changes, membership
  state, rollback restoration, non-expert behavior and scope invariants
  (`273–439`).
- Proposed scope: `mixed → core-security (temporary)`. Keep actual authorization,
  role/claim and ACL assertions in core; expert scope mutation, membership,
  locking and rollback are migration-specific business. `current_setting` trigger
  controls are failure fixtures, not independent tenant proof.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact, không backfill.
- Coverage và hướng tách: retain current test coverage. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_expert_account_scope_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_expert_account_scope_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 57. `supabase/tests/technical_configuration_expert_account_scope_review_regression.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `90` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions security: current-unit mismatch must not reveal expert/target
  existence (`203–208`), and all listed RPCs deny PUBLIC/anon while allowing
  authenticated/service-role (`230–257`). Actual business/regression assertions:
  expert-create disablement, existing-role behavior, destination lock/activity
  checks (`128–225`).
- Proposed scope: `mixed → core-security (temporary)`. Keep error indistinguishability
  and ACL in core; account-role regression and destination lock/invariant behavior
  are migration-specific. No `set_claims` fixture is counted by itself.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact, không dùng
  review regression để tự suy ra path.
- Coverage và hướng tách: keep all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_expert_account_scope_review_regression_core_security.sql`
  and
  `supabase/tests/technical_configuration_expert_account_scope_review_regression_migration_specific.sql`;
  chưa sửa SQL/registry.

### 58. `supabase/tests/technical_configuration_manual_assessments_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions security: missing claims/non-global denial and explicit raw
  `admin`/`chuyen_gia` assessment-read authorization (`195–213`), RPC ACL, RLS
  and table privilege contracts (`426–469`). The expert write rollback sentinel
  (`215–230`) is business transaction coverage. Other business assertions are
  bounds/FK/axis validation, create/update revision, stale state,
  source/document preservation and cascade behavior (`233–425`).
- Proposed scope: `mixed → core-security (temporary)`. Role/JWT/ACL/RLS/table
  privilege assertions stay core; assessment CRUD, revisions, FK and cascade
  behavior are migration-specific business. Revision/atomicity/ordering fields
  do not become migration-integrity core.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact, không backfill
  hoặc loại test khỏi default lane.
- Coverage và hướng tách: retain all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_manual_assessments_phase_gate_core_security.sql`
  and
  `supabase/tests/technical_configuration_manual_assessments_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 59. `supabase/tests/technical_configuration_option_documents_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions security: RLS/policy and PUBLIC/anon/authenticated/service-role
  table access (`116–180`), function `SECURITY DEFINER`, fixed `search_path` and
  function ACL (`181–207`), plus missing/non-global role denials (`288–345`).
  Actual business assertions: document/citation create/update/delete, cross-
  baseline validation, URL/revision guards and injected cascade rollback
  (`350–604`).
- Proposed scope: `mixed → core-security (temporary)`. Keep only actual ACL,
  RLS, role and search_path evidence in core; document/citation lifecycle and
  transactional business behavior are migration-specific. Global/admin fixtures
  do not prove tenant isolation alone.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact, không backfill
  hoặc đổi safety.
- Coverage và hướng tách: retain all current assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_option_documents_phase_gate_core_security.sql`
  and
  `supabase/tests/technical_configuration_option_documents_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 60. `supabase/tests/technical_configuration_option_import_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared path.
- Actual assertions security: missing/invalid claims and non-global role denial
  (`268–286`), public function ACL for preview/apply and validator visibility
  (`481–510`). Actual business assertions: preview read-only, metadata/row
  validation, zero-write guards, global/draft apply, response reconciliation,
  revision and late-failure rollback (`289–469`).
- Proposed scope: `mixed → core-security (temporary)`. Keep JWT/role/ACL checks
  in core; option import validation, reconciliation, revision and rollback are
  migration-specific business. JWT fixtures without denial/authorization checks
  are not security evidence.
- Mapping/lý do: không có mapping declared cho business half tại exact subject
  commit; core-security half không cần mapping. Giữ nguyên mixed test trong
  default lane; business half sau Chunk 4 mới cần mapping exact, không backfill
  hoặc loại mixed test.
- Coverage và hướng tách: preserve all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_option_import_phase_gate_core_security.sql`
  and
  `supabase/tests/technical_configuration_option_import_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

## BATCH3 summary counts (checkpoint trước BATCH4)

- BATCH3 đã review `20/20` (path 41–60): `0` pure `core-security`, `6`
  `migration-specific`, `14` mixed tạm thời giữ trong core-security. Hai
  declared `requiredForMigrations` mapping (path 42 và 47) đều trỏ đúng
  canonical path tồn tại tại exact `subjectCommit`; declared-path invalid count
  của BATCH3 là `0`. Bốn migration-specific historical entry không mapping được
  là intentional-unmapped; `13` mixed chưa backfill mapping cho business half
  nhưng toàn bộ mixed test vẫn giữ trong default lane nhờ core half.
- Tổng đã review: `60/77`; còn `17` path pending. Tổng cumulative đề xuất của
  BATCH1–3 là `7` `core-security`, `16` `migration-specific`, và `37` mixed tạm
  giữ trong core-security. Bốn declared mappings đều hợp lệ; declared invalid
  count cumulative là `0`. Các migration-specific historical không mapping được
  giữ ngoài default lane với rationale; mixed chưa backfill mapping business và
  chờ Chunk 4.
- Toàn bộ assertion của BATCH1–3 vẫn được giữ trong test hiện tại; artifact này
  không backfill mapping, sửa SQL/registry, loại coverage hoặc tuyên bố thay đổi
  selector, static lane, baseline-forward hay Oracle behavior.
- BATCH4 evidence được bổ sung ngay dưới checkpoint này; các số liệu cumulative
  cuối cùng nằm ở phần tổng hợp sau entry 77.

## Evidence phân loại BATCH4

### 61. `supabase/tests/technical_configuration_option_responses_constraints_phase_gate.sql`

- Registry hiện tại tại exact `subjectCommit`: `purpose: "phase-gate"`,
  `safety: "default-safe"`, fixture `isolated-fixture`, transaction
  `rollback-required`, timeout `30` giây; `requiredForMigrations` absent và
  không có declared canonical path.
- Actual assertions là helper bắt đúng SQLSTATE `23503` (`4–22`) và bốn
  composite ownership FK: comparison-set option/baseline (`187–231`) cùng
  response comparison-set/criterion (`233–261`). Không có RPC/JWT/tenant
  denial, ACL hoặc `search_path` assertion; fixture rows không được tính là
  security evidence.
- Proposed scope: `migration-specific`. Đây là schema relationship/constraint
  gate cho ownership liên bảng; FK correctness không phải authorization hay
  tenant isolation.
- Mapping/lý do: không có `requiredForMigrations` declared để validate tại
  exact subject commit; giữ intentional-unmapped lịch sử, không backfill path
  và không đổi selector/safety.
- Coverage: giữ nguyên toàn bộ bốn FK violation assertions và rollback; không
  cần security extraction file.

### 62. `supabase/tests/technical_configuration_option_responses_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent, không có declared canonical path.
- Actual assertions security: thiếu claims và role non-global bị từ chối với
  `42501/permission_denied` (`154–161`); raw `admin` và authenticated
  function call được chấp nhận (`167–180`) là positive authorization contrast,
  không suy ra từ việc response có dữ liệu. Function ACL và RLS/table privilege
  contract nằm ở (`417–445`).
- Actual business assertions: cross-dossier/exact-baseline validation
  (`163–165`, `207–210`), response payload, revision/audit metadata và
  multiline/null normalization (`178–266`), stale/archived guards
  (`267–314`), baseline-copy/cascade/field exclusion (`315–413`). Revision,
  atomicity, cascade và response shape không nâng thành core security.
- Proposed scope: `mixed → core-security (temporary)`. Chỉ JWT/role denial,
  genuine role acceptance, ACL và RLS giữ core; toàn bộ response/revision,
  baseline/cascade business giữ để tách sau.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Giữ nguyên mixed test trong default lane; phần
  business là intentional-unmapped, không backfill hoặc loại test.
- Coverage và hướng tách: retain all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_option_responses_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_option_responses_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 63. `supabase/tests/technical_configuration_options_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: missing claims và non-global role denial
  (`151–161`); raw `admin` và `chuyen_gia` đọc được collection
  (`164–174`) là positive authorization contrasts. RLS/deny policy và
  authenticated/anon/service-role table/function ACL nằm ở (`416–464`).
- Actual migration/business assertions: composite supplier ownership FK và
  empty-notes check (`132–148`); pagination, not-found, normalization,
  ordering, revisions, archived/locked guards và cascades (`191–407`).
  Target-notfound, response shape, revision/ordering và rollback sentinel
  không phải core security.
- Proposed scope: `mixed → core-security (temporary)`. Core chỉ giữ
  JWT/role denial, positive authorized-role contrast, RLS và ACL; option CRUD,
  validation, pagination, revision, ordering và cascade là migration-specific
  business.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Mixed test tiếp tục ở default lane, business
  half intentional-unmapped cho tới extraction thật; không backfill.
- Coverage và hướng tách: giữ toàn bộ assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_options_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_options_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 64. `supabase/tests/technical_configuration_reference_products_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security/migration-integrity: RLS, deny policy và table
  privilege posture (`95–149`); public routine existence,
  SECURITY DEFINER, fixed `search_path` và function ACL (`151–211`);
  missing role/user và denied role (`289–327`). Raw `admin` create success
  (`329–343`) là positive authorization contrast; không coi revision `2`
  hoặc payload create là security.
- Actual business assertions: product/response create-upsert, stale revision,
  cross-version validation, archived/locked mutation guards and persisted
  values (`346–645`), cascade and baseline-copy remapping/exclusion
  (`646–680`). Revision, lock, copy, ordering and cascade are business.
- Proposed scope: `mixed → core-security (temporary)`. Giữ đúng catalog
  RLS/ACL/search_path/JWT role evidence trong core; reference-product
  lifecycle, response data, revision/lock/copy behavior là
  migration-specific business.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Giữ mixed test trong default lane, business
  half intentional-unmapped; không backfill canonical migration path.
- Coverage và hướng tách: preserve all current assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_reference_products_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_reference_products_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 65. `supabase/tests/technical_configuration_reference_ranking_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: public/anon/authenticated/service-role execute
  ACL (`73–85`); missing claims và denied role (`235–250`); raw `admin` đọc
  ranking (`254–261`) là positive authorization contrast.
- Actual business assertions: dense rank/counters, eligibility, 100+ paging
  and empty-page behavior (`289–321`), session-format-independent snapshot
  and read immutability (`322–391`), cross-dossier target-notfound and page
  bounds (`392–414`), source/assessment snapshot changes (`419–446`).
  Ranking, response shape, pagination, target-notfound and revision-like
  snapshot behavior không phải core security.
- Proposed scope: `mixed → core-security (temporary)`. Core giữ RPC ACL,
  JWT/role denial và genuine admin authorization; ranking/paging/snapshot
  business giữ để tách migration-specific.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Mixed test giữ trong default lane; business
  half intentional-unmapped, không backfill mapping.
- Coverage và hướng tách: retain all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_reference_ranking_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_reference_ranking_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 66. `supabase/tests/technical_configuration_result_export_axes_pagination_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual SQL chỉ cài execution fixture qua `current_setting` và claim
  `global` (`108–134`), sau đó gọi hai result-export RPC và kiểm tra page
  descriptors, exact totals, IDs và repeated snapshot/ranking tokens
  (`134–211`). Không có denial/positive authorization contrast, ACL, tenant
  isolation hay `search_path` assertion; JWT fixture alone không phải security.
- Proposed scope: `migration-specific`. Đây là cross-page ordering/pagination
  và token consistency business behavior; page shape/tokens không phải core
  security.
- Mapping/lý do: không có mapping declared tại exact subject commit; giữ
  intentional-unmapped lịch sử, không backfill và không đổi default selector.
- Coverage: giữ nguyên toàn bộ ordered-page, total và repeated-token
  assertions; không cần security extraction file.

### 67. `supabase/tests/technical_configuration_result_export_axes_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security/migration-integrity: function metadata yêu cầu
  stable/`SECURITY DEFINER` và pinned `search_path` (`120–128`), least-
  privilege function ACL (`134–143`), missing claims/denied role
  (`281–296`), và raw `admin` call được chấp nhận (`315–329`) là positive
  authorization contrast.
- Actual business assertions: page bounds, exact response envelopes/descriptors,
  requested ordering, empty-axis cases và snapshot token equality
  (`299–428`), cùng read-only fixture count (`442–444`). Response shape,
  pagination, ordering và rollback/read-only sentinel không phải core security.
- Proposed scope: `mixed → core-security (temporary)`. Giữ metadata
  search_path/ACL và JWT/role authorization trong core; axis payload,
  ordering, empty combinations and read-only business behavior là
  migration-specific.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Giữ mixed test trong default lane, business half
  intentional-unmapped; không backfill.
- Coverage và hướng tách: preserve all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_result_export_axes_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_result_export_axes_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 68. `supabase/tests/technical_configuration_result_export_manifest_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: manifest/helper function ACL and stable posture
  (`99–113`), missing claims/denied role (`214–229`), và raw `admin`, `global`,
  `chuyen_gia` reads (`231–249`) là genuine positive authorization contrasts;
  response total fields không tự là authorization evidence.
- Actual business assertions: exact manifest root/data shape and request order
  (`250–291`), missing-row/read immutability and audit metadata (`300–352`),
  canonical timezone/token behavior and token changes after dossier/criterion/
  lock/option/supplier/response/document/citation/assessment edits
  (`365–454`). Validation/target-notfound, response shape and snapshot token
  behavior không phải core security.
- Proposed scope: `mixed → core-security (temporary)`. Giữ RPC ACL, stable
  helper posture, JWT/role denial và positive authorized roles trong core;
  manifest payload/scope validation/snapshot business tách sau.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Mixed test giữ nguyên default lane; business
  half intentional-unmapped, không backfill.
- Coverage và hướng tách: retain all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_result_export_manifest_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_result_export_manifest_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 69. `supabase/tests/technical_configuration_result_export_pages_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security/migration-integrity: ranking/matrix RPC ACL,
  service-only helpers, immutable helper posture and stable functions
  (`124–166`); missing claims/denied role (`274–290`); raw `admin` call
  accepted (`291–297`) là positive authorization contrast.
- Actual business assertions: page bounds, ranking/matrix payload, rank and
  sparse-cell response behavior, requested order, snapshot tokens, plan shape
  and read-only counts (`298–445`). Response shape, pagination, ordering,
  target exhaustion, `EXPLAIN` and rollback/read-only sentinel không phải core
  security.
- Proposed scope: `mixed → core-security (temporary)`. Chỉ RPC/JWT/ACL,
  service-only/search-path helper posture giữ core; ranking/matrix output,
  pagination and set-based runtime behavior là migration-specific business.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Giữ full mixed test trong default lane, business
  half intentional-unmapped; không backfill migration path.
- Coverage và hướng tách: preserve all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_result_export_pages_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_result_export_pages_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 70. `supabase/tests/technical_configuration_suppliers_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: missing claims và non-global role denial
  (`149–166`); raw `admin` đọc collection (`169–174`) là positive
  authorization contrast; supplier RLS và function/table ACL (`294–356`).
- Actual business assertions: whitespace normalization, empty/duplicate input,
  stale revision, canonical list/response, archived mutation, cascade and
  delete behavior (`176–289`). Normalization, revision, response shape and
  cascade không phải core security.
- Proposed scope: `mixed → core-security (temporary)`. Core giữ JWT/role,
  positive role acceptance, RLS and ACL; supplier CRUD and canonical business
  behavior giữ để tách migration-specific.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Mixed test giữ trong default lane, business half
  intentional-unmapped; không backfill.
- Coverage và hướng tách: retain all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/technical_configuration_suppliers_phase_gate_core_security.sql`
  và
  `supabase/tests/technical_configuration_suppliers_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

### 71. `supabase/tests/transfer_external_location_sync_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions core: suggestion RPC không leak location của tenant khác và
  vẫn trả location của tenant hiện tại (`552–571`), cùng denied
  `regional_leader` (`575–619`). Đây là tenant/authorization contrasts thực tế;
  các claim setup ở mỗi block không tính riêng là security.
- Actual business assertions: external location/status transitions, skipped
  handover/completion guards, return input validation, audit detail, internal
  transfer compatibility (`134–517`). Location values, workflow order and
  audit payload are business behavior.
- Proposed scope: `mixed → core-security (temporary)`. Chỉ tenant isolation và
  genuine role denial giữ core; lifecycle/location/audit details là
  migration-specific business.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Giữ full smoke trong default lane; business half
  intentional-unmapped, không backfill.
- Coverage và hướng tách: retain all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/transfer_external_location_sync_smoke_core_security.sql`
  và
  `supabase/tests/transfer_external_location_sync_smoke_migration_specific.sql`;
  chưa sửa SQL/registry.

### 72. `supabase/tests/transfer_request_delete_tenant_cast_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: missing `don_vi`, mismatched tenant, and missing
  user claims each fail with `42501` and preserve the request
  (`171–250`, `254–291`); matching tenant deletion and raw global deletion
  succeed (`294–340`) as genuine authorization contrasts. JWT fixture writes
  alone are not counted.
- Business portion: the authorized delete row removal itself and remaining-row
  checks are retained as workflow coverage; no target-notfound or response-shape
  assertion is promoted to core.
- Proposed scope: `mixed → core-security (temporary)`. Tenant claim
  fail-closed and authorized tenant/global contrasts stay core; delete
  lifecycle/row-mutation behavior is migration-specific business.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Keep the full test selected in default lane;
  business half intentional-unmapped, không backfill.
- Coverage và hướng tách: preserve all current denial, positive and delete
  assertions. Chunk 4 đề xuất tạo
  `supabase/tests/transfer_request_delete_tenant_cast_smoke_core_security.sql`
  và
  `supabase/tests/transfer_request_delete_tenant_cast_smoke_migration_specific.sql`;
  chưa sửa SQL/registry.

### 73. `supabase/tests/transfer_request_lifecycle_audit_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path. Registry
  vẫn giữ `baselineDebt` hiện hữu với SQLSTATE `42501` và evidence
  `oracle:issue989-compare-ce2c8350-20260905t0504z/report.json`; không sửa
  debt metadata.
- JWT/tenant claims tại các block (`73–80`, `194–201`, `307–314`, `381–388`,
  `455–462`, `618–625`, `755–762`, `823–830`, `916–923`) chỉ là execution
  fixtures. Temporary injected `audit_log` `SECURITY DEFINER/search_path`
  definition (`791–800`) cũng là fixture, không có assertion posture.
- Actual evidence-safety assertions: audit failure phải fail closed và không
  mutate request/history/audit ở completion (`739–900`) và create
  (`903–956`). Đây là evidence/atomic safety của gate, giữ trong core tạm
  thời.
- Actual business assertions: audit rows/details, lifecycle statuses, supported
  transition guards, duplicate completion và equipment history
  (`59–730`). Field-level audit details and workflow transitions are
  migration-specific business; JWT fixture alone is not security.
- Proposed scope: `mixed → core-security (temporary)`. Core chỉ giữ
  fail-closed evidence safety; audit payload/lifecycle behavior tách riêng.
- Mapping/lý do: không có mapping declared cho business half tại exact subject;
  core half không cần mapping. Giữ full smoke trong default lane, business
  half intentional-unmapped; không backfill migration mapping.
- Coverage và hướng tách: retain all assertions. Chunk 4 đề xuất tạo
  `supabase/tests/transfer_request_lifecycle_audit_smoke_core_security.sql`
  và
  `supabase/tests/transfer_request_lifecycle_audit_smoke_migration_specific.sql`;
  chưa sửa SQL/registry.

### 74. `supabase/tests/transfer_request_page_data_overdue_summary_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: `qltb_khoa` must receive zero for an out-of-scope
  tenant (`161–178`), and the legacy external-pending RPC denies both anon and
  authenticated execute (`220–225`). These are real tenant/ACL assertions;
  global/to-tenant claim setup is not counted by itself.
- Actual business assertions: overdue totals/items and date, search, status and
  assignee filters (`142–217`). Counts, summary shape and filter semantics
  remain migration-specific business.
- Proposed scope: `mixed → core-security (temporary)`. Core keeps only
  out-of-scope tenant enforcement and ACL; overdue summary payload/filter
  behavior is business.
- Mapping/lý do: no `requiredForMigrations` mapping exists at exact subject;
  core half needs no mapping. Keep the mixed smoke in default lane; business
  half intentional-unmapped, không backfill.
- Coverage và hướng tách: preserve all tenant, ACL and summary assertions.
  Chunk 4 đề xuất tạo
  `supabase/tests/transfer_request_page_data_overdue_summary_smoke_core_security.sql`
  và
  `supabase/tests/transfer_request_page_data_overdue_summary_smoke_migration_specific.sql`;
  chưa sửa SQL/registry.

### 75. `supabase/tests/unused_equipment_report_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: global scope without facility must fail closed
  (`173–199`); `to_qltb` cannot read another facility (`231–271`); and
  `regional_leader` cannot read a facility outside `dia_ban`
  (`273–341`). Same-scope role contrasts are real tenant authorization
  evidence; claim setup alone is not.
- Actual business assertions: unused-status/deleted-row filtering, counts,
  group/departments/options and selected-department report results
  (`201–230`, `284–327`). Report shape and counts stay migration-specific.
- Proposed scope: `mixed → core-security (temporary)`. Keep fail-closed
  tenant/facility/region boundaries in core; report filtering and aggregation
  remain business.
- Mapping/lý do: no declared mapping at exact subject; core half needs none.
  Retain the full smoke in default lane; business half intentional-unmapped,
  không backfill.
- Coverage và hướng tách: retain all current scope and report assertions.
  Chunk 4 đề xuất tạo
  `supabase/tests/unused_equipment_report_smoke_core_security.sql` và
  `supabase/tests/unused_equipment_report_smoke_migration_specific.sql`;
  chưa sửa SQL/registry.

### 76. `supabase/tests/usage_log_split_status_smoke.sql`

- Registry hiện tại: `purpose: "smoke"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `30` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual gate/schema assertions: both split status columns must exist
  (`8–24`), and `usage_session_end` must carry DDL-level
  `search_path=public, pg_temp` (`263–281`). Raw `admin` without `don_vi`
  successfully bypasses the tenant guard (`337–391`), a genuine positive
  authorization contrast; repeated `to_qltb` claims are fixtures.
- Actual business assertions: start/end status persistence, backward
  compatibility, empty-string validation, list overload response fields and
  legacy backfill (`41–334`, `397–588`). Response shape/status/backfill
  behavior stays migration-specific.
- Proposed scope: `mixed → core-security (temporary)`. Keep schema gate,
  pinned search_path and raw-admin tenant authorization in core; split-status
  workflow and compatibility behavior is business.
- Mapping/lý do: no declared mapping at exact subject; core half needs none.
  Keep full smoke selected in default lane; business half intentional-unmapped,
  không backfill.
- Coverage và hướng tách: preserve all schema, search_path, authorization and
  status assertions. Chunk 4 đề xuất tạo
  `supabase/tests/usage_log_split_status_smoke_core_security.sql` và
  `supabase/tests/usage_log_split_status_smoke_migration_specific.sql`;
  chưa sửa SQL/registry.

### 77. `supabase/tests/user_create_role_allowlist_phase_gate.sql`

- Registry hiện tại: `purpose: "phase-gate"`, `safety: "default-safe"`, fixture
  `isolated-fixture`, transaction `rollback-required`, timeout `90` giây;
  `requiredForMigrations` absent và không có declared canonical path.
- Actual assertions security: supported role allowlist and raw-admin positive
  authorization (`185–239`), non-global caller denial with `42501`
  (`241–252`), role guard ordering before hashing/writes, `SECURITY DEFINER`
  and pinned `search_path` (`254–276`), plus explicit function ACL
  (`278–294`). Invalid role rejection is genuine authorization/input boundary;
  it is not inferred from JWT setup.
- Actual business assertions: account/membership/audit persistence for each
  allowed role and no account/membership/audit residue on rejected calls
  (`39–83`, `185–221`). Membership cardinality, audit detail and write
  mutation are migration-specific business.
- Proposed scope: `mixed → core-security (temporary)`. Core keeps role
  allowlist, caller authorization, guard ordering, owner/search_path and ACL;
  account/membership/audit behavior is the business half.
- Mapping/lý do: no declared mapping at exact subject; core half needs no
  mapping. Keep full phase gate in default lane; business half
  intentional-unmapped, không backfill.
- Coverage và hướng tách: retain all allowlist, authorization, ordering,
  persistence and cleanup assertions. Chunk 4 đề xuất tạo
  `supabase/tests/user_create_role_allowlist_phase_gate_core_security.sql` và
  `supabase/tests/user_create_role_allowlist_phase_gate_migration_specific.sql`;
  chưa sửa SQL/registry.

## Cumulative summary counts (BATCH1–4)

- BATCH4 đã review đủ `17/17` (path 61–77): `0` pure `core-security`,
  `2` `migration-specific` (61, 66), và `15` mixed tạm thời giữ trong
  `core-security`. Cả 17 entry đều có evidence assertion line refs, safety/
  purpose/fixture/transaction/timeout hiện tại và trạng thái mapping.
- Tổng cumulative đã review đủ `77/77`: `7` pure `core-security`,
  `18` `migration-specific`, và `52` mixed tạm thời giữ trong
  `core-security`. Counts này được tính bằng script parse inventory path-only
  và heading scope của tài liệu, không đếm theo commit hoặc tên file.
- Registry pinned tại exact `subjectCommit` có bốn declared
  `requiredForMigrations` mapping, cả bốn canonical path đều hợp lệ; BATCH4
  không có declared mapping. Declared-path invalid count cumulative là `0`.
  Các business half không có mapping giữ `intentional-unmapped`; không có
  historical backfill và không có test nào bị âm thầm loại khỏi selected set.
- Toàn bộ 77 path vẫn là snapshot sorted byte-UTF-8 đã ghi ở đầu tài liệu;
  mọi assertion hiện tại được giữ nguyên. 52 mixed entry đã nêu rõ cặp
  extraction path `*_core_security.sql`/`*_migration_specific.sql`; ranh giới
  assertion còn trộn được ghi trung thực trong từng entry và chỉ giải quyết
  bằng extraction thật ở Chunk 4.
- Artifact này chỉ cập nhật classification evidence; không sửa SQL/source,
  registry, selector, test execution, DB/Oracle, migration history hoặc live
  behavior. Chunk 3 và các chunk sau vẫn chưa bắt đầu.
