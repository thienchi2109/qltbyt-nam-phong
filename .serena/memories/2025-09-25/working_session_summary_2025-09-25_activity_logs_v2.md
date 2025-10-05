Working Session Summary – 2025-09-25 (Activity Logs v2 + Instrumentation)

Key outcomes
- Planned and created v2 audit logging migrations:
  1) audit_logs_v2_entities_and_helper.sql – adds entity_type/entity_id/entity_label/tenant_don_vi, indexes, unified audit_log helper, audit_logs_list_v2, and hardened search_path on audit functions.
  2) audit_logs_v2_instrument_rpcs.sql – instruments equipment create/update, repair_request_create, transfer_request_create, and maintenance_plan_create to log via audit_log; hardens search_path on these where modified.
  3) audit_logs_v2_backfill_user_entity.sql – backfills legacy user logs and adds compatibility fallback in v2 list so the “Người dùng” filter shows expected entries.
  4) performance_fk_indexes.sql – adds covering indexes for advisor-flagged foreign keys and ANALYZE.

- API/UI updates:
  • Whitelisted audit_logs_list_v2 in RPC proxy.
  • Extended use-audit-logs hooks to support entity_type/entity_id/text_search and call v2.
  • Added Entity filter to Activity Logs UI and show entity_label.

- Tests & docs:
  • SQL smoke tests under supabase/tests for role gating and read-back.
  • Vitest utility test for label mapping and details formatting.
  • Doc: docs/activity-logs-event-taxonomy.md (taxonomy, helper usage, querying, testing).

- Advisors: Re-ran security/perf advisors; recorded remaining items (mutable search_path across many non-audit RPCs; unindexed FKs; unused indexes info).

- Security plan: Saved dedicated memory describing next-iteration hardening to pin search_path on equipment_*, repair_request_*, transfer_request_*, maintenance_*; schema-qualify objects; qualify extension funcs.

Notes
- Per project rule, migrations were created only and not applied.
- All changes have been committed to branch feat/new_role.