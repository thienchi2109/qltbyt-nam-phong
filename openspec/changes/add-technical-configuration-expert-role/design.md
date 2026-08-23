## Context

Issue #950 centralized frontend route RBAC in an Edge-safe route policy shared
by middleware and navigation. The current policy marks
`/technical-configurations` as `global/admin` only, while `/dashboard` and many
other routes require authentication only. Adding `chuyen_gia` to the existing
Technical Configurations rule is therefore insufficient: the new role also
needs an explicit module-only restriction across every other mapped app route.

The app shell initializes feature surfaces beyond navigation, including tenant
selection, equipment search, operational notifications, AI Assistant,
onboarding/help, and mobile actions. These controls and their backing queries
must be suppressed for a role intended to use one workspace only.

Technical Configurations data access is RPC-backed. Live inspection on
2026-08-23 confirmed that its functions rely on
`public._technical_configuration_require_global_user()`. The live
`public.nhan_vien.role` column is unconstrained `text`, and current NextAuth
profile refresh runs at a 60-second cadence but does not fetch or update role.
Consequently, a navigation-only change would leave the module unusable, while
a role change on an active session could retain stale privileges until the next
login.

Two active OpenSpec changes also own Technical Configurations behavior:
`add-technical-configuration-comparison` and
`harden-technical-configuration-baseline-copy-and-excel`. Implementation must
inventory the final landed module functions rather than rely only on the
proposal-time list.

## Goals / Non-Goals

### Goals

- Add canonical role `chuyen_gia` without broadening global/admin semantics.
- Give the role full system-wide Technical Configurations capability.
- Deny every other app feature at route, shell, API, and RPC boundaries.
- Make login/root landing role-aware and keep denial behavior consistent with
  #950.
- Make active-session role transitions converge fail-closed within the existing
  60-second refresh cadence.
- Preserve existing behavior for all current roles.

### Non-Goals

- Adding tenant-scoped expert access or expert tenant switching.
- Creating a partial read/write matrix inside Technical Configurations.
- Granting access to Dashboard, Users, Tenants, reports, equipment, device
  quota, or any other non-Technical-Configurations module.
- Normalizing `chuyen_gia` to `global` in NextAuth, middleware, the RPC proxy,
  or Postgres.
- Applying migrations to live Supabase during proposal or implementation work.
- Refactoring unrelated RBAC or Technical Configurations domain behavior.

## Decisions

### 1. Model an exact module capability

Add a shared, Edge-safe capability predicate such as
`canAccessTechnicalConfigurations(role)` that returns true only for
`global/admin/chuyen_gia`. Keep `isGlobalRole()` unchanged and continue using it
for all genuine global/admin boundaries.

The centralized route evaluator will apply a constrained-role override:

- `chuyen_gia` may enter `/technical-configurations` and `/access-denied`.
- Any other mapped `(app)` route is denied before its broader
  authenticated-only policy can allow it.
- Unmatched paths continue to pass through for normal Next.js 404 behavior.
- The existing filesystem policy-coverage test remains the guard against a new
  real app page escaping the route map.

This keeps the exception in the single policy engine introduced by #950 rather
than scattering expert guards across pages.

### 2. Centralize the role-aware landing route

Add a shared `getDefaultAppRoute(role)` decision:

- `chuyen_gia` -> `/technical-configurations`
- every existing role -> `/dashboard`

The authenticated root page uses this helper. Credential login should route
through `/` after the NextAuth cookie is established, allowing the server-side
root decision to remain authoritative instead of duplicating role lookup in
the client form.

### 3. Treat the app shell as an authorization-sensitive surface

`AppLayoutShell` will derive an expert-only shell mode from the shared
capability/role helper. In that mode it will:

- render only Technical Configurations navigation;
- keep application identity, role/account display, change-password, and
  sign-out;
- hide tenant selection, equipment search, operational notification UI,
  assistant, onboarding/help, and mobile feature actions;
- pass disabled flags to backing hooks/providers so hidden features do not
  issue requests.

Conditional visibility does not replace route or server authorization.

### 4. Introduce a canonical Postgres module guard with compatibility

Create an append-only migration ordered after every local migration that
currently defines or depends on the Technical Configurations guard.

The migration will add a canonical helper such as
`public._technical_configuration_require_authorized_user()` that:

- validates non-empty JWT role and numeric `user_id` claims;
- accepts only `global`, legacy `admin`, or `chuyen_gia`;
- verifies the claimed user still exists;
- uses `SECURITY DEFINER` with `SET search_path = public, pg_temp`;
- returns the authorized user ID for existing audit behavior.

Because existing landed RPCs call
`_technical_configuration_require_global_user()`, redefine that function as a
compatibility wrapper around the canonical module helper. New or replaced
Technical Configurations functions use the canonical helper. Do not edit
applied migrations.

Before finalizing the implementation migration, inventory both local source and
live `pg_proc` definitions, including functions introduced by the two active
Technical Configurations changes. Add a focused SQL assertion that every
module-owned RPC uses the canonical helper or compatibility wrapper.

### 5. Add a new authoritative session-profile RPC

Postgres cannot change a function's `RETURNS TABLE` shape with
`CREATE OR REPLACE`. Rather than dropping the deployed
`get_session_profile_for_jwt`, add a new append-only,
JWT-guarded session-authorization profile RPC that returns the existing profile
fields plus the current canonical database role.

NextAuth profile refresh will call the new RPC, validate the returned role, and
apply it to the token/session through `applyJwtProfileRefresh`. The existing
60-second interval remains unchanged.

When a due refresh fails, returns no user, or returns an empty/unsupported
role, invalidate the authorization session and do not mint further Supabase RPC
JWTs from the stale role. This favors revocation correctness over temporary
availability during an authorization-profile outage.

### 6. Keep account role validation explicit without adding a table constraint

Do not add a new `nhan_vien.role` table CHECK in this change. The live column is
currently open `text`, and retrofitting a global constraint would widen the
migration and compatibility scope.

Instead:

- extend TypeScript role unions and labels with `chuyen_gia`;
- expose the role only in global/admin user-management flows;
- update guarded user create/update RPC validation to accept
  `chuyen_gia`;
- allow the role to use a null current/home tenant and no memberships;
- keep Users/Tenants routes and management RPCs global/admin-only.

### 7. Coordinate with active Technical Configurations changes

The expert capability changes authorization only. It must not rewrite
comparison, baseline-copy, Excel, locking, revision, audit, or concurrency
contracts owned by active changes.

At implementation time:

1. Rebase/sync from current `main`.
2. Re-inventory all Technical Configurations RPCs and tests.
3. Extend authorization fixtures to include `chuyen_gia`.
4. Preserve every existing domain assertion for `global/admin`.
5. Add expert-specific allow cases and non-module deny cases without copying
   entire active-change test matrices.

## Risks / Trade-offs

- **Stale privilege window up to 60 seconds**: retained to match the existing
  refresh cadence; focused tests must prove convergence on the first due
  refresh.
- **Fail-closed refresh can sign users out during profile RPC outages**:
  intentional security trade-off; emit existing auth lifecycle telemetry so
  operations can distinguish outage-driven invalidation.
- **Compatibility wrapper has a legacy name**: preserves all existing function
  callers without redefining dozens of RPCs in one migration; new work uses the
  canonical helper name.
- **Active changes may add new module RPCs**: mitigate with implementation-time
  inventory and a SQL coverage assertion.
- **Hidden shell hooks may still fetch accidentally**: tests must assert both
  absent controls and disabled hook/query inputs.

## Migration Plan

1. Add failing TypeScript/Vitest and SQL regression coverage before production
   changes.
2. Implement shared role, capability, default-route, route-policy, navigation,
   and app-shell behavior.
3. Add the new session authorization profile RPC in an append-only migration
   and update NextAuth refresh to consume it fail-closed.
4. Add the canonical Technical Configurations authorization helper,
   compatibility wrapper, and guarded user-role management changes in
   correctly ordered append-only migration files.
5. Run static migration checks and Oracle baseline-forward validation for the
   exact landed commit, plus focused SQL tests selected by the committed gate
   registry.
6. Run TypeScript/React quality gates and focused Vitest suites.
7. Do not apply any migration to live. A later live apply requires explicit
   permission for that exact write through Supabase MCP, followed by security
   advisor checks.

Rollback after a live deployment uses a new superseding migration and
application rollback; never edit an applied migration. Reassign or disable
`chuyen_gia` accounts before removing support for the role.

## Open Questions

No unresolved product or domain decisions remain. Implementation must refresh
the module RPC inventory against the then-current `main` and live read-only
state.
