## 1. RED - Lock the role and route contract

- [ ] 1.1 Add failing role type/label tests for canonical `chuyen_gia`.
- [ ] 1.2 Add a table-driven helper matrix proving
      `isTechnicalConfigurationExpertRole()` accepts only `chuyen_gia`,
      `canAccessTechnicalConfigurations()` accepts only
      `global/admin/chuyen_gia`, and every pre-existing RBAC helper rejects
      `chuyen_gia`.
- [ ] 1.3 Extend `src/lib/__tests__/app-route-access.test.ts` with failing cases
      showing `chuyen_gia` can enter `/technical-configurations` and
      `/access-denied` but no other mapped app route.
- [ ] 1.4 Extend `src/__tests__/middleware.auth-gate.test.ts` with failing
      direct-request cases for Dashboard, other mapped routes, unknown paths, and
      Technical Configurations descendants.
- [ ] 1.5 Add failing landing tests in
      `src/app/__tests__/page.authenticated-redirect.test.tsx` and
      `src/app/_components/__tests__/LoginForm.test.tsx`.
- [ ] 1.6 Extend `src/components/__tests__/app-navigation.test.ts` with a
      failing expert-only navigation case and global/admin counter-cases.

## 2. RED - Lock shell, session, and account behavior

- [ ] 2.1 Add focused `AppLayoutShell` tests proving unrelated controls are
      absent and their notification/search/assistant/tenant bootstraps are disabled
      for `chuyen_gia`, while assigned-unit branding remains enabled and
      global/admin retain the normal shell.
- [ ] 2.2 Add failing auth helper tests proving a due profile refresh replaces
      stale `global` with database role `chuyen_gia`, replaces old
      `don_vi`/`dia_ban_id` values, and clears a stale non-null `khoa_phong` when
      the authoritative expert profile returns null.
- [ ] 2.3 Add failing auth callback tests proving an empty, unsupported, missing,
      or failed authorization profile refresh invalidates the session instead of
      retaining a stale role; a refreshed expert missing `don_vi` or resolvable
      `dia_ban_id` must not fall back to old token scope.
- [ ] 2.4 Extend
      `src/app/(app)/users/__tests__/useUsersManagement.test.tsx` and dialog tests
      for global/admin assignment of `chuyen_gia` with required `don_vi`,
      membership, and resolvable `dia_ban_id`; add SQL/server tests proving
      global/admin cannot later remove or switch the required membership/current
      unit through generic RPCs, and proving
      `user_reassign_expert_scope(p_user_id, p_don_vi)` performs a valid
      replacement atomically.
- [ ] 2.5 Add direct-request deny tests for every role-aware standalone feature
      API, including Chat, tenant memberships, tenant switching, Device Quota
      asynchronous suggestion jobs, and the synchronous
      `assertSuggestionAccess()` provider boundary, plus server-side deny tests
      for Users/Tenants management RPCs.
- [ ] 2.6 Add JWT-claim tests proving `admin` alone normalizes to `global` and
      `chuyen_gia` remains unchanged.
- [ ] 2.7 Add an explicit RPC proxy claim matrix proving expert null/empty
      `khoa_phong` reaches Technical Configurations with a null department JWT
      claim, non-expert null remains rejected, and non-expert empty retains the
      current accepted-and-normalized behavior.
- [ ] 2.8 Add a table-driven proxy test that classifies every
      `ALLOWED_FUNCTIONS` entry as Technical Configurations, required
      retained-shell/account/session infrastructure, or expert-denied; prove
      representative allowlisted non-module RPCs such as
      `dinh_muc_quyet_dinh_list` return `403` before JWT minting/upstream fetch,
      while `don_vi_branding_get` and `change_password` remain available. Add
      positive counter-cases proving both `global` and a raw `admin` session
      retain representative non-module RPC access.
- [ ] 2.9 Add proxy tests proving an exact expert's authorized Technical
      Configurations request bypasses `tenantScopedRpcBody()` and preserves
      caller-supplied `p_don_vi`/`p_dia_ban`, while existing roles retain their
      current rewrite behavior.

## 3. RED - Lock database authorization

- [ ] 3.1 Inventory current local and live Technical Configurations RPCs after
      syncing `main`, including RPCs introduced by
      `add-technical-configuration-comparison` and
      `harden-technical-configuration-baseline-copy-and-excel`.
- [ ] 3.2 Add a focused SQL authorization gate proving every authenticated
      module-owned RPC reaches the canonical helper or compatibility wrapper
      directly or through a verified module-helper call chain, and no unrelated
      RPC reaches that guard.
- [ ] 3.3 Add SQL tests proving `global/admin/chuyen_gia` pass the module guard
      and every other application role, missing claim, invalid user, and malformed
      claim fail with `42501`.
- [ ] 3.4 Extend representative read, write, import/export, copy, lock, and
      assessment SQL phase gates with `chuyen_gia` allow cases while preserving
      their existing domain assertions.
- [ ] 3.5 Add SQL tests for global/admin creation and update of a `chuyen_gia`
      account with required `don_vi`, membership, and resolvable `dia_ban_id`;
      prove unauthorized callers and tenant-switch attempts are denied, and
      cover `user_membership_add`, `user_membership_remove`,
      `user_set_current_don_vi`, plus related management paths with invariant
      preservation and no-change-on-rejection assertions. Add success, rollback,
      invalid-destination, and unauthorized-caller tests for
      `user_reassign_expert_scope`.

## 4. GREEN - Implement application RBAC

- [ ] 4.1 Add `chuyen_gia: "Chuyên gia"` to canonical role types and labels
      without changing `admin -> global` normalization.
- [ ] 4.2 Add shared Edge-safe `isTechnicalConfigurationExpertRole(role)` and
      `canAccessTechnicalConfigurations(role)` predicates with distinct exact-role
      and module-capability semantics.
- [ ] 4.3 Update the centralized route evaluator with the expert-only
      constrained-route rule while preserving segment-boundary matching, unknown
      404 pass-through, `/_next/data/**` protection, and extension-looking dynamic
      paths.
- [ ] 4.4 Add `getDefaultAppRoute(role)` and use it from the authenticated root;
      route successful client login through `/` so the server decision is
      authoritative.
- [ ] 4.5 Update app navigation so `chuyen_gia` receives only Technical
      Configurations.
- [ ] 4.6 Add an exact, fail-closed expert RPC allow set assembled only from
      one complete canonical Technical Configurations RPC-name aggregate and
      explicit minimal account/session exceptions. Complete the dossier
      collection, make both generic and expert allowlists consume the aggregate,
      enforce the expert set in the RPC proxy before tenant-body rewriting, JWT
      minting, or upstream fetch, and bypass tenant-body rewriting only for an
      exact expert invoking a classified module RPC.

## 5. GREEN - Implement shell and account isolation

- [ ] 5.1 Add expert-only shell mode to hide tenant selection, equipment
      search, operational notifications, AI Assistant, onboarding/help, and mobile
      feature actions.
- [ ] 5.2 Disable every hidden feature's backing fetch/bootstrap while keeping
      `useTenantBranding()` scoped to the assigned `don_vi`, application
      identity, role/account display, change-password, and sign-out.
- [ ] 5.3 Update global/admin user-management forms and hooks to offer
      `chuyen_gia` only with assigned `don_vi`, membership, and resolvable
      `dia_ban_id`; do not expose tenant switching.
- [ ] 5.4 Replace role-derived all-role allowlists such as
      `Object.values(ROLES)` with explicit capability/allowlist checks and keep
      every unrelated standalone feature API denied to `chuyen_gia`; preserve
      and independently test the Device Quota job-route helper and synchronous
      provider allowlist boundaries.
- [ ] 5.5 Keep Users/Tenants routes and management actions denied to
      `chuyen_gia`.
- [ ] 5.6 Guard every global/admin membership and current-unit mutation path so
      `user_membership_add`, `user_membership_remove`,
      `user_set_current_don_vi`, and related generic flows reject every
      expert-targeted add, removal, or current/home scope switch regardless of
      whether a destination membership already exists; keep non-expert behavior
      unchanged.

## 6. GREEN - Implement authoritative session role refresh

- [ ] 6.1 Add a correctly ordered append-only migration defining a new
      JWT-guarded session authorization profile RPC that returns current database
      role plus the existing profile fields.
- [ ] 6.2 Preserve `SECURITY DEFINER`, `SET search_path = public, pg_temp`,
      explicit execute grants/revokes, user-ID claim matching, and fail-closed
      behavior.
- [ ] 6.3 Update session profile types and `applyJwtProfileRefresh` to validate
      and apply the database role to JWT/session state. For `chuyen_gia`,
      authoritatively replace `don_vi`, resolved `dia_ban_id`/`dia_ban_ma`, and
      `khoa_phong`; never retain stale token scope as fallback.
- [ ] 6.4 Update `src/app/api/rpc/[fn]/route.ts` to use the exact expert-role
      predicate when allowing genuinely null/absent `khoa_phong`. Normalize
      expert null/empty to a null JWT claim, reject non-expert null, preserve the
      existing non-expert empty-string behavior, and keep expert `don_vi`,
      `dia_ban_id`, role, and user ID required.
- [ ] 6.5 Invalidate/sign out when a due authorization profile refresh fails,
      returns no account, or returns an empty/unsupported role; do not mint an RPC
      JWT from stale authorization.
- [ ] 6.6 Prove role changes converge on the first active refresh after the
      existing 60-second interval.

## 7. GREEN - Implement module-scoped database capability

- [ ] 7.1 Add a correctly ordered append-only migration defining
      `_technical_configuration_require_authorized_user()` for
      `global/admin/chuyen_gia`.
- [ ] 7.2 Redefine `_technical_configuration_require_global_user()` as a
      compatibility wrapper so existing landed RPCs receive the new module
      capability without editing applied migrations.
- [ ] 7.3 Update new or replaced Technical Configurations functions to use the
      canonical helper; verify every existing function is covered directly or by
      a verified helper chain and no unrelated RPC references it.
- [ ] 7.4 Update guarded user create/update role validation for
      `chuyen_gia`, required assigned scope metadata, no tenant switching, and
      global/admin-only ownership; make generic membership/current-unit mutation
      RPCs reject every expert-targeted scope change so only the named
      reassignment RPC can replace scope.
- [ ] 7.5 Add a correctly ordered append-only, global/admin-only
      `user_reassign_expert_scope(p_user_id bigint, p_don_vi bigint)` RPC that
      validates the destination and atomically establishes membership, updates
      current/home assignment, verifies resolvable `dia_ban_id`, and retires
      obsolete assignment state; register it in the generic proxy allowlist with
      an explicit expert-denied classification.
- [ ] 7.6 After 7.5 exists, wire the global/admin expert reassignment UI to the
      named transactional RPC rather than sequencing generic membership/current
      unit calls from the client.
- [ ] 7.7 Register only the focused, default-gate-safe SQL tests required for
      this change.

## 8. REFACTOR - Remove duplication and stale assumptions

- [ ] 8.1 Reuse the exact-expert predicate for constrained route/shell behavior
      and the broader module capability only for Technical Configurations access;
      do not duplicate role string comparisons.
- [ ] 8.2 Inventory unchanged code for copied role lists, direct comparisons,
      and role-derived collections such as `Object.values(ROLES)`; classify each
      boundary explicitly as include or exclude for `chuyen_gia`.
- [ ] 8.3 Preserve every pre-existing RBAC helper's semantics and document in
      `docs/RBAC.md` why `chuyen_gia` is excluded from unrelated capabilities.
- [ ] 8.4 Re-run the standalone feature API inventory and prove no endpoint
      becomes authorized merely because `ROLES` gained a new value.
- [ ] 8.5 Re-run the Technical Configurations RPC inventory after integrating
      any concurrent active-change updates.
- [ ] 8.6 Re-run the exhaustive `ALLOWED_FUNCTIONS` classification and require
      every newly added proxy RPC to declare an explicit expert allow/deny
      disposition; verify all dossier and module RPC names come from the complete
      canonical aggregate rather than parallel literals.

## 9. VERIFY - Quality gates and delivery

- [ ] 9.1 Run `node scripts/npm-run.js run format:check`.
- [ ] 9.2 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 9.3 Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] 9.4 Run `node scripts/npm-run.js run typecheck`.
- [ ] 9.5 Run focused Vitest suites for the RBAC helper matrix, route policy,
      middleware, navigation, landing, shell, user management, standalone APIs,
      both Device Quota suggestion boundaries, auth callbacks, exhaustive RPC
      function classification, RPC proxy claim parsing, and RPC JWT claims.
- [ ] 9.6 Run the selected Technical Configurations and user-role SQL gates.
- [ ] 9.7 Run Database Quality Gate `static` and Oracle `baseline-forward`
      against the same exact commit; report the lanes separately.
- [ ] 9.8 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 9.9 Verify the final diff contains no unrelated RBAC, domain behavior, or
      migration-history edits.
- [ ] 9.10 Do not apply migrations to live without a separate explicit
      maintainer permission for that exact Supabase MCP write; after an authorized
      apply, run security advisors and read-back verification.
