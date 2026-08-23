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

During artifact review on 2026-08-23, the maintainer clarified that every
`chuyen_gia` account will have an assigned current/home `don_vi` and sufficient
metadata to resolve `dia_ban_id`. This supersedes only the tenantless-account
detail in #952; the assigned scope remains session/account metadata and does not
tenant-scope Technical Configurations data.

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
- Require assigned account scope metadata without using it to tenant-scope
  Technical Configurations data.
- Make login/root landing role-aware and keep denial behavior consistent with
  #950.
- Make active-session role transitions converge fail-closed within the existing
  60-second refresh cadence.
- Preserve existing behavior for all current roles.

### Non-Goals

- Using the assigned tenant or region to scope Technical Configurations data,
  or allowing expert tenant switching.
- Creating a partial read/write matrix inside Technical Configurations.
- Granting access to Dashboard, Users, Tenants, reports, equipment, device
  quota, or any other non-Technical-Configurations module.
- Normalizing `chuyen_gia` to `global` in NextAuth, middleware, the RPC proxy,
  or Postgres.
- Applying migrations to live Supabase during proposal or implementation work.
- Refactoring unrelated RBAC or Technical Configurations domain behavior.

## Decisions

### 1. Model an exact module capability

Add two shared, Edge-safe predicates with distinct semantics:

- `isTechnicalConfigurationExpertRole(role)` returns true only for
  `chuyen_gia`;
- `canAccessTechnicalConfigurations(role)` returns true only for
  `global/admin/chuyen_gia`.

Keep `isGlobalRole()` unchanged and continue using it for all genuine
global/admin boundaries. `chuyen_gia` must also remain excluded from
`isRegionalLeaderRole()`, `isEquipmentManagerRole()`,
`canAccessDeviceQuotaModule()`, `isDeptScopedRole()`, and
`isPrivilegedRole()`.

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

`AppLayoutShell` will derive an expert-only shell mode from
`isTechnicalConfigurationExpertRole()`, never from the broader module
capability. In that mode it will:

- render only Technical Configurations navigation;
- keep application identity, role/account display, change-password, and
  sign-out;
- hide tenant selection, equipment search, operational notification UI,
  assistant, onboarding/help, and mobile feature actions;
- pass disabled flags to backing hooks/providers so hidden features do not
  issue requests.

Application identity remains dynamic: keep `useTenantBranding()` enabled and
classify `don_vi_branding_get` as retained-shell infrastructure for experts.
The branding request remains scoped to the expert's assigned `don_vi`; it does
not grant tenant selection or any other tenant feature.

Conditional visibility does not replace route or server authorization.

### 4. Deny unrelated standalone APIs explicitly

Inventory every standalone feature API that authorizes from the NextAuth role.
Adding `chuyen_gia` to `ROLES` must not implicitly widen an allowlist such as
`Object.values(ROLES)`.

- `/api/chat` must use an explicit allowlist that excludes `chuyen_gia`.
- Tenant membership and tenant-switch endpoints must reject `chuyen_gia`;
  assigned account metadata does not grant tenant-selection capability.
- Asynchronous Device Quota suggestion job routes continue to use
  `canAccessDeviceQuotaModule()`, which excludes `chuyen_gia`.
- The synchronous suggestion provider keeps its separate explicit role
  allowlist in `assertSuggestionAccess()`; it must also exclude `chuyen_gia`.
- Authentication infrastructure endpoints remain governed by their existing
  contracts and are not feature APIs.

Add focused server tests for each role-aware standalone feature API, including
independent deny coverage for the asynchronous Device Quota job routes and the
synchronous provider boundary. Hiding its UI or disabling its client fetch is
not sufficient authorization.

### 5. Constrain the shared RPC proxy with an exact expert allowlist

`ALLOWED_FUNCTIONS` is a transport allowlist, not a module authorization
policy. Several unrelated tenant-scoped RPCs accept any non-global role with a
valid `don_vi`, so assigning the required expert tenant metadata would otherwise
make those RPCs reachable.

Add a separate fail-closed expert RPC classification in
`src/app/api/rpc/[fn]/allowed-functions.ts`. The expert allow set must be built
from one complete canonical Technical Configurations RPC-name aggregate plus
explicitly documented retained-shell/account/session infrastructure, including
`don_vi_branding_get` and `change_password`. Complete the dossier collection so
the five literal dossier list/get/create/update/archive names and the existing
delete name have one canonical owner, then compose that collection with the
existing baseline, comparison, reference, document, supplier/option,
assessment, ranking, and export collections. Both the generic transport
allowlist and the expert allowlist must consume this aggregate. The expert set
must not be derived by subtracting known denials from `ALLOWED_FUNCTIONS`.

After the server session is loaded and the exact expert role is known, but
before tenant-body rewriting, JWT minting, or upstream fetch, the RPC proxy
must return `403` for every function outside that expert allow set. The
server-side authorization-profile refresh remains authentication
infrastructure; it does not implicitly expose a client-callable feature RPC.

For an exact expert invoking a classified Technical Configurations RPC, bypass
`tenantScopedRpcBody()` and forward the caller's module parameters unchanged.
This is required because the generic proxy currently overwrites tenant-shaped
parameters for every non-global/non-regional role. The bypass applies only
after both the exact-role and module-RPC checks succeed; it must not affect
other roles, expert-denied RPCs, or unrelated self-service infrastructure.

Add a table-driven completeness test that classifies every current
`ALLOWED_FUNCTIONS` entry as Technical Configurations, required retained-shell/
account/session infrastructure, or denied to experts. Add positive expert cases
for `don_vi_branding_get` and `change_password`. Adding a new generic proxy
function must fail the test until its expert disposition is explicit. Keep
representative non-module SQL deny checks where useful. Add positive proxy
counter-tests for both `global` and a raw-session `admin` invoking
representative non-module RPCs so the exact-expert branch cannot narrow their
current access. Treat the proxy constraint and the module's Postgres guard as
independent defense-in-depth boundaries.

### 6. Introduce a canonical Postgres module guard with compatibility

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
authenticated module-owned RPC reaches the canonical helper or compatibility
wrapper either directly or through a verified module-helper call chain. The
same assertion must prove that no unrelated RPC reaches the module guard.

### 7. Add a new authoritative session-profile RPC

Postgres cannot change a function's `RETURNS TABLE` shape with
`CREATE OR REPLACE`. Rather than dropping the deployed
`get_session_profile_for_jwt`, add a new append-only,
JWT-guarded session-authorization profile RPC that returns the existing profile
fields plus the current canonical database role.

NextAuth profile refresh will call the new RPC, validate the returned role, and
apply it to the token/session through `applyJwtProfileRefresh`. The existing
60-second interval remains unchanged.

For a refreshed `chuyen_gia` profile, authorization-critical scope is
authoritative replacement data, not fallback data. Apply the refreshed
`don_vi`, resolved `dia_ban_id`/`dia_ban_ma`, and `khoa_phong` directly instead
of retaining old token values through `||` or `??` fallback. A null expert
department must clear a stale non-null department. If refreshed expert
`don_vi` or `dia_ban_id` cannot be resolved, invalidate the session rather than
reusing stale scope claims.

An expert is not required to have a department, so an authoritative refresh may
set `khoa_phong` to null. Update the RPC proxy claim parser so a genuinely
null/absent department is accepted only when
`isTechnicalConfigurationExpertRole(role)` is true, and sign the downstream
application JWT with a null department claim. The current parser already
accepts an empty string for existing roles and downstream JWT normalization
turns it into null; preserve that pre-existing behavior instead of silently
hardening unrelated roles in this change. The focused matrix therefore proves:
expert null and empty are accepted and signed as null; non-expert null remains
rejected; non-expert empty retains its current accepted-and-normalized behavior.
Required expert `don_vi`, resolvable `dia_ban_id`, role, and user ID claims
remain fail-closed.

When a due refresh fails, returns no user, or returns an empty/unsupported
role, invalidate the authorization session and do not mint further Supabase RPC
JWTs from the stale role. This favors revocation correctness over temporary
availability during an authorization-profile outage.

### 8. Keep account role validation explicit without adding a table constraint

Do not add a new `nhan_vien.role` table CHECK in this change. The live column is
currently open `text`, and retrofitting a global constraint would widen the
migration and compatibility scope.

Instead:

- extend TypeScript role unions and labels with `chuyen_gia`;
- expose the role only in global/admin user-management flows;
- update guarded user create/update RPC validation to accept
  `chuyen_gia`;
- require a current/home `don_vi` and its membership;
- require `dia_ban_id` to resolve authoritatively from the account or assigned
  `don_vi`;
- keep Technical Configurations authorization system-wide and independent of
  the assigned tenant/region;
- deny tenant switching for the role;
- make every membership or current-unit mutation preserve the expert invariant,
  including `user_membership_add`, `user_membership_remove`,
  `user_set_current_don_vi`, and related global/admin management paths;
- make generic membership/current-unit RPCs reject every expert-targeted add,
  removal, or current/home scope switch, even when the destination membership
  already exists or the resulting state would otherwise satisfy the invariant;
- add an append-only, global/admin-only
  `user_reassign_expert_scope(p_user_id bigint, p_don_vi bigint)` RPC for the
  successful replacement path. In one database transaction it validates the
  target expert and destination, establishes the destination membership,
  updates the authoritative current/home unit, verifies the resulting
  `dia_ban_id`, and only then retires obsolete assignment state. Register this
  management RPC in the generic proxy transport allowlist with an explicit
  expert-denied classification;
- wire expert reassignment UI to that named RPC only after the database
  operation exists; do not orchestrate multiple generic RPC calls from the
  client;
- preserve existing membership and current-unit behavior for non-expert
  accounts;
- keep Users/Tenants routes and management RPCs global/admin-only.

### 9. Coordinate with active Technical Configurations changes

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
- **Canonical role collections can widen unrelated APIs**: mitigate with an
  inventory of role-derived allowlists and focused standalone-API deny tests.
- **The shared RPC transport allowlist is broader than expert capability**:
  mitigate with an independent exact expert allowlist and a completeness test
  that fails on every unclassified `ALLOWED_FUNCTIONS` addition.
- **Broad module capability can be confused with exact expert identity**:
  mitigate with separate predicates and global/admin shell counter-tests.
- **Active changes may add new module RPCs**: mitigate with implementation-time
  inventory and a transitive SQL guard-coverage assertion.
- **Hidden shell hooks may still fetch accidentally**: tests must assert both
  absent controls and disabled hook/query inputs.

## Migration Plan

Implementation is split into the 17 review and deployment phases defined in
`tasks.md`. Each phase is intended to be one PR-sized batch and must pass its
own exit gate before the next phase starts.

1. Refresh inventories and freeze the implementation contract.
2. Lock shared role semantics with failing tests.
3. Harden existing role-derived and standalone boundaries before adding the
   role to production constants.
4. Add dormant shared role primitives and documentation.
5. Add dormant route, landing, and navigation isolation.
6. Add dormant expert shell isolation.
7. Canonicalize Technical Configurations RPC-name collections without changing
   behavior.
8. Enforce the dormant exact-expert RPC proxy boundary.
9. Add and validate the authoritative session-profile database RPC.
10. After Phase 9 is deployed, switch NextAuth refresh to the new fail-closed
    profile contract.
11. Add and validate the Technical Configurations Postgres module guard.
12. Add and validate expert account-scope protection plus the transactional
    reassignment RPC.
13. After all perimeter and database prerequisites are deployed, enable
    backend expert account assignment.
14. Activate the global/admin user-management UI for the role.
15. Consolidate documentation and remove stale or duplicated assumptions.
16. Run final integrated application and database verification.
17. Perform controlled database-first deployment and production read-back.

Phases 2-13 must not expose `chuyen_gia` in user-management UI. Phase 14 is the
operator-visible activation point. Database phases are additive and must land
before their application consumers; each migration-related landed commit needs
separate `static` and Oracle `baseline-forward` PASS evidence.

No phase applies a migration to live automatically. Every live Supabase MCP
write requires separate explicit maintainer permission for that exact operation,
followed by security advisors and read-back verification.

Rollback after a live deployment uses a new superseding migration and
application rollback; never edit an applied migration. Reassign or disable
`chuyen_gia` accounts before removing support for the role.

## Open Questions

No unresolved product or domain decisions remain. Implementation must refresh
the module RPC inventory against the then-current `main` and live read-only
state.
