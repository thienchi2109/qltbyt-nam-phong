Feature: Global-only “Cấu hình đơn vị” (Tenants configuration) implemented and optimized.

Scope:
- DB: Added membership_quota (int), logo_url (text) to public.don_vi. Added robust JWT claims helper public._get_jwt_claim.
- RPCs (public): don_vi_list, don_vi_get, don_vi_create, don_vi_update, don_vi_set_active.
  * Enforce global/admin via app_role with fallback admin→global.
  * don_vi_list returns empty for non-global (UI gated). Sorting whitelist; pagination.
  * Fixed 400s and ambiguity by qualifying columns and normalizing responses.
  * Membership count source of truth: COUNT users with nhan_vien.current_don_vi = tenant id (index on current_don_vi). Previously buggy union logic replaced.
- API Proxy: Whitelist updated to include don_vi_* functions. Claims (app_role, don_vi, user_id) unchanged.
- UI: Tenants management embedded into Users page via tab layout (default tab = Đơn vị). Standalone /tenants delegates to shared component.
  * Components: tenants-management.tsx (list/search/paginate/toggle), add-tenant-dialog.tsx, edit-tenant-dialog.tsx.
  * Shadcn/UI + React Query v5 patterns; stopPropagation on row actions.
- React Query optimizations:
  * Debounced search; keepPreviousData for pagination; long staleTime; no focus refetch.
  * Optimistic toggle with rollback and cache-merge on success.
  * Create/Edit mutate and update cached rows directly (no invalidation).
- AGENTS.md: Noted migrations run via Supabase SQL Editor (no CLI); commands/docs updated.

Status:
- Errors fixed: don_vi_list 400, don_vi_set_active ambiguous id, don_vi_update quota update 400, membership count inconsistency.
- Typecheck/build pass. No NextAuth/RPC contract break.

Next:
- Optionally add Storage upload for logo URLs; add unit tests when test runner is added.