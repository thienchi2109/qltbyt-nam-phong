# Read Scope Enforcement (Phase RPC-1)

## Overview
Phase RPC-1 builds on AUTH-1 to guarantee every read-oriented RPC respects the caller's multi-tenant scope, including the new `regional_leader` area access. The updates centralize tenant filtering via `public.allowed_don_vi_for_session()` and explicitly block regional leaders from write flows that were previously tenant-scoped only.

## Deliverables ✅
- ✅ New migration `20250927153000_regional_leader_rpc_enforcement.sql` recreates the core read RPCs to consume `allowed_don_vi_for_session()`.
- ✅ Follow-up migration `20250927170500_allowed_don_vi_claim_fix.sql` syncs the helper with JWT `app_role`/`dia_ban` claims to keep read RPCs reachable post AUTH-1.
- ✅ `equipment_list`, `equipment_get`, and JSON list/count analytics now support multi-tenant arrays and enforce access checks for supplied `p_don_vi` parameters.
- ✅ `transfer_request_list_enhanced`, `usage_analytics_*`, and `maintenance_stats_enhanced` align with the same scope rules, returning zero data when the session has no authorized tenants.
- ✅ Write RPCs `equipment_update` and `equipment_delete` now explicitly short-circuit for `regional_leader` roles to keep the persona read-only.

## Technical Notes
- Read RPCs resolve `v_role`/`v_allowed` once, fall back to complete tenant coverage for global sessions, and verify user-supplied `p_don_vi` arguments belong to the allowed set. `allowed_don_vi_for_session()` now looks at `app_role` first to match our proxy-issued JWTs.
- Regional leaders inherit all `don_vi` IDs inside their `dia_ban` from `allowed_don_vi_for_session()`; no client changes are required.
- Empty tenant arrays (e.g., improperly configured staff) return empty payloads instead of throwing, preventing data leakage.
- Equipment write endpoints now raise `ERRCODE 42501` for `regional_leader` or `user` submissions, keeping admin tooling unchanged for existing roles.

## Validation
- SQL migration reviewed for idempotency (CREATE OR REPLACE used throughout) and grants remain unchanged.
- Manual reasoning walkthrough ensures non-global roles cannot request out-of-scope tenants; global sessions retain optional tenant filters.
- No TypeScript changes were required; frontend contract stays identical.

## Follow-Up
- Extend the same pattern to any remaining write RPCs outside the equipment module that may accept tenant IDs (track in QA checklist).
- Once staged data is available, add DO-block smoke tests that simulate JWT claims for regional leader/global personas.
- Coordinate with API/UI-1 to wire new multi-tenant filters into tenant switch endpoints and navigation guards.
