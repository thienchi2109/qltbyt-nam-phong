# Activity Logs: Event Taxonomy and Helper Usage

Last updated: 2025-09-25

## Overview
This document defines the canonical event taxonomy, how to write logs using the unified helper, and how to query them from the API and UI.

## Entity Types
- device
- repair_request
- transfer_request
- maintenance_plan
- user

Use these exact strings in the `entity_type` column. They power server filtering and UI chips.

## Action Types (examples)
Authentication & User:
- password_change, password_reset_admin, USER_UPDATE, user_create, user_delete, user_role_change, login_success, login_failed, logout

Equipment:
- equipment_create, equipment_update, equipment_delete, equipment_import, equipment_status_change

Maintenance:
- maintenance_plan_create, maintenance_plan_update, maintenance_plan_delete, maintenance_plan_approve, maintenance_plan_reject, maintenance_task_create, maintenance_task_update, maintenance_task_complete, maintenance_task_delete

Transfer:
- transfer_request_create, transfer_update, transfer_approve, transfer_reject, transfer_complete, transfer_delete

Repair:
- repair_request_create, repair_request_update, repair_request_approve, repair_request_complete, repair_request_delete

Keep names lowercase with underscores. Update the UI label map in `src/hooks/use-audit-logs.ts` (ACTION_TYPE_LABELS) when adding new keys.

## Writing Logs (Unified Helper)
Use the helper everywhere instead of direct inserts:

```
PERFORM public.audit_log(
  p_action_type := 'equipment_update',
  p_entity_type := 'device',
  p_entity_id   := v_device_id,
  p_entity_label:= v_device_code, -- short human label shown in UI
  p_action_details := jsonb_build_object('changes', v_changes_json)
);
```

Notes:
- User and tenant context are derived from JWT claims; no need to pass them.
- The helper never raises on failure; it warns and returns false. Do not rely on its return value for transaction control.

## Querying Logs
Prefer `public.audit_logs_list_v2`:
- Filters: `p_entity_type`, `p_entity_id`, `p_text_search`, `p_action_type`, `p_user_id`, `p_date_from`, `p_date_to`
- Enforces `app_role = 'global'`
- Returns array of rows with pagination field `total_count` included in each row

Compatibility for legacy rows:
- When `p_entity_type = 'user'`, v2 also includes legacy user events where `entity_type IS NULL` but the row clearly represents a user action (e.g., has `target_user_id` or a known user action_type). Backfill script also sets `entity_type='user'` where possible.

## UI Integration
- Entity filter chips drive `p_entity_type`
- Search box maps to `p_text_search` (matches `entity_label` or `action_details` text)
- Update `ACTION_TYPE_LABELS` for new action names

## How to Add a New Event Class
1. Choose `entity_type` (one of the allowed values; add only if truly necessary)
2. Define concise `action_type` (snake_case), add Vietnamese label in `ACTION_TYPE_LABELS`
3. Instrument the relevant RPC with a single call to `public.audit_log()` after successful mutation
4. If you add a new entity_type: add UI chip and consider an index if you expect high volume

## Testing
SQL smoke tests:
- See `supabase/tests/audit_logs_v2_smoke.sql`
- Run via psql or `supabase db execute` in a development branch

TypeScript tests:
- See `src/lib/__tests__/audit_logs_utils.spec.ts`
- Suggested setup with Vitest: `npm i -D vitest` and add `"test": "vitest"` to package.json

## Security Notes
- All audit RPCs are SECURITY DEFINER and set `SET search_path = public, pg_temp`
- Global-only read access is enforced in SQL
- Project continues to use RPC-only, no-RLS model; block direct table access at the API gateway
