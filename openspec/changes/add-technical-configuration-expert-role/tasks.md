## 1. RED - Lock the role and route contract

- [ ] 1.1 Add failing role type/label tests for canonical `chuyen_gia` and prove
      it is not accepted by `isGlobalRole()`.
- [ ] 1.2 Extend `src/lib/__tests__/app-route-access.test.ts` with failing cases
      showing `chuyen_gia` can enter `/technical-configurations` and
      `/access-denied` but no other mapped app route.
- [ ] 1.3 Extend `src/__tests__/middleware.auth-gate.test.ts` with failing
      direct-request cases for Dashboard, other mapped routes, unknown paths, and
      Technical Configurations descendants.
- [ ] 1.4 Add failing landing tests in
      `src/app/__tests__/page.authenticated-redirect.test.tsx` and
      `src/app/_components/__tests__/LoginForm.test.tsx`.
- [ ] 1.5 Extend `src/components/__tests__/app-navigation.test.ts` with a
      failing expert-only navigation case.

## 2. RED - Lock shell, session, and account behavior

- [ ] 2.1 Add focused `AppLayoutShell` tests proving unrelated controls are
      absent and their notification/search/assistant/tenant bootstraps are disabled
      for `chuyen_gia`.
- [ ] 2.2 Add failing auth helper tests proving a due profile refresh replaces
      stale `global` with database role `chuyen_gia`.
- [ ] 2.3 Add failing auth callback tests proving an empty, unsupported, missing,
      or failed authorization profile refresh invalidates the session instead of
      retaining a stale role.
- [ ] 2.4 Extend
      `src/app/(app)/users/__tests__/useUsersManagement.test.tsx` and dialog tests
      for global/admin assignment of `chuyen_gia` without tenant membership.
- [ ] 2.5 Add deny tests proving `chuyen_gia` cannot call Users/Tenants
      management flows.

## 3. RED - Lock database authorization

- [ ] 3.1 Inventory current local and live Technical Configurations RPCs after
      syncing `main`, including RPCs introduced by
      `add-technical-configuration-comparison` and
      `harden-technical-configuration-baseline-copy-and-excel`.
- [ ] 3.2 Add a focused SQL authorization gate proving every module-owned RPC
      uses the canonical helper or compatibility wrapper.
- [ ] 3.3 Add SQL tests proving `global/admin/chuyen_gia` pass the module guard
      and every other application role, missing claim, invalid user, and malformed
      claim fail with `42501`.
- [ ] 3.4 Extend representative read, write, import/export, copy, lock, and
      assessment SQL phase gates with `chuyen_gia` allow cases while preserving
      their existing domain assertions.
- [ ] 3.5 Add SQL tests for global/admin creation and update of a tenantless
      `chuyen_gia` account and denial for unauthorized callers.

## 4. GREEN - Implement application RBAC

- [ ] 4.1 Add `chuyen_gia: "Chuyên gia"` to canonical role types and labels
      without changing `admin -> global` normalization.
- [ ] 4.2 Add one shared Edge-safe
      `canAccessTechnicalConfigurations(role)` capability predicate.
- [ ] 4.3 Update the centralized route evaluator with the expert-only
      constrained-route rule while preserving segment-boundary matching, unknown
      404 pass-through, `/_next/data/**` protection, and extension-looking dynamic
      paths.
- [ ] 4.4 Add `getDefaultAppRoute(role)` and use it from the authenticated root;
      route successful client login through `/` so the server decision is
      authoritative.
- [ ] 4.5 Update app navigation so `chuyen_gia` receives only Technical
      Configurations.

## 5. GREEN - Implement shell and account isolation

- [ ] 5.1 Add expert-only shell mode to hide tenant selection, equipment
      search, operational notifications, AI Assistant, onboarding/help, and mobile
      feature actions.
- [ ] 5.2 Disable every hidden feature's backing fetch/bootstrap while keeping
      application identity, role/account display, change-password, and sign-out.
- [ ] 5.3 Update global/admin user-management forms and hooks to offer
      `chuyen_gia` without requiring `don_vi` or memberships.
- [ ] 5.4 Keep Users/Tenants routes and management actions denied to
      `chuyen_gia`.

## 6. GREEN - Implement authoritative session role refresh

- [ ] 6.1 Add a correctly ordered append-only migration defining a new
      JWT-guarded session authorization profile RPC that returns current database
      role plus the existing profile fields.
- [ ] 6.2 Preserve `SECURITY DEFINER`, `SET search_path = public, pg_temp`,
      explicit execute grants/revokes, user-ID claim matching, and fail-closed
      behavior.
- [ ] 6.3 Update session profile types and `applyJwtProfileRefresh` to validate
      and apply the database role to JWT/session state.
- [ ] 6.4 Invalidate/sign out when a due authorization profile refresh fails,
      returns no account, or returns an empty/unsupported role; do not mint an RPC
      JWT from stale authorization.
- [ ] 6.5 Prove role changes converge on the first active refresh after the
      existing 60-second interval.

## 7. GREEN - Implement module-scoped database capability

- [ ] 7.1 Add a correctly ordered append-only migration defining
      `_technical_configuration_require_authorized_user()` for
      `global/admin/chuyen_gia`.
- [ ] 7.2 Redefine `_technical_configuration_require_global_user()` as a
      compatibility wrapper so existing landed RPCs receive the new module
      capability without editing applied migrations.
- [ ] 7.3 Update new or replaced Technical Configurations functions to use the
      canonical helper and verify no unrelated RPC references it.
- [ ] 7.4 Update guarded user create/update role validation for
      `chuyen_gia`, null tenant assignment, and global/admin-only ownership.
- [ ] 7.5 Register only the focused, default-gate-safe SQL tests required for
      this change.

## 8. REFACTOR - Remove duplication and stale assumptions

- [ ] 8.1 Reuse the shared capability/default-route helpers across middleware,
      navigation, root landing, and shell checks; do not duplicate role string
      comparisons.
- [ ] 8.2 Search unchanged code for copied role lists and update only
      boundaries that semantically own canonical role validation.
- [ ] 8.3 Preserve `isGlobalRole()` semantics and document why
      `chuyen_gia` is intentionally excluded.
- [ ] 8.4 Re-run the Technical Configurations RPC inventory after integrating
      any concurrent active-change updates.

## 9. VERIFY - Quality gates and delivery

- [ ] 9.1 Run `node scripts/npm-run.js run format:check`.
- [ ] 9.2 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 9.3 Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] 9.4 Run `node scripts/npm-run.js run typecheck`.
- [ ] 9.5 Run focused Vitest suites for route policy, middleware, navigation,
      landing, shell, user management, auth callbacks, and RPC JWT claims.
- [ ] 9.6 Run the selected Technical Configurations and user-role SQL gates.
- [ ] 9.7 Run Database Quality Gate `static` and Oracle `baseline-forward`
      against the same exact commit; report the lanes separately.
- [ ] 9.8 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 9.9 Verify the final diff contains no unrelated RBAC, domain behavior, or
      migration-history edits.
- [ ] 9.10 Do not apply migrations to live without a separate explicit
      maintainer permission for that exact Supabase MCP write; after an authorized
      apply, run security advisors and read-back verification.
