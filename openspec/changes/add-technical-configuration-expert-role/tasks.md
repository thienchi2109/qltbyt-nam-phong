# Implementation Roadmap

## Phase Rules

- Execute phases in order. Do not combine Phases 2-15 into one PR.
- Each phase must keep all existing roles working and pass its focused exit gate
  before the next phase starts.
- Phases 2-13 prepare dormant or backward-compatible capability. Do not expose
  `chuyen_gia` in user-management UI before Phase 14.
- Every migration phase is append-only and must pass Database Quality Gate
  `static` plus Oracle `baseline-forward` for the exact landed commit.
- A passing phase does not authorize a live database write. Live apply requires
  separate explicit maintainer permission for that exact Supabase MCP operation.

## Phase 1 - Refresh Inventories And Freeze The Contract

**Depends on:** none

**Review boundary:** discovery, test matrix, and file ownership only; no
production behavior or migration.

**Deploy boundary:** documentation/test inventory only; safe to merge and deploy
independently.

- [x] 1.1 Sync current `main` and re-inventory every Technical Configurations
      RPC, including functions from `add-technical-configuration-comparison` and
      `harden-technical-configuration-baseline-copy-and-excel`.
- [x] 1.2 Inventory every exported RBAC helper, direct role comparison,
      role-derived collection such as `Object.values(ROLES)`, standalone
      role-aware API, and `ALLOWED_FUNCTIONS` entry.
- [x] 1.3 Classify every generic proxy RPC as Technical Configurations,
      retained-shell/account/session infrastructure, or expert-denied.
- [x] 1.4 Record the exact migration ordering constraints for the session
      profile RPC, module guard, and expert account-scope RPCs.
- [x] 1.5 Confirm the phase file map and focused test commands before production
      edits begin.

**Exit gate:** inventory has no unclassified helper, API, RPC, or migration
dependency.

## Phase 2 - Lock Shared Role Semantics With Failing Tests

**Depends on:** Phase 1

**Review boundary:** `src/lib/rbac.ts` contract tests and role/JWT normalization
tests only.

**Deploy boundary:** tests only; no runtime behavior changes.

- [x] 2.1 Add failing role type/label tests for canonical `chuyen_gia` and
      display label `Chuyên gia`.
- [x] 2.2 Add a table-driven matrix proving
      `isTechnicalConfigurationExpertRole()` accepts only `chuyen_gia` and
      `canAccessTechnicalConfigurations()` accepts only
      `global/admin/chuyen_gia`.
- [x] 2.3 Prove `chuyen_gia` remains false for `isGlobalRole()`,
      `isRegionalLeaderRole()`, `isEquipmentManagerRole()`,
      `canAccessDeviceQuotaModule()`, `isDeptScopedRole()`, and
      `isPrivilegedRole()`.
- [x] 2.4 Add JWT tests proving only raw `admin` normalizes to `global`, while
      `chuyen_gia` remains unchanged.

**Exit gate:** focused tests fail only because the new role primitives do not
exist yet.

## Phase 3 - Harden Existing Role-Derived And Standalone Boundaries

**Depends on:** Phase 2

**Review boundary:** unrelated feature APIs and existing allowlists only; do not
add the new role to canonical production role constants yet.

**Deploy boundary:** preserves behavior for all current roles and closes
allowlist widening before the new role exists.

- [x] 3.1 Replace `/api/chat` use of `Object.values(ROLES)` with an explicit
      current-role allowlist that will not grow automatically.
- [x] 3.2 Add direct-request expert-deny tests for Chat, tenant memberships, and
      tenant switching.
- [x] 3.3 Add independent expert-deny tests for asynchronous Device Quota
      suggestion job routes using `canAccessDeviceQuotaModule()`.
- [x] 3.4 Add independent expert-deny tests for synchronous
      `assertSuggestionAccess()` provider authorization.
- [x] 3.5 Add server-side expert-deny characterization for Users/Tenants
      management actions and preserve positive current-role cases.

**Exit gate:** all current roles retain behavior; adding a future `ROLES` value
cannot widen these standalone boundaries.

## Phase 4 - Add Dormant Shared Role Primitives

**Depends on:** Phase 3

**Review boundary:** canonical role types, labels, exact predicates, and
`docs/RBAC.md`; no route, shell, proxy, database, or user-management activation.

**Deploy boundary:** dormant capability only; no supported flow can create or
assign `chuyen_gia`.

- [x] 4.1 Add `chuyen_gia: "Chuyên gia"` to canonical role types and labels.
- [x] 4.2 Implement Edge-safe
      `isTechnicalConfigurationExpertRole(role)`.
- [x] 4.3 Implement Edge-safe `canAccessTechnicalConfigurations(role)` without
      changing any pre-existing helper.
- [x] 4.4 Make the Phase 2 helper/JWT matrix pass.
- [x] 4.5 Document the distinct exact-role, module-capability, and global/admin
      semantics in `docs/RBAC.md`.

**Exit gate:** shared helper tests pass and no user-management surface exposes
the role.

## Phase 5 - Add Dormant Route, Landing, And Navigation Isolation

**Depends on:** Phase 4

**Review boundary:** route policy, middleware, root/login landing, and
navigation only.

**Deploy boundary:** behavior is dormant until an expert account exists; all
current roles retain route behavior.

- [x] 5.1 Add failing and then passing route-policy cases allowing experts only
      `/technical-configurations` and `/access-denied`.
- [x] 5.2 Extend middleware coverage for Dashboard, mapped routes, descendants,
      unknown paths, `/_next/data/**`, and extension-looking dynamic paths.
- [x] 5.3 Add `getDefaultAppRoute(role)` and route successful credential login
      through the authoritative server root decision.
- [x] 5.4 Update navigation so an expert receives only Technical
      Configurations.
- [x] 5.5 Preserve explicit global/admin Technical Configurations and existing
      role counter-tests.

**Exit gate:** route, middleware, landing, and navigation focused suites pass.

## Phase 6 - Add Dormant Expert Shell Isolation

**Depends on:** Phase 5

**Review boundary:** `AppLayoutShell` and its backing hooks/providers only.

**Deploy boundary:** dormant for current users; no server authorization is
changed.

- [x] 6.1 Add exact-expert shell mode using
      `isTechnicalConfigurationExpertRole()`, not the broader module capability.
- [x] 6.2 Hide tenant selection, equipment search, operational notifications,
      AI Assistant, onboarding/help, and mobile feature actions.
- [x] 6.3 Disable each hidden feature's backing query/bootstrap so hidden UI
      cannot continue fetching.
- [x] 6.4 Keep `useTenantBranding()` enabled and scoped to assigned `don_vi`;
      retain app identity, account/role display, change password, and sign out.
- [x] 6.5 Add global/admin shell counter-tests and expert no-fetch assertions.

**Exit gate:** focused shell tests pass without changing current-role rendering
or requests.

## Phase 7 - Canonicalize Technical Configurations RPC Names

**Depends on:** Phase 1

**Review boundary:** RPC-name constants and classification tests only; no proxy
authorization behavior yet.

**Deploy boundary:** mechanical, backward-compatible refactor.

- [x] 7.1 Complete the dossier RPC collection with
      list/get/create/update/archive/delete names under one canonical owner.
- [x] 7.2 Compose one complete Technical Configurations RPC-name aggregate from
      dossier, baseline, comparison, reference, document, supplier/option,
      assessment, ranking, and export collections.
- [x] 7.3 Make the generic `ALLOWED_FUNCTIONS` transport allowlist consume the
      aggregate instead of parallel module literals.
- [x] 7.4 Add a completeness test that fails when an `ALLOWED_FUNCTIONS` entry
      lacks an expert disposition.
- [x] 7.5 Confirm no RPC name was added, removed, or behaviorally reclassified
      by this mechanical phase.

**Exit gate:** generic allowlist parity and exhaustive classification tests
pass.

## Phase 8 - Enforce The Exact Expert RPC Proxy Boundary

**Depends on:** Phases 4 and 7

**Review boundary:** `allowed-functions.ts`, RPC proxy authorization, and focused
proxy tests only.

**Deploy boundary:** dormant for current users; global/raw-admin and all
existing roles must retain access.

- [x] 8.1 Build the expert allow set from the canonical Technical
      Configurations aggregate plus explicit `don_vi_branding_get` and
      `change_password` infrastructure.
- [x] 8.2 Reject every expert-denied RPC with `403` before tenant-body rewrite,
      JWT minting, or upstream fetch.
- [x] 8.3 Bypass `tenantScopedRpcBody()` only for exact expert plus classified
      module RPC, preserving caller `p_don_vi`/`p_dia_ban` parameters.
- [x] 8.4 Add claim-matrix coverage: expert null/empty `khoa_phong` becomes a
      null JWT claim; non-expert null is rejected; non-expert empty keeps current
      normalization.
- [x] 8.5 Prove representative non-module RPCs remain available to both
      `global` and raw-session `admin`.
- [x] 8.6 Prove branding stays assigned-unit scoped and no self-service
      exception receives module capability.

**Exit gate:** exhaustive proxy classification, claim parsing, body rewrite,
and existing-role counter-tests pass.

## Phase 9 - Add The Authoritative Session Profile Database RPC

**Depends on:** Phase 1

**Review boundary:** one correctly ordered append-only migration and focused SQL
tests only; no NextAuth consumer change.

**Deploy boundary:** additive database-first phase. The existing application
continues using the old profile path.

- [x] 9.1 Add the JWT-guarded authorization profile RPC returning current
      database role plus existing profile fields.
- [x] 9.2 Preserve `SECURITY DEFINER`,
      `SET search_path = public, pg_temp`, explicit grants/revokes, and user-ID
      claim matching.
- [x] 9.3 Add SQL tests for valid profile reads, claim mismatch, missing user,
      and unsupported/malformed authorization state.
- [ ] 9.4 Run migration `static` and Oracle `baseline-forward` against the exact
      landed commit and retain digest-bearing evidence.

**Exit gate:** both database gate lanes pass. Do not deploy the Phase 10
application consumer until this migration has been explicitly authorized and
confirmed live.

## Phase 10 - Consume Authoritative Session Scope Fail-Closed

**Depends on:** Phase 9 migration confirmed in the target environment

**Review boundary:** auth types, session refresh, NextAuth callbacks, and focused
auth tests only.

**Deploy boundary:** application phase must follow the additive Phase 9 database
deployment; rollback is application-only because the new RPC can remain unused.

- [x] 10.1 Update profile types and `applyJwtProfileRefresh` to consume the new
      database role.
- [x] 10.2 For experts, authoritatively replace `don_vi`, resolved
      `dia_ban_id`/`dia_ban_ma`, and `khoa_phong`; clear stale department state
      when the authoritative value is null.
- [x] 10.3 Fail closed when refreshed expert `don_vi` or `dia_ban_id` is
      missing instead of reusing stale token scope.
- [x] 10.4 Invalidate/sign out on failed, empty, missing, or unsupported due
      refresh; do not mint RPC JWTs from stale authorization.
- [x] 10.5 Prove role changes converge on the first active refresh after the
      existing 60-second interval.
- [x] 10.6 Preserve current refresh behavior for every existing role.

**Exit gate:** focused auth helper/callback/session suites pass and the deployed
database prerequisite is documented.

## Phase 11 - Add The Technical Configurations Database Guard

**Depends on:** Phase 1

**Review boundary:** one append-only module-authorization migration, SQL
coverage, and gate registry entries only.

**Deploy boundary:** backward-compatible for global/admin and dormant for
experts; no account creation is enabled.

- [x] 11.1 Add
      `_technical_configuration_require_authorized_user()` for
      `global/admin/chuyen_gia`.
- [x] 11.2 Redefine `_technical_configuration_require_global_user()` as a
      compatibility wrapper without editing applied migrations.
- [x] 11.3 Update only new or replaced module functions to use the canonical
      helper.
- [x] 11.4 Add a transitive SQL assertion proving every authenticated module RPC
      reaches the guard and no unrelated RPC reaches it.
- [x] 11.5 Extend representative read, write, import/export, copy, lock,
      assessment, and comparison gates with expert allow cases.
- [x] 11.6 Run migration `static` and Oracle `baseline-forward` for the exact
      landed commit.

> Gate disposition on 2026-08-24: Oracle `baseline-forward` passed. The
> `static` lane was run and received an explicit maintainer bypass for the
> delegated-guard false positives tracked by #956; this is not an aggregate
> database quality-gate PASS.

**Exit gate:** global/admin domain assertions remain unchanged and both database
gate lanes pass.

## Phase 12 - Protect Expert Account Scope In The Database

**Depends on:** Phase 1

**Review boundary:** one append-only account-scope migration and focused SQL
tests; do not yet let create/update RPCs assign the new role.

**Deploy boundary:** backward-compatible protection and dormant reassignment
infrastructure.

- [x] 12.1 Make generic `user_membership_add`,
      `user_membership_remove`, `user_set_current_don_vi`, and related paths
      reject every expert-targeted scope change.
- [x] 12.2 Add global/admin-only
      `user_reassign_expert_scope(p_user_id bigint, p_don_vi bigint)`.
- [x] 12.3 In one transaction validate the target/destination, establish
      membership, update current/home unit, verify resolvable `dia_ban_id`, and
      retire obsolete assignment state.
- [x] 12.4 Register the reassignment RPC in the generic proxy allowlist with an
      explicit expert-denied classification.
- [x] 12.5 Add success, rollback, invalid-destination, generic-mutation,
      unauthorized-caller, and non-expert compatibility SQL tests.
- [x] 12.6 Run migration `static` and Oracle `baseline-forward` for the exact
      landed commit.

**Exit gate:** the invariant cannot be broken, the named transaction is the only
replacement path, and both database gate lanes pass.

## Phase 13 - Enable Backend Expert Account Assignment

**Depends on:** Phases 3-12 and Issue #953 deployed in the target environment

**Review boundary:** guarded user create/update role validation and server tests
only; no user-management UI exposure.

**Deploy boundary:** controlled backend activation. Do not deploy until route,
shell, standalone API, proxy, session, module guard, and account-scope
boundaries are all confirmed.

- [x] 13.1 Supersede the Issue #953 fail-closed allowlist in a new append-only
      migration, updating guarded global/admin user create/update validation to
      accept `chuyen_gia`.
- [x] 13.2 Require assigned current/home `don_vi`, matching membership, and
      resolvable `dia_ban_id`; keep `khoa_phong` optional.
- [x] 13.3 Reject unauthorized callers, tenant switching, and incomplete scope
      without partial account changes.
- [x] 13.4 Keep Users/Tenants routes and management RPCs denied to an
      authenticated expert.
- [x] 13.5 Add server/SQL tests proving global and raw `admin` ownership while
      all other roles fail closed.
- [x] 13.6 Run migration gates if this phase needs an append-only RPC
      replacement.

**Exit gate:** backend account assignment is safe, but operators still cannot
select the role in the application UI.

## Phase 14 - Activate Expert User Management UI

**Depends on:** Phase 13 deployed and verified

**Review boundary:** global/admin user-management forms, hooks, and focused UI
tests only.

**Deploy boundary:** operator-visible activation point. After this phase,
global/admin can create and manage expert accounts.

- [x] 14.1 Offer `Chuyên gia` only in global/admin user-management flows.
- [x] 14.2 Require unit assignment and surface validation errors before create
      or role change submits.
- [x] 14.3 Wire expert reassignment only to
      `user_reassign_expert_scope`; never sequence generic membership RPCs from
      the client.
- [x] 14.4 Do not expose tenant switching to the expert account.
- [x] 14.5 Add create, update, reassignment, validation, and global/raw-admin
      counter-tests.

**Exit gate:** focused user-management tests and an end-to-end expert login
smoke test pass.

Verification note (2026-08-27): focused and cross-layer automated tests pass.
Browser-level live login automation remains tracked in GitHub issue #974 because
the repository does not yet provide a credentialed E2E harness; this phase does
not claim that live smoke was executed.

## Phase 15 - Consolidate Documentation And Remove Stale Assumptions

**Depends on:** Phase 14

**Review boundary:** deduplication, comments, RBAC documentation, and inventory
rechecks only; no new capability.

**Deploy boundary:** behavior-preserving cleanup.

- [ ] 15.1 Reuse the exact-expert predicate for constrained route/shell behavior
      and the module capability only for Technical Configurations authorization.
- [ ] 15.2 Remove duplicate role strings, parallel dossier/module RPC literals,
      and stale tenantless-expert assumptions.
- [ ] 15.3 Re-run helper, standalone API, `ALLOWED_FUNCTIONS`, and live/local
      module RPC inventories.
- [ ] 15.4 Update `docs/RBAC.md` with route, shell, API, RPC, session, account,
      and deployment contracts.
- [ ] 15.5 Confirm concurrent Technical Configurations changes did not add an
      unclassified operation.

**Exit gate:** dedupe and inventory checks pass with no behavior delta.

## Phase 16 - Final Integrated Verification

**Depends on:** Phases 1-15

**Review boundary:** verification and regression evidence only.

**Deploy boundary:** release-candidate gate; no live write.

- [ ] 16.1 Run `node scripts/npm-run.js run format:check`.
- [ ] 16.2 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 16.3 Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] 16.4 Run `node scripts/npm-run.js run typecheck`.
- [ ] 16.5 Run focused Vitest suites for helpers, routes, middleware, landing,
      navigation, shell, standalone APIs, proxy classification/claims/body
      rewriting, auth refresh, and user management.
- [ ] 16.6 Run selected Technical Configurations, session-profile, and
      user-role SQL gates.
- [ ] 16.7 Confirm every migration-related landed commit has separate `static`
      and Oracle `baseline-forward` PASS evidence.
- [ ] 16.8 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 16.9 Run
      `openspec validate add-technical-configuration-expert-role --strict`.
- [ ] 16.10 Verify the final diff contains no unrelated RBAC, domain, or applied
      migration-history edits.

**Exit gate:** all required evidence passes for the exact release candidate.

## Phase 17 - Controlled Deployment And Post-Deploy Verification

**Depends on:** Phase 16

**Review boundary:** deployment checklist and read-back evidence only.

**Deploy boundary:** migrations first, application activation last, with an
explicit stop point after every step.

- [ ] 17.1 Obtain explicit maintainer permission before each exact live
      Supabase MCP migration apply.
- [ ] 17.2 Apply and verify additive database foundations before deploying their
      application consumers; never use Supabase CLI for live operations.
- [ ] 17.3 Run security advisors and read-back verification after every
      authorized migration apply.
- [ ] 17.4 Deploy dormant application/perimeter phases before backend/UI account
      activation.
- [ ] 17.5 Create one controlled expert account with assigned `don_vi` and
      resolvable `dia_ban_id`; verify login, shell, module read/write, branding,
      password change, and denial of unrelated routes/APIs/RPCs.
- [ ] 17.6 Verify role reassignment and the 60-second authoritative refresh
      convergence.
- [ ] 17.7 Record rollback criteria. Roll back application code normally and
      supersede database behavior with a new append-only migration; never edit an
      applied migration.

**Exit gate:** production read-back confirms the complete contract with no
unexpected access expansion.
