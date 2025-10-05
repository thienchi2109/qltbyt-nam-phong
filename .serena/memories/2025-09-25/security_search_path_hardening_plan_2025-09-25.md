Security hardening plan (search_path) – Status 2025-09-25

Summary
- We hardened all audit_* functions by setting `SET search_path = public, pg_temp` and schema-qualifying objects.
- Advisors still flag many non-audit RPCs (equipment_*, repair_request_*, transfer_request_*, maintenance_*).
- Risk: SECURITY DEFINER + mutable search_path can resolve unqualified names to attacker-controlled objects.

Plan (next iteration)
1) For each high-surface RPC: add `SET search_path = public, pg_temp`.
2) Ensure all tables/functions are schema-qualified (e.g., public.thiet_bi).
3) Qualify extension funcs explicitly (e.g., extensions.gen_random_uuid() or pg_catalog.*).
4) Put all CREATE OR REPLACE/ALTER statements in one migration; add SQL DO-block tests.
5) Re-run advisors to verify warnings cleared.

Scope candidates
- equipment_* (create/update/list/get/delete, counts, attachments, history)
- repair_request_* (create/update/approve/complete/list/delete)
- transfer_request_* (create/update/status/list/complete/delete, history)
- maintenance_* (plan_*, tasks_*, stats*)

Status
- Deferred by user decision; to be implemented in a subsequent migration once current feature set stabilizes.