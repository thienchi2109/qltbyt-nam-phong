# Tasks: Add Device Quota Category Unassignment

## Delivery Rules

- Execute phases in order. Do not deploy or enable the frontend action before the
  hardened RPC contract is applied and verified in the target environment.
- Use RED tests before production changes in every implementation phase.
- Keep each phase reviewable as a focused PR or explicit review checkpoint.
- Do not apply a live migration without fresh, explicit maintainer approval.
- Do not run a live mutation smoke test without separate explicit approval that names
  the designated test records and cleanup plan.
- Use Supabase MCP for all live database inspection and writes; never use Supabase
  CLI for database operations.
- Run `code-deduplication` discovery before adding shared mutation/cache helpers.
- Keep source files below the repository's 450-line hard ceiling.

## Phase 0 - Characterization and RED Baseline

**Purpose:** Lock current behavior and expose the missing unlink workflow without
changing production behavior.

- [x] 0.1 Reconfirm the latest local and live definitions, grants, audit constraints,
      and callers of `dinh_muc_thiet_bi_unlink`.
- [x] 0.2 Reconfirm the latest local migration touching the unlink RPC before choosing
      a new migration timestamp.
- [x] 0.3 Add failing assigned-equipment component tests for a trailing `X` action,
      exact `Bỏ khỏi danh mục` accessible name and tooltip, and row-event isolation.
- [x] 0.4 Add failing interaction tests for confirmation cancel and confirm paths.
- [x] 0.5 Add failing role-matrix tests proving only `global`, `admin`, and
      `to_qltb` receive the action.
- [x] 0.6 Add failing parent-category coverage proving only direct assignments expose
      the action.
- [x] 0.7 Add failing mutation-hook tests for one RPC call, expected-category
      arguments, targeted in-flight query cancellation, cache patching, delayed stale
      responses, zero affected without count decrement, error, and no immediate read
      refetch.
- [x] 0.8 Add failing SQL/source-contract tests for the expected-category predicate,
      direct-RPC role rejection, missing claims, distinct category/equipment tenant
      failures, `user_id`, search path, audit, grants, and unsafe-overload removal.
- [x] 0.9 Run the focused RED suites and record the expected failures before
      implementation.

**Review boundary:** Tests and characterization only. No runtime behavior, migration,
or live database change.

## Phase 1 - Harden the Backend Unlink Contract

**Purpose:** Make the server mutation safe against stale-category races while
preserving tenant isolation and auditability.

- [x] 1.1 Create a correctly ordered Supabase migration after the latest local
      definition of `dinh_muc_thiet_bi_unlink`.
- [x] 1.2 Add the three-argument expected-category overload using existing
      `SECURITY DEFINER`, JWT, role normalization, and fail-closed patterns.
- [x] 1.3 Restrict the update predicate to equipment ID, facility, and the expected
      current category.
- [x] 1.4 Preserve affected-count return semantics and write a complete `unlink`
      audit record for confirmed IDs.
- [x] 1.5 Set `search_path = public, pg_temp`, revoke `public`/`anon`, and grant only
      required execution to `authenticated`.
- [x] 1.6 Revoke and remove the old two-argument overload so callers cannot bypass
      the concurrency guard.
- [x] 1.7 Update RPC allowlist/source-contract tests without broadening the allowed
      function surface.
- [x] 1.8 Run focused migration and RPC tests until the Phase 0 SQL RED cases pass.

**Deploy-safe boundary:** Repository contains the hardened database contract, but no
frontend action calls it yet. Live apply remains a separately approved operation.

## Phase 2 - Build the Per-Row Action and Confirmation Shell

**Purpose:** Add reusable, testable UI pieces without enabling incomplete mutation
behavior.

- [x] 2.1 Run React and code-deduplication guidance before creating new UI or hooks.
- [x] 2.2 Add the trailing Lucide `X` icon button with the exact tooltip and
      accessible label `Bỏ khỏi danh mục` to authorized assigned-equipment rows.
- [x] 2.3 Stop pointer and keyboard action events from selecting or activating the
      containing row.
- [x] 2.4 Add a focused confirmation dialog showing equipment and selected-category
      identity.
- [x] 2.5 Implement cancel, close, focus-return, disabled, and pending states without
      a stuck overlay or pointer lock.
- [x] 2.6 Keep unauthorized and read-only role output byte-for-byte free of the
      unlink command.
- [x] 2.7 Keep parent detail scoped to equipment assigned directly to that parent.
- [x] 2.8 Pass focused component and role tests before wiring the production
      mutation.

**Review boundary:** UI composition and interaction contract are reviewable
independently. The action remains unexposed or non-mutating until Phase 3 wiring is
complete.

## Phase 3 - Implement Cache-First Unassignment Reconciliation

**Purpose:** Complete the user workflow with one required mutation request and no
unnecessary immediate read request.

- [x] 3.1 Add a typed unlink mutation helper that sends one equipment ID, expected
      category ID, and captured facility ID.
- [x] 3.2 Add a focused `useMutation` hook with per-row pending state and translated
      error feedback.
- [x] 3.3 Before reconciling a resolved mutation, cancel matching in-flight assigned,
      category-list, unassigned, filter-option, and compliance queries for the
      captured scope without starting new requests.
- [x] 3.4 On affected count one, remove the row from the exact assigned-equipment
      cache with an immutable `setQueryData` update.
- [x] 3.5 Use targeted `setQueriesData` to decrement only the selected category's
      direct cached count, clamped at zero.
- [x] 3.6 Reuse existing aggregate-count helpers so ancestor totals recalculate from
      the patched full tree; do not decrement ancestors directly.
- [x] 3.7 Mark assigned, category-list, unassigned, filter-option, and compliance
      queries stale with `refetchType: "none"`.
- [x] 3.8 Prove no assigned-detail, category-list, unassigned, or compliance read RPC
      is sent on the immediate success path.
- [x] 3.9 On affected count zero, remove only the provably stale assigned row, leave
      the unconfirmed category count unchanged, mark assigned/category-list queries
      stale with no immediate refetch, and show stale-state feedback.
- [x] 3.10 Leave caches unchanged on thrown mutation errors.
- [x] 3.11 Wire confirmation to the mutation, but keep the action unavailable to
      deployed users until the Phase 6 backend prerequisite is verified.
- [x] 3.12 Pass the complete Phase 0 component and hook RED suites.

**Review boundary:** Repository behavior is feature-complete but MUST remain
undeployed or disabled until Phase 6 verifies the hardened live RPC.

## Phase 4 - Integration, Performance, and Regression Hardening

**Purpose:** Prove the workflow remains correct across roles, hierarchy levels,
query lifecycles, and existing assignment behavior.

- [x] 4.1 Add page-level user-event coverage for leaf-category unlink confirmation,
      success feedback, row removal, and count update.
- [x] 4.2 Add parent-category coverage proving direct count and aggregate ancestor
      count update exactly once.
- [x] 4.3 Add stale-row concurrency coverage proving a concurrently moved assignment
      remains intact.
- [x] 4.4 Add under-minimum coverage proving unlink is allowed and cached category
      state reflects the reduced count.
- [x] 4.5 Add request-count assertions proving one mutation and zero immediate read
      refetches on success.
- [x] 4.6 Add delayed-response race coverage proving a read started before mutation
      cannot overwrite the confirmed cache patch.
- [x] 4.7 Prove stale inactive queries refetch when their consuming surface later
      mounts or normal freshness policy requires it.
- [x] 4.8 Re-run existing manual assignment, category tree aggregation,
      assigned-equipment, role-matrix, and RPC whitelist suites.
- [x] 4.9 Inspect query logs or focused mocks for duplicate/repetitive calls and
      document the result.

**Review boundary:** No new feature scope. This phase owns integration evidence and
performance regressions only.

## Phase 5 - Repository Verification and Independent Review

**Purpose:** Finish all repository gates and resolve independent review findings
before any live write or frontend deployment.

- [x] 5.1 Run `node scripts/npm-run.js run format:check`.
- [x] 5.2 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [x] 5.3 Run `node scripts/npm-run.js run verify:dedupe`.
- [x] 5.4 Run `node scripts/npm-run.js run typecheck`.
- [x] 5.5 Run all focused Vitest suites owned by Phases 0-4.
- [x] 5.6 Run `node scripts/npm-run.js run react-doctor`.
- [x] 5.7 Run `openspec validate add-device-quota-category-unassignment --strict`.
- [x] 5.8 Run the custom `post_implementation_reviewer` against the fixed base ref
      and Wayfinder decision #929; resolve valid findings and repeat until zero
      findings remain.
- [x] 5.9 Verify the final diff contains only issue-owned implementation, tests,
      migration, and approved documentation.
- [x] 5.10 Record rollback readiness and the backend-before-frontend deployment order.

**Review boundary:** The implementation is approved for rollout but remains
undeployed. No live database write or production mutation occurs in this phase.

## Phase 6 - Approved Live Migration, Frontend Landing, and Closeout

**Purpose:** Establish the live backend prerequisite, then land or enable the
frontend action under explicit operational control.

- [ ] 6.1 Ask the maintainer for explicit permission to write the specific migration
      to live Supabase.
- [ ] 6.2 If approved, apply the migration through Supabase MCP.
- [ ] 6.3 Verify the deployed signature, role/tenant/category guards, grants, and
      absence of the unsafe overload with read-only MCP queries.
- [ ] 6.4 Run Supabase security advisors immediately after migration.
- [ ] 6.5 Land, deploy, or enable the frontend action only after steps 6.2-6.4 pass.
- [ ] 6.6 Run read-only authenticated production smoke checks for page access, action
      visibility, and role/facility scope.
- [ ] 6.7 If a production unlink smoke mutation is still needed, obtain separate
      explicit approval naming designated test equipment/category records and the
      cleanup plan before making that write.
- [ ] 6.8 Monitor RPC errors, stale-state feedback, and duplicate requests during the
      initial rollout.
- [ ] 6.9 Update linked issue/PR status, push the landed branch, verify it is up to
      date with origin, and complete the implementation handoff.

**Final boundary:** Do not mark implementation complete until repository gates,
zero-finding independent review, backend-before-frontend rollout, issue status,
commit, and push are all verified. Stop before any unapproved live write.
