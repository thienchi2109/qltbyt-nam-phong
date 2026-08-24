# Phase 1 Inventory And Contract Freeze

## Snapshot

- Branch: `chore/technical-config-expert-phase-1-inventory`
- Source commit: `e8de18ca17f5`
- Inventory date: `2026-08-24`
- Live database inspection: read-only Supabase MCP, project
  `cdthersvldpnlbvpufrr`
- Scope: discovery, ownership, migration ordering, and focused verification
  commands only
- Explicitly excluded: runtime behavior changes, migration creation/application,
  live database writes, and all Phase 2+ implementation

The Phase 1 exit gate is frozen at:

| Surface                                         |      Count | Classification                                              |
| ----------------------------------------------- | ---------: | ----------------------------------------------------------- |
| Exported RBAC predicates                        |          6 | Existing semantics remain unchanged and reject `chuyen_gia` |
| Role-derived `Object.values(ROLES)` boundaries  |          3 | Expert-denied; Phase 3 must prevent auto-growth             |
| Role-aware standalone API routes                |          8 | Expert-denied                                               |
| Generic proxy `ALLOWED_FUNCTIONS`               | 239 unique | 79 module, 2 retained, 158 expert-denied                    |
| Local `technical_configuration_*` SQL functions |         80 | 79 client-callable, 1 internal-only                         |
| Live canonical module RPCs                      |         79 | 79/79 local/client parity                                   |

## RBAC Inventory

### Canonical owners

| Owner                                         | Current contract                                            | Phase disposition                                                      |
| --------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/rbac.ts`                             | `ROLES`, `Role`, normalization, and six exported predicates | Phase 2 tests freeze semantics; Phase 4 adds dormant expert primitives |
| `src/types/database.ts`                       | Legacy `User.role`, `USER_ROLES`, and `UserRole`            | Phase 4 adds the dormant role value/label                              |
| `src/types/next-auth.d.ts`                    | Session/JWT role-bearing types                              | Phase 2/10 coverage; no Phase 1 edit                                   |
| `src/components/tenants-management-shared.ts` | Tenant role labels/order excluding global aliases           | Phase 14 owns operator-visible expert activation                       |
| `src/lib/app-route-access.ts`                 | `/technical-configurations` is currently `global`           | Phase 5 owns expert route isolation                                    |

`normalizeRole()` is internal, trims/lowercases, and fails closed for nullish or
empty input.

### Exported helper semantics

| Helper                         | Current accepted roles                          | `chuyen_gia` disposition |
| ------------------------------ | ----------------------------------------------- | ------------------------ |
| `isGlobalRole()`               | `global`, `admin`                               | Must remain `false`      |
| `isRegionalLeaderRole()`       | `regional_leader`                               | Must remain `false`      |
| `isEquipmentManagerRole()`     | `global`, `admin`, `to_qltb`                    | Must remain `false`      |
| `canAccessDeviceQuotaModule()` | `global`, `admin`, `regional_leader`, `to_qltb` | Must remain `false`      |
| `isDeptScopedRole()`           | `technician`, `qltb_khoa`                       | Must remain `false`      |
| `isPrivilegedRole()`           | `global`, `admin`, `regional_leader`            | Must remain `false`      |

Complete production consumer inventory:

- `isGlobalRole()` (19 files):
  `src/app/(app)/equipment/_components/EquipmentDialogContext.tsx`,
  `src/app/(app)/equipment/_hooks/useEquipmentAuth.ts`,
  `src/app/(app)/maintenance/_components/MaintenanceContext.tsx`,
  `src/app/(app)/reports/hooks/use-equipment-aggregate-search.ts`,
  `src/app/(app)/transfers/_components/useTransfersPageController.ts`,
  `src/app/(app)/users/_components/usersColumns.tsx`,
  `src/app/api/device-quota/mapping/suggest/suggestion-supabase-provider.ts`,
  `src/app/api/rpc/[fn]/route.ts`,
  `src/components/add-maintenance-plan-dialog.tsx`,
  `src/components/equipment/equipment-print-utils.ts`,
  `src/components/form-branding-header.tsx`,
  `src/components/unified-inventory-chart.tsx`,
  `src/components/usage-history-tab.tsx`, `src/hooks/use-audit-logs.ts`,
  `src/hooks/use-tenant-branding.ts`, `src/hooks/useTransfersKanban.ts`,
  `src/lib/ai/sql/scope.ts`, `src/lib/app-route-access.ts`, and
  `src/lib/equipment-attention-preset.ts`.
- `isRegionalLeaderRole()` (22 files):
  `src/app/(app)/dashboard/page.tsx`,
  `src/app/(app)/device-quota/_components/suggested-mapping/DeviceQuotaSuggestedMappingAccess.ts`,
  `src/app/(app)/device-quota/_components/suggested-mapping/SuggestedMappingPreviewDialog.tsx`,
  `src/app/(app)/equipment/_components/EquipmentDialogContext.tsx`,
  `src/app/(app)/equipment/_hooks/useEquipmentAuth.ts`,
  `src/app/(app)/maintenance/_components/MaintenanceContext.tsx`,
  `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`,
  `src/app/(app)/reports/components/equipment-search-report-tab.tsx`,
  `src/app/(app)/reports/hooks/use-equipment-aggregate-search.ts`,
  `src/app/api/device-quota/mapping/suggest/suggestion-supabase-provider.ts`,
  `src/app/api/rpc/[fn]/route.ts`, `src/components/add-equipment-dialog.tsx`,
  `src/components/add-transfer-dialog.tsx`,
  `src/components/edit-maintenance-plan-dialog.tsx`,
  `src/components/edit-transfer-dialog.tsx`,
  `src/components/end-usage-dialog.tsx`,
  `src/components/mobile-usage-actions.tsx`,
  `src/components/start-usage-dialog.tsx`,
  `src/components/unified-inventory-chart.tsx`,
  `src/hooks/useTransferActions.ts`, `src/hooks/useTransfersKanban.ts`, and
  `src/lib/equipment-attention-preset.ts`.
- `isEquipmentManagerRole()` (14 files):
  `src/app/(app)/device-quota/_components/suggested-mapping/DeviceQuotaSuggestedMappingAccess.ts`,
  `src/app/(app)/device-quota/_components/suggested-mapping/SuggestedMappingPreviewDialog.tsx`,
  `src/app/(app)/device-quota/categories/_hooks/useDeviceQuotaCategoryAccess.ts`,
  `src/app/(app)/device-quota/categories/page.tsx`,
  `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`,
  `src/app/(app)/equipment/use-equipment-page.tsx`,
  `src/app/(app)/maintenance/_components/MaintenanceContext.tsx`,
  `src/app/(app)/repair-requests/_components/RepairRequestsColumns.tsx`,
  `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`,
  `src/app/(app)/repair-requests/_components/RepairRequestsMobileList.tsx`,
  `src/components/equipment/equipment-actions-menu.tsx`,
  `src/hooks/useTransferActions.ts`, `src/lib/advanced-cache-manager.ts`, and
  `src/lib/department-utils.ts`.
- `canAccessDeviceQuotaModule()` (2 files):
  `src/app/api/device-quota/mapping/suggest/suggestion-route-utils.ts` and
  `src/lib/app-route-access.ts`.
- `isDeptScopedRole()` has no production caller.
- `isPrivilegedRole()` (3 files):
  `src/app/(app)/_components/HeaderEquipmentSearchEntry.tsx`,
  `src/contexts/TenantSelectionContext.tsx`, and `src/lib/ai/sql/scope.ts`.

All existing helper consumers inherit the frozen helper matrix above. They do
not gain expert access.

### Direct comparisons and role-derived collections

| Boundary                                                     | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Classification and owner                                                                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role-derived assistant allowlists                            | `src/app/api/chat/route.ts`, `src/lib/ai/prompts/system.ts`, `src/lib/ai/sql/scope.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                   | `Object.values(ROLES)` would auto-include a new role. Expert remains denied; Phase 3 replaces/locks the boundary. The prompt and SQL scope are reachable only through Chat. |
| Device Quota explicit allowlist                              | `src/app/api/device-quota/mapping/suggest/suggestion-supabase-provider.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                               | Current list is `global/admin/to_qltb/regional_leader`; expert remains denied. Phase 3 owns the regression tests.                                                           |
| Tenant API admin normalization/global check                  | `src/app/api/tenants/memberships/route.ts`, `src/app/api/tenants/switch/route.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                        | Expert remains denied. Phase 3 owns focused standalone API tests.                                                                                                           |
| Generic RPC proxy role branches                              | `src/app/api/rpc/[fn]/route.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Existing global/regional/user/tenant rewriting is not the expert policy. Phase 8 adds an exact expert check before rewriting/JWT/upstream fetch.                            |
| Server claim alias normalization                             | `src/auth/server-claims.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Preserve `admin -> global`; Phases 2 and 10 own role/session coverage.                                                                                                      |
| Route policy                                                 | `src/lib/app-route-access.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Phase 5 changes only Technical Configurations/access-denied behavior for the exact expert role.                                                                             |
| User-management role collections/labels                      | `src/components/add-user-dialog.tsx`, `src/components/edit-user-dialog.tsx`, `src/components/user-card.tsx`, `src/components/tenants-management-shared.ts`, `src/app/(app)/users/_components/usersColumns.tsx`, `src/types/database.ts`                                                                                                                                                                                                                                                                                  | Keep expert dormant through Phase 13; Phase 14 owns visible assignment and labels.                                                                                          |
| Feature-specific `user`/`qltb_khoa` branches and role unions | `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`, `src/app/(app)/equipment/use-equipment-page.tsx`, `src/app/(app)/transfers/_components/useTransfersPageController.ts`, `src/app/(app)/transfers/_components/TransfersTypes.ts`, `src/components/transfers/TransferRowActions.tsx`, `src/components/transfers/TransfersKanbanView.tsx`, `src/hooks/useTransferActions.ts`, `src/lib/department-utils.ts`                                                                                           | Existing feature semantics exclude the expert. Phase 5 route isolation makes these feature surfaces unreachable; no widening is allowed.                                    |
| Type-only session/user references                            | `src/app/(app)/_components/AuthenticatedPageBoundary.tsx`, `src/app/(app)/activity-logs/page.tsx`, `src/app/(app)/maintenance/_components/maintenance-context.types.ts`, `src/app/(app)/repair-requests/auth-user.types.assert.ts`, `src/app/(app)/repair-requests/types.ts`, `src/app/(app)/reports/page.tsx`, `src/app/(app)/users/_components/UsersPageContent.tsx`, `src/auth/next-auth-typing.types.assert.ts`, `src/hooks/use-cached-equipment.ts`, `src/hooks/use-dashboard-stats.ts`, `src/types/next-auth.d.ts` | Role-bearing types only; no authorization decision. Covered by Phase 2/10 type and auth tests.                                                                              |
| Non-RBAC `role`/`"user"` matches                             | `src/components/assistant/AssistantMessageList.tsx`, `src/lib/ai/draft/repair-request-draft-session.ts`, `src/lib/ai/tools/equipment-lookup-identifiers.ts`                                                                                                                                                                                                                                                                                                                                                              | AI message roles, not application RBAC. Excluded from role-policy changes.                                                                                                  |
| Usage fallback                                               | `src/lib/ai/usage-metering.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `"user"` is a fallback RPC claim for absent metering context, not a role allowlist. Chat remains the authorization boundary; Phase 3 owns it.                               |

## Standalone Role-Aware APIs

These are the complete role-aware routes outside the generic RPC proxy:

| Route file                                                               | Current authorization owner               | Expert disposition                             |
| ------------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------- |
| `src/app/api/chat/route.ts`                                              | `ALLOWED_CHAT_ROLES` derived from `ROLES` | Deny; Phase 3 must make the allowlist explicit |
| `src/app/api/device-quota/mapping/suggest/route.ts`                      | Suggestion provider access assertion      | Deny                                           |
| `src/app/api/device-quota/mapping/suggest/jobs/route.ts`                 | `assertSuggestionRouteUser()`             | Deny                                           |
| `src/app/api/device-quota/mapping/suggest/jobs/[jobId]/route.ts`         | `assertSuggestionRouteUser()`             | Deny                                           |
| `src/app/api/device-quota/mapping/suggest/jobs/[jobId]/retry/route.ts`   | `assertSuggestionRouteUser()`             | Deny                                           |
| `src/app/api/device-quota/mapping/suggest/jobs/[jobId]/process/route.ts` | `assertSuggestionRouteUser()`             | Deny                                           |
| `src/app/api/tenants/memberships/route.ts`                               | Normalized global role check              | Deny                                           |
| `src/app/api/tenants/switch/route.ts`                                    | Normalized global role check              | Deny                                           |

No other standalone API route performs an application-role authorization
decision. Generic `/api/rpc/[fn]` is classified separately below.

## Generic RPC Proxy Classification

`src/app/api/rpc/[fn]/allowed-functions.ts` contains 239 unique names. Every
entry belongs to exactly one class.

### Technical Configurations: 79

- Dossiers (6): `technical_configuration_dossiers_list`,
  `technical_configuration_dossiers_get`,
  `technical_configuration_dossiers_create`,
  `technical_configuration_dossiers_update`,
  `technical_configuration_dossiers_archive`,
  `technical_configuration_dossiers_delete`.
- Baseline (21): `technical_configuration_baseline_draft_create`,
  `technical_configuration_baseline_draft_get`,
  `technical_configuration_baseline_versions_list`,
  `technical_configuration_baseline_lock`,
  `technical_configuration_baseline_copy`,
  `technical_configuration_baseline_cross_dossier_sources_list`,
  `technical_configuration_baseline_cross_dossier_copy_preview`,
  `technical_configuration_baseline_cross_dossier_copy_apply`,
  `technical_configuration_baseline_group_create`,
  `technical_configuration_baseline_group_update`,
  `technical_configuration_baseline_group_delete`,
  `technical_configuration_baseline_groups_reorder`,
  `technical_configuration_baseline_criterion_create`,
  `technical_configuration_baseline_criterion_update`,
  `technical_configuration_baseline_criterion_delete`,
  `technical_configuration_baseline_criteria_reorder`,
  `technical_configuration_baseline_bulk_preview`,
  `technical_configuration_baseline_import_preview`,
  `technical_configuration_baseline_import_preview_v2`,
  `technical_configuration_baseline_import_apply`,
  `technical_configuration_baseline_import_apply_v2`.
- Baseline hierarchy authoring (7):
  `technical_configuration_baseline_subgroup_create`,
  `technical_configuration_baseline_subgroup_update`,
  `technical_configuration_baseline_subgroup_delete`,
  `technical_configuration_baseline_subgroups_reorder`,
  `technical_configuration_baseline_hierarchy_criterion_create`,
  `technical_configuration_baseline_hierarchy_criterion_move`,
  `technical_configuration_baseline_hierarchy_criteria_reorder`.
- Reference products (5):
  `technical_configuration_reference_products_list`,
  `technical_configuration_reference_product_create`,
  `technical_configuration_reference_product_update`,
  `technical_configuration_reference_product_delete`,
  `technical_configuration_reference_response_upsert`.
- Documents/citations (17):
  `technical_configuration_baseline_documents_list`,
  `technical_configuration_baseline_document_create`,
  `technical_configuration_baseline_document_update`,
  `technical_configuration_baseline_document_delete`,
  `technical_configuration_baseline_citation_upsert`,
  `technical_configuration_baseline_citation_delete`,
  `technical_configuration_reference_document_create`,
  `technical_configuration_reference_document_update`,
  `technical_configuration_reference_document_delete`,
  `technical_configuration_reference_citation_upsert`,
  `technical_configuration_reference_citation_delete`,
  `technical_configuration_option_documents_list`,
  `technical_configuration_option_document_create`,
  `technical_configuration_option_document_update`,
  `technical_configuration_option_document_delete`,
  `technical_configuration_option_citation_upsert`,
  `technical_configuration_option_citation_delete`.
- Suppliers/options/responses/import (13):
  `technical_configuration_suppliers_list`,
  `technical_configuration_supplier_create`,
  `technical_configuration_supplier_update`,
  `technical_configuration_supplier_delete`,
  `technical_configuration_options_list`,
  `technical_configuration_option_create`,
  `technical_configuration_option_update`,
  `technical_configuration_option_delete`,
  `technical_configuration_comparison_set_get_or_create`,
  `technical_configuration_option_response_upsert`,
  `technical_configuration_comparison_set_get`,
  `technical_configuration_option_import_preview`,
  `technical_configuration_option_import_apply`.
- Comparison/assessment/ranking/export (10):
  `technical_configuration_comparison_get`,
  `technical_configuration_assessments_list`,
  `technical_configuration_evaluation_criteria_list`,
  `technical_configuration_assessment_upsert`,
  `technical_configuration_reference_ranking_list`,
  `technical_configuration_result_export_manifest_get`,
  `technical_configuration_result_export_ranking_list`,
  `technical_configuration_result_export_matrix_list`,
  `technical_configuration_result_export_option_axis_list`,
  `technical_configuration_result_export_criterion_axis_list`.

Canonical collection ownership currently totals 74 names. The five dossier
list/get/create/update/archive names remain literals in `allowed-functions.ts`;
only dossier delete has a canonical owner. Phase 7 must consolidate all six
dossier names and compose one 79-name aggregate without changing membership.

### Retained shell/account infrastructure: 2

- `don_vi_branding_get`
- `change_password`

These are explicit expert allows in Phase 8. Server-side authorization-profile
refresh is authentication infrastructure and is not a client-callable proxy
allow.

### Expert-denied: 158

- 1-20: `equipment_list`, `equipment_get`, `equipment_get_by_code`,
  `equipment_create`, `equipment_update`, `equipment_delete`,
  `equipment_restore`, `equipment_bulk_delete`, `equipment_count`,
  `equipment_count_enhanced`, `equipment_attention_list`,
  `equipment_attention_list_paginated`, `equipment_attachments_list`,
  `equipment_attachment_create`, `equipment_attachment_delete`,
  `equipment_history_list`, `equipment_list_enhanced`,
  `equipment_list_for_reports`, `equipment_aggregates_for_reports`,
  `departments_list`.
- 21-40: `departments_list_for_tenant`, `departments_list_for_facilities`,
  `equipment_users_list_for_tenant`, `equipment_locations_list_for_tenant`,
  `equipment_classifications_list_for_tenant`,
  `equipment_statuses_list_for_tenant`,
  `equipment_funding_sources_list_for_tenant`, `equipment_filter_buckets`,
  `equipment_department_distribution`, `equipment_aggregate_search`,
  `equipment_bulk_import`, `repair_request_list`, `repair_request_get`,
  `repair_request_create`, `repair_request_update`, `repair_request_approve`,
  `repair_request_complete`, `repair_request_delete`,
  `get_repair_request_facilities`, `repair_request_status_counts`.
- 41-60: `repair_request_change_history_list`,
  `repair_request_active_for_equipment`,
  `zbs_notification_outbox_pending_for_dispatch`,
  `zbs_notification_outbox_claim_for_dispatch`,
  `zbs_notification_outbox_mark_sent`,
  `zbs_notification_outbox_mark_failed`, `zbs_oauth_token_state_get`,
  `zbs_oauth_token_state_persist_success`,
  `zbs_oauth_token_state_record_error`, `transfer_request_list`,
  `transfer_request_page_data`, `transfer_request_list_enhanced`,
  `transfer_request_get`, `transfer_request_create`, `transfer_request_update`,
  `transfer_request_update_status`, `transfer_request_delete`,
  `transfer_request_complete`, `transfer_change_history_list`,
  `get_transfer_request_facilities`.
- 61-80: `get_equipment_location_suggestions`, `transfer_request_counts`,
  `maintenance_plan_list`, `maintenance_plan_get`, `maintenance_plan_create`,
  `maintenance_plan_update`, `maintenance_plan_delete`,
  `maintenance_plan_approve`, `maintenance_plan_reject`,
  `maintenance_tasks_list`, `maintenance_tasks_list_with_equipment`,
  `maintenance_tasks_bulk_insert`, `maintenance_task_update`,
  `maintenance_task_complete`, `maintenance_tasks_delete`,
  `maintenance_stats_enhanced`, `maintenance_stats_for_reports`,
  `get_maintenance_report_data`, `maintenance_plan_status_counts`,
  `dashboard_kpi_summary`.
- 81-100: `ai_equipment_lookup`, `ai_maintenance_plan_lookup`,
  `ai_maintenance_summary`, `ai_repair_summary`, `ai_usage_summary`,
  `ai_attachment_metadata`, `ai_device_quota_lookup`,
  `ai_quota_compliance_summary`, `ai_category_suggestion`,
  `ai_department_list`, `ai_kill_switch_status`, `ai_kill_switch_set`,
  `assistant_query_database_audit_log`, `tenant_list`,
  `get_facilities_with_equipment_count`, `get_accessible_facilities`,
  `user_create`, `user_list_for_admin`, `user_update_profile`,
  `user_delete_by_admin`.
- 101-120: `reset_password_by_admin`, `user_membership_add`,
  `user_membership_remove`, `user_set_current_don_vi`, `don_vi_list`,
  `don_vi_get`, `don_vi_create`, `don_vi_update`, `don_vi_set_active`,
  `don_vi_user_hierarchy`, `usage_analytics_overview`,
  `usage_analytics_daily`, `usage_log_list`, `usage_session_start`,
  `usage_session_end`, `usage_log_delete`, `equipment_status_distribution`,
  `unused_equipment_report_for_reports`, `audit_logs_list`,
  `audit_logs_list_v2`.
- 121-140: `audit_logs_stats`, `audit_logs_recent_summary`,
  `dashboard_repair_request_stats`, `dashboard_maintenance_plan_stats`,
  `dashboard_maintenance_count`, `dashboard_equipment_total`,
  `maintenance_calendar_events`, `dashboard_recent_activities`,
  `debug_claims`, `test_jwt_claims`, `header_notifications_summary`,
  `dinh_muc_quyet_dinh_list`, `dinh_muc_quyet_dinh_get`,
  `dinh_muc_quyet_dinh_create`, `dinh_muc_quyet_dinh_update`,
  `dinh_muc_quyet_dinh_activate`, `dinh_muc_quyet_dinh_delete`,
  `dinh_muc_nhom_list`, `dinh_muc_nhom_list_paginated`,
  `dinh_muc_nhom_get`.
- 141-158: `dinh_muc_nhom_upsert`, `dinh_muc_nhom_delete`,
  `dinh_muc_nhom_bulk_import`, `dinh_muc_unified_import`,
  `dinh_muc_thiet_bi_link`, `dinh_muc_thiet_bi_unlink`,
  `dinh_muc_thiet_bi_unassigned`,
  `dinh_muc_thiet_bi_unassigned_filter_options`,
  `dinh_muc_thiet_bi_by_nhom`, `dinh_muc_thiet_bi_by_ids`,
  `dinh_muc_chi_tiet_list`, `dinh_muc_chi_tiet_upsert`,
  `dinh_muc_chi_tiet_delete`, `dinh_muc_chi_tiet_bulk_import`,
  `dinh_muc_compliance_summary`, `dinh_muc_compliance_detail`,
  `dinh_muc_thiet_bi_unassigned_names`, `dinh_muc_thiet_bi_link_batch`.

The future expert allow set must be constructed positively from the canonical
79-name module aggregate plus the two retained names. It must not be computed by
subtracting this denied list from `ALLOWED_FUNCTIONS`.

## Technical Configurations SQL Inventory

### Local and live parity

- Local migrations define 80 `technical_configuration_*` functions.
- The 79 canonical client-callable names above are present locally and live.
- The only extra local prefixed function is
  `technical_configuration_baseline_validate_source_lineage`; it is an
  internal-only helper and is absent from `ALLOWED_FUNCTIONS`.
- All 79 live canonical RPCs are `SECURITY DEFINER`, have
  `search_path=public, pg_temp`, grant execute to `authenticated`, and do not
  grant execute to `anon`.
- The internal lineage validator has no direct execute grant to
  `anon`, `authenticated`, or `service_role`.
- The three cross-dossier functions are already local/live and directly invoke
  the current global guard:
  `technical_configuration_baseline_cross_dossier_sources_list`,
  `technical_configuration_baseline_cross_dossier_copy_preview`, and
  `technical_configuration_baseline_cross_dossier_copy_apply`.

### Guard graph

- Current helper: `_technical_configuration_require_global_user()`.
- Current accepted roles: `global`, `admin`.
- Direct live callers: 49 module functions; the remaining canonical functions
  reach authorization through module helper chains.
- `_technical_configuration_require_authorized_user()` is absent locally/live.
- `user_reassign_expert_scope` is absent locally/live.
- Required Phase 11 exception inventory:
  `technical_configuration_baseline_import_preview_v2`
  -> `_technical_configuration_baseline_import_validate_v2`
  -> `_technical_configuration_baseline_import_validate_metadata_v2`.
  The metadata helper performs inline JWT/global-admin checks instead of
  reaching the shared guard. Phase 11 must explicitly replace/classify this
  chain and include it in the transitive guard assertion.

## Migration Ordering

All future migrations are additive and must sort after the current migration
tip as well as the latest local definition they replace.

| Future owner                                            | Latest local dependency                                                                                                                       | Ordering constraint                                                                                                                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 9 session profile RPC                             | `supabase/migrations/20260503120000_add_session_profile_for_jwt_rpc.sql` defines `get_session_profile_for_jwt`; live return shape has no role | New additive RPC must sort after this file and the then-current migration tip                                                                                                                                                      |
| Phase 11 module guard                                   | `supabase/migrations/20260712112500_technical_configuration_dossier_foundation.sql` owns `_technical_configuration_require_global_user()`     | Replacement must sort after every later Technical Configurations definition, currently through `supabase/migrations/20260819031200_technical_configuration_baseline_cross_dossier_copy.sql`, and cover the preview-v2 inline chain |
| Phase 12 `user_create`                                  | Latest definition: `supabase/migrations/20260509015738_reassert_user_boundary_review_fixes_round_2.sql`                                       | Account-scope migration must sort after this and all preceding rollout migrations                                                                                                                                                  |
| Phase 12 `user_update_profile` / `user_delete_by_admin` | `supabase/migrations/20260508134826_harden_nhan_vien_privileges_and_rls.sql`                                                                  | Same additive ordering rule                                                                                                                                                                                                        |
| Phase 12 membership add/remove                          | `supabase/migrations/2025-09-15/20250915_user_tenant_rpcs.sql`                                                                                | Same additive ordering rule; live functions have baseline debt: `SECURITY DEFINER` without pinned `search_path` and broad execute including `anon`. Phase 12 owns the fix.                                                         |
| Phase 12 current tenant                                 | Latest `user_set_current_don_vi`: `supabase/migrations/20260509005630_reassert_user_boundary_review_fixes.sql`                                | Same additive ordering rule                                                                                                                                                                                                        |

`supabase/applied-migrations.lock.json` is append-only: `legacy` contains 330
entries ending at
`supabase/migrations/20260815105027_harden_device_quota_unlink_contract.sql`;
the post-cutover `applied` array is currently empty. Phase 1 does not modify the
lock.

## Phase File Map

| Phase | Primary ownership                                                                                                      |
| ----- | ---------------------------------------------------------------------------------------------------------------------- |
| 2     | `src/lib/rbac.ts`, `src/lib/__tests__/rbac.test.ts`, `src/auth/server-claims.ts`, auth type assertions                 |
| 3     | Chat route/prompts/scope, six Device Quota suggestion route files/helpers, two tenant routes, focused API tests        |
| 4     | `src/lib/rbac.ts`, `src/types/database.ts`, `docs/RBAC.md`                                                             |
| 5     | `src/lib/app-route-access.ts`, middleware auth gate, authenticated redirect/landing, login, navigation tests           |
| 6     | `src/app/(app)/_components/AppLayoutShell.tsx` and its tests; branding/query isolation                                 |
| 7     | Technical Configurations RPC-name owner modules, `allowed-functions.ts`, whitelist completeness tests                  |
| 8     | `src/app/api/rpc/[fn]/route.ts`, `allowed-functions.ts`, proxy/JWT-skew tests                                          |
| 9     | Additive session-profile migration, focused SQL tests, static plus Oracle baseline-forward gate                        |
| 10    | Auth config/profile refresh and JWT cooldown/event tests                                                               |
| 11    | Additive module-guard migration, representative/transitive SQL tests, both database gate lanes                         |
| 12    | Additive account-scope migration for user/membership/current-tenant RPCs, security SQL tests, both database gate lanes |
| 13    | User-management server/API/hook assignment contract; no visible expert option yet                                      |
| 14    | User-management dialogs, labels, columns/cards, and `useUsersManagement` activation tests                              |
| 15    | `docs/RBAC.md`, OpenSpec consolidation, final stale-assumption scan                                                    |

## Focused Verification Commands

Use the repository wrapper and keep each phase focused:

```bash
# Phase 2
node scripts/npm-run.js run test -- --run \
  src/lib/__tests__/rbac.test.ts \
  src/auth/__tests__/server-claims.test.ts

# Phase 3
node scripts/npm-run.js run test -- --run \
  src/app/api/chat/__tests__/route.auth-and-schema.test.ts \
  src/app/api/device-quota/mapping/suggest/__tests__/route.test.ts \
  src/app/api/device-quota/mapping/suggest/__tests__/suggestion-job-routes.test.ts \
  src/app/api/tenants/__tests__/tenant-routes.test.ts

# Phase 5
node scripts/npm-run.js run test -- --run \
  src/lib/__tests__/app-route-access.test.ts \
  src/__tests__/middleware.auth-gate.test.ts \
  src/app/__tests__/page.authenticated-redirect.test.tsx \
  src/app/_components/__tests__/LoginForm.test.tsx \
  src/components/__tests__/app-navigation.test.ts

# Phase 6
node scripts/npm-run.js run test -- --run \
  'src/app/(app)/__tests__/AppLayoutShell.test.tsx'

# Phases 7-8
node scripts/npm-run.js run test -- --run \
  src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts \
  src/app/api/rpc/__tests__/rpc-jwt-skew.unit.test.ts

# Phases 9-10
node scripts/npm-run.js run test -- --run \
  src/auth/__tests__/auth-config.jwt-rpc.test.ts \
  src/auth/__tests__/auth-config.jwt-cooldown.test.ts \
  src/auth/__tests__/auth-config.authorize-events.test.ts

# Phases 13-14
node scripts/npm-run.js run test -- --run \
  'src/app/(app)/users/__tests__/useUsersManagement.test.tsx' \
  src/app/api/tenants/__tests__/tenant-routes.test.ts

# OpenSpec
openspec validate add-technical-configuration-expert-role \
  --type change --strict --no-interactive
```

Migration phases 9, 11, and 12 must additionally run
`node scripts/npm-run.js run db:quality-gate:local` and the manual Oracle
baseline-forward lane for the same exact landed commit. A gate PASS does not
authorize a live write.

For TypeScript/React diffs, preserve the repository verification order:
`format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`, focused
Vitest, then `react-doctor`.

## Phase 1 Exit Checklist

- [x] Current `main` snapshot and active Technical Configurations changes were
      included.
- [x] Every exported RBAC helper and its production consumers were classified.
- [x] Every direct/derived role boundary was assigned an expert disposition or
      explicitly excluded as a non-RBAC/type-only match.
- [x] All eight standalone role-aware API routes were classified.
- [x] All 239 generic proxy functions were classified exactly once.
- [x] All 79 canonical module RPCs and the one internal-only prefixed function
      were classified against local and live read-only state.
- [x] The inline preview-v2 authorization exception was assigned to Phase 11.
- [x] Session-profile, module-guard, and account-scope migration ordering is
      explicit.
- [x] Phase ownership and focused verification commands are frozen before any
      production edit.
