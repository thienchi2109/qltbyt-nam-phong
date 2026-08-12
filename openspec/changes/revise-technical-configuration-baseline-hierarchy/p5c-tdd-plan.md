# P5C TDD Plan - Evaluation Hierarchy And Progress

> **For agentic workers:** REQUIRED: use subagent-driven implementation with one
> worker per deploy-safe leaf and independent review after each leaf.

**Goal:** Implement Issue #904 P5C with a hierarchy-aware evaluation read contract,
page-local navigator headings, and full-universe authoritative aggregate progress.

**Architecture:** Land P5C0 first as a backward-compatible RPC replacement. Then use
one evaluation-specific canonical leaf flattener as the shared source for projection,
fallback selection, presentation rows, progress, and aggregate inputs. Keep comparison,
result export, and criterion assessment persistence unchanged.

**Tech stack:** PostgreSQL/Supabase migrations, TypeScript, React, TanStack Query,
Vitest/Testing Library, OpenSpec.

---

## Scope

Implement P5C.0-P5C.7 only:

- replace `technical_configuration_evaluation_criteria_list` with canonical three-level
  leaf ordering while preserving its public contract;
- render section/subgroup aggregate progress from the complete baseline and
  authoritative complete assessment cache;
- render only current filtered page ancestors in the evaluation navigator;
- keep structural collapse local, non-selectable, and assessment-free;
- preserve selection, filters, pagination, save, `Lưu & tiếp tục`, dirty guards,
  denominator, ranking, and score.

Do not change:

- `src/app/(app)/technical-configurations/_components/comparison/**`;
- comparison RPCs, comparison page size, option/evidence/detail behavior;
- result-export components, hooks, RPCs, migrations, workbook shape, or snapshots;
- assessment upsert signature/persistence;
- `src/app/api/rpc/__tests__/technical-configuration-baseline-hierarchy-apply-migration.test.ts`;
- `src/app/api/rpc/__tests__/technical-configuration-baseline-subgroup-mutations-migration.test.ts`.

The last two files are the stale phase-gate tests tracked by Issue #903. They are
distinct from the new P5C hierarchy-order phase gates.

Live Supabase apply is not part of this plan without separate explicit user
authorization.

## Assumptions And Contracts

- Start from `main@c6d3d6b9eecabc2a7dd229ad4ff13535d8785908` on
  `feat/issue-904-p5c-evaluation-hierarchy`.
- GitNexus is indexed at `c6d3d6b9`; do not reindex unless changed symbols cannot be
  mapped.
- `TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE` remains `50`.
- RPC transport `p_page_size` remains bounded to `1..100`.
- P5C0 canonical tuple is:
  `group.sort_order`, `group.id`, direct-before-subgroup discriminator,
  `subgroup.sort_order`, `subgroup.id`, `criterion.sort_order`, `criterion.id`.
- Direct criteria use the direct discriminator and deterministic neutral subgroup keys;
  subgroup criteria use the subgroup discriminator and real subgroup keys.
- `canonical_index` is calculated over the complete leaf universe before status
  filtering. `canonical_page` derives from `canonical_index` with page size `50`.
- Filtered transport rows and `jsonb_agg` are ordered only by `canonical_index`.
- One evaluation-specific flattener owns canonical leaf traversal. Independent
  group-only loops are forbidden because they drop subgroup leaves.
- Navigator headings wrap only leaves on the current filtered presentation page.
  Empty structures appear only in the full summary.
- The navigator/presentation layer constructs the page-local
  `TechnicalConfigurationEvaluationHierarchyRow[]` exactly once. The navigator pane
  forwards `readonly TechnicalConfigurationEvaluationHierarchyRow[]`; the criterion
  list renders and filters those supplied rows directly and MUST NOT rebuild hierarchy
  from a leaf projection.
- Structural rows start expanded. Selecting a hidden leaf auto-expands its ancestors
  before focus/selection commits. Controlled expanded-ID input and an expansion-change
  callback remain available at the presentation boundary for that integration.
- Aggregate inputs are full-baseline descendants plus authoritative complete
  assessments. Filter/page/collapse and unsaved drafts are presentation state only.
- Complete-cache states are distinct:
  - known complete, including a successfully loaded empty map: merge saved assessment;
  - known empty because the current save created the comparison set: seed saved
    assessment;
  - unavailable/loading/failed existing cache: do not create a partial authoritative
    map.
- P5C0 may deploy before subgroup data/UI. P5C UI must not activate in an environment
  where P5C0 has not been applied.

## Deploy-Safe Leaves

### Leaf A - P5C0 evaluation read contract

Safe to merge and deploy alone. Old clients receive the same signature and JSON shape,
but direct/subgroup leaves gain deterministic canonical positions.

### Leaf B - Canonical evaluation model and aggregate progress

Depends on Leaf A being represented in the repository. Pure model/progress changes
remain compatible with legacy two-level snapshots.

### Leaf C - Navigator rows, collapse, cache adoption, and integration

Depends on Leaves A-B. Production activation requires P5C0 to be applied in the target
environment. No next PR is required to restore existing evaluation behavior.

## File Map

Create:

- `supabase/migrations/20260812140500_technical_configuration_evaluation_hierarchy_order.sql`
  - copies the latest RPC definition and changes only canonical hierarchy ordering.
- `src/app/api/rpc/__tests__/technical-configuration-evaluation-hierarchy-order-migration.test.ts`
  - inspects the superseding migration directly for signature, auth, grants, filters,
    ordering, pagination, response-shape, and rollback comments.
- `supabase/tests/technical_configuration_evaluation_hierarchy_order_phase_gate.sql`
  - executable post-apply contract for direct/subgroup ordering and boundaries
    `50/51`, `100/101`; do not modify Issue #903 phase-gate files.
- `supabase/tests/technical_configuration_evaluation_hierarchy_order_security_phase_gate.sql`
  - executable post-apply contract for unchanged auth, grants, tenant scope, and
    transport bounds.
- `src/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-hierarchy.ts`
  - owns canonical leaf flattening, ancestry, legacy normalization, and page-local
    presentation row construction.
- `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationEvaluationHierarchyPresentation.ts`
  - owns local default-expanded state and controlled expansion synchronization without
    changing leaf projection, selection, or aggregate inputs.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-hierarchy.test.ts`
  - owns tuple ties, direct/subgroup order, legacy fallback, subgroup retention,
    current-page headings, empty structures, and collapse invariants.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-hierarchy-ui.test.tsx`
  - owns structural rendering, controls, default expansion, local collapse, and
    ancestor auto-expand accessibility behavior.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-cache-adoption.test.tsx`
  - owns known-complete, known-empty-new-set, unavailable/failed-existing-cache, and
    filtered-refetch-failure behavior.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-cache-adoption-test-support.ts`
  - keeps cache-state fixtures out of the dedicated cache-adoption test.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-hierarchy-navigator.test.tsx`
  - owns guarded navigation, dirty-cancel, save-next, controlled ancestor expansion,
    legacy behavior, and the 101+ mixed hierarchy fixture crossing `50/51` and
    `100/101`.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-active-workspace-hierarchy.test.tsx`
  - owns the integration boundary that passes prebuilt page-local rows and controlled
    expansion from the active workspace into the navigator pane.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-progress.test-support.ts`
  - keeps mixed-status, empty-structure, and full-universe progress fixtures out of the
    progress test.

Modify:

- `src/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-navigation.ts`
  - consumes the shared flattener for server projection and local criterion fallback.
- `src/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-progress.ts`
  - consumes the shared flattener and P5A aggregate model for section/subgroup progress.
- `src/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-matrix-presentation.ts`
  - exposes full-universe progress/aggregate plus filtered presentation inputs without
    deriving aggregates from the filter.
- `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationEvaluationNavigator.ts`
  - exposes current filtered page leaves/rows and expands hidden ancestors on committed
    navigation without changing leaf selection semantics.
- `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationCriterionList.tsx`
  - accepts `readonly TechnicalConfigurationEvaluationHierarchyRow[]` directly and
    renders/filters the supplied union; it never rebuilds hierarchy, and only leaf rows
    own the existing selection button.
- `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationNavigatorPane.tsx`
  - forwards prebuilt page-local rows plus controlled/local expansion state to the
    criterion list without projecting the rows again.
- `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationActiveWorkspace.tsx`
  - mounts the page-local hierarchy navigator, wires complete authoritative progress,
    and keeps result-export props byte-for-byte unchanged.
- `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationProgressSummary.tsx`
  - renders section/subgroup aggregate labels/counts, including empty structures.
- `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationAssessments.ts`
  - adopts saved rows only under the three explicit complete-cache states and preserves
    actionable filtered-read failure.
- `openspec/changes/revise-technical-configuration-baseline-hierarchy/tasks.md`
  - checks P5C.0-P5C.7 only after evidence and zero-finding review.

Do not enlarge
`src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-workspace.test.tsx`
(the existing large workspace suite, currently 21 Vitest cases). Reuse its exported
test support where practical; otherwise keep new fixtures/support in the dedicated P5C
files above.

## TDD Sequence

### RED A1 - Superseding migration contract

1. Create the dedicated migration source test before the migration.
2. Assert the test reads exactly
   `20260812140500_technical_configuration_evaluation_hierarchy_order.sql`, not a
   concatenation of all migrations.
3. Assert unchanged function signature, return JSON keys, accepted filters,
   `SECURITY DEFINER`, `SET search_path = public, pg_temp`, JWT/tenant guards,
   revoke/grant contract, assessment joins, and `p_page_size <= 100`.
4. Assert canonical tuple includes group order/ID, direct discriminator, subgroup
   order/ID, criterion order/ID.
5. Assert the window computes `canonical_index` before status filtering.
6. Assert `canonical_page` divides by constant comparison page size `50`.
7. Assert filtered pagination and JSON aggregation order by `canonical_index`.
8. Run the focused test and confirm RED because the superseding migration is absent.

### GREEN A1 - Minimal read-contract replacement

1. Copy the latest complete RPC definition into timestamp
   `20260812140500`.
2. Add the subgroup join needed for canonical ordering without changing selected JSON
   fields or filter derivation.
3. Build the exact canonical tuple with deterministic ID ties.
4. Compute the window across all leaves, then filter, transport-page, and aggregate by
   `canonical_index`.
5. Preserve function signature, auth, grants, response shape, comparison page size
   `50`, and transport bound `100`.
6. Run the migration source test to GREEN.
7. Inspect read-only `EXPLAIN` for representative direct/subgroup and filtered queries.
   Add an index only if the plan demonstrates a concrete regression; otherwise add no
   index.

### RED A2 - Executable boundary contract

1. Add two rollback-only P5C phase gates: one for deterministic
   section/subgroup/criterion ordering and one for unchanged security/transport
   boundaries.
2. Insert at least 101 leaves spanning direct criteria and multiple subgroup blocks.
3. Assert order and canonical transitions at `50/51` and `100/101`.
4. Assert filtering retains full-universe `canonical_index`/`canonical_page`.
5. Assert the security gate preserves auth, grants, tenant scope, and rejects transport
   requests above `100`.
6. Keep both new P5C files independent from the two stale Issue #903 tests.

### RED B1 - One canonical evaluation flattener

1. Write pure tests for direct criteria before complete subgroup blocks.
2. Cover ties at every tuple level using deterministic IDs.
3. Cover multiple subgroups, subgroup criteria, empty structures, and legacy snapshots
   with no subgroup array.
4. Assert projection, local fallback, page rows, and progress all consume the same
   flattened leaf IDs in the same order.
5. Confirm RED because current independent loops only traverse `group.criteria`.

### GREEN B1 - Minimal shared hierarchy model

1. Implement `flattenTechnicalConfigurationEvaluationLeaves` as an immutable,
   deterministic, linear traversal plus stable sort.
2. Include section and optional subgroup ancestry on each canonical leaf.
3. Build page-local presentation rows from a supplied leaf page; emit a section or
   subgroup heading only when that page has a descendant leaf.
4. Normalize legacy rows as direct criteria.
5. Replace group-only traversal in navigation fallback and progress with the flattener.
6. Run pure hierarchy/navigation/progress tests to GREEN.

### RED B2 - Full-universe aggregate and empty structures

1. Add mixed-status tests for direct and subgroup descendants.
2. Assert section/subgroup counts derive from all canonical leaves and complete
   assessments, independent of active filter/page.
3. Assert unsaved drafts never affect aggregate.
4. Assert empty section/subgroup structures render `Chưa có tiêu chí` with zero counts
   in the full summary.
5. Assert structural rows never change denominator, ranking input, or score.

### GREEN B2 - Aggregate progress presentation

1. Reuse `buildTechnicalConfigurationHierarchyAggregateStatus` from P5A.
2. Feed it canonical leaves and complete assessments only.
3. Extend progress types with section/subgroup aggregate results without duplicating
   status precedence.
4. Render aggregate labels and exact descendant counts in the full summary.
5. Do not pass filter/page/collapse/draft state into aggregate construction.
6. Run aggregate/progress/summary tests to GREEN.

### RED C1 - Page-local navigator rows and collapse

1. Add an integration-shaped UI test that passes a prebuilt readonly
   section/subgroup/criterion row union through the navigator pane into the criterion
   list.
2. Confirm RED at the presentation boundary because the criterion list still expects a
   leaf projection or rebuilds hierarchy instead of consuming the supplied row union.
3. Add UI tests for current-page section/subgroup ancestor headings only.
4. Assert no orphan heading for empty or filtered-out structures.
5. Assert structural rows have no assessment control and cannot call
   `onSelectCriterion`.
6. Assert rows start expanded and collapse hides descendants only.
7. Assert selection, filter totals, pagination, selected criterion, save/save-next,
   dirty guards, denominator, ranking, and score are unchanged after collapse.
8. Assert page/filter/direct/save-next navigation auto-expands ancestors of a hidden
   target before focus commits.

### GREEN C1 - Minimal navigator presentation state

1. Expose the current filtered leaf page from the navigator hook and build its row union
   once with the shared evaluation hierarchy model.
2. Pass the prebuilt readonly row union through the active workspace and navigator pane.
3. Make the criterion list consume the row union directly; remove any call that rebuilds
   hierarchy from criteria/leaves.
4. Keep expanded IDs in local navigator presentation state and expose controlled
   expanded-ID input plus an expansion-change callback for ancestor auto-expand.
5. Render structural rows as buttons only for expand/collapse; criterion selection
   remains on leaf buttons.
6. Mount the page-local navigator in the active evaluation workspace without changing
   the unified comparison matrix contract.
7. Expand target ancestors inside committed navigation, after dirty guard approval and
   before leaf focus.
8. Preserve canonical selection and save-next logic on leaf IDs/indexes only.
9. Run hierarchy UI, hierarchy navigator, and active-workspace hierarchy tests to GREEN.

### RED C2 - Authoritative complete-cache adoption

1. Add a known-complete cache test, including a successfully loaded empty map.
2. Add a known-empty newly created comparison-set test.
3. Add loading, unavailable, and failed existing-cache tests.
4. Assert one saved row never promotes an unknown/failed existing cache to
   authoritative.
5. Assert successful save adopts/seed authoritative cache before aggregate refresh.
6. Force filtered criteria refetch failure after successful persistence; assert
   actionable retry state and unchanged authoritative aggregate.
7. Assert complete-cache refetch failure never replaces full data with the saved row
   alone.

### GREEN C2 - Minimal cache-state handling

1. Make cache completeness explicit from query/comparison-set lifecycle state.
2. Merge into known-complete data.
3. Seed only when the current mutation created the previously absent comparison set.
4. Leave existing unavailable/failed cache non-authoritative and trigger complete
   refetch/error presentation.
5. Keep filtered criteria invalidation separate from aggregate cache adoption.
6. Run the dedicated cache-adoption tests to GREEN.

### RED/GREEN C3 - Navigator and workspace regressions

1. Use the dedicated hierarchy-navigator 101+ mixed hierarchy fixture and assert exact
   leaves at `50/51` and `100/101`.
2. Cover direct/subgroup filtered navigation, dirty-cancel restoration, save-next, end
   state, collapse auto-expand, and filtered refetch failure.
3. Keep an explicit legacy two-level navigator/workspace fixture.
4. Confirm RED for each missing hierarchy behavior, implement only the minimum wiring,
   and run
   `technical-configuration-evaluation-hierarchy-navigator.test.tsx` plus
   `technical-configuration-evaluation-active-workspace-hierarchy.test.tsx` to GREEN.
5. Run all 21 cases in the existing large
   `technical-configuration-evaluation-workspace.test.tsx` unchanged as regression
   coverage.

### REFACTOR

1. Verify all evaluation baseline traversal routes through the shared flattener.
2. Remove duplicate sorting/grouping introduced by the change.
3. Keep new source files below 350 lines and every source file below 450 lines.
4. Do not move or refactor comparison/result-export code.
5. Run focused P5C tests again after cleanup.

## Verification

Run the TypeScript/React gates in repository order through one context-mode batch:

1. `node scripts/npm-run.js run format:check`
2. `node scripts/npm-run.js run verify:no-explicit-any`
3. `node scripts/npm-run.js run verify:dedupe`
4. `node scripts/npm-run.js run typecheck`
5. focused migration, hierarchy, progress, UI, cache, and workspace tests
6. existing evaluation navigation/progress/workspace regressions
7. `node scripts/npm-run.js run react-doctor`
8. `npx openspec validate revise-technical-configuration-baseline-hierarchy --strict`
9. broad technical-configuration suite

Focused files include:

- `src/app/api/rpc/__tests__/technical-configuration-evaluation-hierarchy-order-migration.test.ts`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-hierarchy.test.ts`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-hierarchy-ui.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-cache-adoption.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-hierarchy-navigator.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-active-workspace-hierarchy.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-navigation.test.ts`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-progress.test.ts`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-progress-summary.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-evaluation-workspace.test.tsx`
- `supabase/tests/technical_configuration_evaluation_hierarchy_order_phase_gate.sql`
- `supabase/tests/technical_configuration_evaluation_hierarchy_order_security_phase_gate.sql`

If the two known stale phase-gate assertions reproduce, report them separately as
Issue #903 baseline failures. Do not edit
`technical-configuration-baseline-hierarchy-apply-migration.test.ts` or
`technical-configuration-baseline-subgroup-mutations-migration.test.ts` in P5C.

## Scope And Review Guards

Before each commit and push:

1. List changed files against `main`.
2. Fail the scope check if source changes appear under comparison components/RPCs,
   result export, assessment persistence SQL, or either exact Issue #903 test named
   above.
3. Allow the existing OpenSpec delta file
   `specs/technical-configuration-comparison/spec.md`; it documents the shared
   capability but does not authorize comparison implementation changes.
4. Search changed evaluation code for independent `group.criteria` loops; each
   baseline-to-leaf traversal must reuse the canonical flattener.
5. Run Code Review Graph `detect_changes` with minimal detail.
6. Run GitNexus changed-file impact without reindex. Reindex only if the graph cannot
   map a changed production symbol.
7. Review the full diff for canonical tuple/order leakage, partial-cache authority,
   orphan headings, structural interaction leaks, comparison/export scope leakage, and
   missing legacy coverage.
8. Fix all actionable findings and repeat review until zero findings.

## Completion Boundary

Report before land. P5C is ready to land only when:

- P5C.0-P5C.7 are checked in `tasks.md`;
- Leaf A migration is represented locally and its apply status is stated explicitly;
- RED/GREEN evidence exists for every focused behavior;
- the 101+ fixture proves `50/51` and `100/101`;
- required gates, OpenSpec strict, and broad technical-configuration tests pass;
- Issue #903 baseline failures, if any, are reported separately;
- changed-file scope guards pass and comparison/result export remain unchanged;
- Code Review Graph and GitNexus review report zero actionable findings;
- the committed branch is pushed and its results are reported before merge.
