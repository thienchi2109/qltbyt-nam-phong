# P5B TDD Plan - Comparison Hierarchy

## Scope

Implement P5B.1-P5B.3 only:

- render main sections and subgroups as comparison heading rows;
- keep option cells, response/evidence inspection, criterion detail and
  evaluation actions on criterion rows only;
- preserve criterion-based pagination, option pinning, focus mode and the
  legacy no-subgroup comparison;
- add regression coverage for direct criteria, subgroup criteria, many
  options, pagination and evidence.

Do not change evaluation behavior, result export, comparison RPC pagination,
SQL migrations or live Supabase state. The two stale phase-gate assertions in
Issue #903 remain outside this leaf.

## Assumptions

- Start from clean `main` at merge commit
  `184acd1dd7468638bc74383374e845a001a231b9`.
- P1C already exposes canonical hierarchy snapshots through baseline-version
  reads. The comparison workspace has the selected decoded baseline version in
  `matrix.versions`; P5B does not need a new comparison RPC or another query.
- The comparison RPC continues to paginate leaf criteria only. Section and
  subgroup headings are presentation rows derived from the selected baseline
  hierarchy around the criteria returned for the current page.
- A heading is rendered only when the current comparison page contains at
  least one descendant criterion for that heading. This prevents empty
  structural rows from changing page totals or appearing on unrelated pages.
- Canonical mixed-child order is direct criteria first, followed by subgroup
  blocks in baseline snapshot order.
- Existing legacy results without hierarchy metadata keep their current
  `group -> criterion` presentation through a compatibility fallback.

## Row Contract

Add a discriminated comparison presentation row union:

- `section`
  - owns section ID/name and no option/evidence/action payload;
- `subgroup`
  - owns subgroup ID/name and parent section identity with no
    option/evidence/action payload;
- `criterion`
  - wraps the existing comparison criterion row unchanged.

A pure builder receives:

- the selected baseline version hierarchy;
- the current comparison page criteria.

It returns canonical presentation rows while matching criteria by stable
criterion ID. Structural rows never create synthetic option values, evidence,
assessment status or criterion IDs.

## File Map

Create:

- `src/app/(app)/technical-configurations/technical-configuration-comparison-hierarchy.ts`
  - owns the presentation row union, hierarchy-to-page projection and legacy
    fallback.
- `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrixHeadingRow.tsx`
  - renders section/subgroup headings across the currently rendered columns.
- `src/app/(app)/technical-configurations/__tests__/comparison-matrix-hierarchy.test.tsx`
  - owns direct/subgroup order, criterion-only cells/actions, many-option,
    pagination and evidence regressions.

Modify:

- `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrix.tsx`
  - accepts selected baseline hierarchy, builds presentation rows and branches
    heading vs criterion rendering.
- `src/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationEvaluationActiveWorkspace.tsx`
  - passes the already selected baseline-version groups to the matrix without
    changing evaluation state or navigation.
- `src/app/(app)/technical-configurations/__tests__/comparison-matrix-test-fixtures.tsx`
  - adds reusable hierarchy fixtures only if needed by the focused tests.
- `openspec/changes/revise-technical-configuration-baseline-hierarchy/tasks.md`
  - marks P5B.1-P5B.3 complete only after verification and zero-finding
    review.

No evaluation-state, navigator, assessment, result-export, SQL or migration
file is in scope.

## TDD Sequence

### RED 1 - Canonical Heading Rows

1. Add a hierarchy fixture with:
   - one section containing a direct criterion;
   - one subgroup containing a criterion;
   - a second section containing another direct criterion.
2. Render a page containing direct and subgroup criteria.
3. Assert canonical row order:
   section -> direct criterion -> subgroup -> subgroup criterion -> next
   section -> direct criterion.
4. Assert section and subgroup rows have distinct heading test IDs and
   accessible row-header text.
5. Run the focused test and confirm RED because structural heading rows do not
   exist.

### RED 2 - Criterion-Only Interactions

1. Render the hierarchy with multiple visible/pinned options and focus mode.
2. Assert option cells remain exactly
   `criterion count x rendered option count`.
3. Assert baseline/option detail and evaluation actions exist only for
   criterion IDs.
4. Assert structural rows expose no evidence summary, option cells,
   evaluation targets or detail buttons.
5. Run the focused test and confirm RED against the current group-only
   renderer.

### RED 3 - Pagination And Evidence

1. Render a later comparison page with a subset of hierarchy criteria.
2. Assert `total`, `page`, `pageSize` and pagination callbacks remain
   criterion-based.
3. Assert only headings with descendants on the current page render.
4. Open baseline and option evidence detail for a subgroup criterion and prove
   existing evidence targets retain the exact baseline version, option and
   criterion IDs.
5. Run the focused test and confirm RED for missing hierarchy projection.

### GREEN - Minimal Comparison Projection

1. Implement the pure hierarchy projection with stable ID matching.
2. Preserve legacy fallback when no selected hierarchy is supplied.
3. Add the structural heading component with one full-width table cell and no
   interactive comparison payload.
4. Replace group-only body construction with presentation-row branching.
5. Pass `selectedVersion.groups` from the active workspace.
6. Run the focused P5B suite to GREEN.

### REFACTOR

1. Keep the pure builder immutable and linear over hierarchy/page criteria.
2. Reuse existing matrix widths, sticky option calculations and criterion row
   component unchanged.
3. Keep new source files below repository extraction thresholds.
4. Run the focused suite again after cleanup.

## Verification

Run in repository order through one context-mode batch:

1. `node scripts/npm-run.js run format:check`
2. `node scripts/npm-run.js run verify:no-explicit-any`
3. `node scripts/npm-run.js run verify:dedupe`
4. `node scripts/npm-run.js run typecheck`
5. focused P5B tests plus affected comparison/evaluation regression files
6. `node scripts/npm-run.js run react-doctor`
7. `npx openspec validate revise-technical-configuration-baseline-hierarchy --strict`
8. broad technical-configuration regression suite

If the two known stale phase-gate assertions reproduce, report them separately
as Issue #903 baseline failures and do not modify them in P5B.

After tests pass:

- run Code Review Graph change detection;
- run GitNexus changed-file impact without reindex unless the graph cannot map
  the changed symbols;
- inspect the complete diff for evaluation/export scope leakage, structural
  interaction leaks and missing tests;
- fix all actionable findings and repeat review until zero findings.

## Completion Boundary

P5B is ready to land only when:

- P5B.1-P5B.3 are checked in `tasks.md`;
- RED/GREEN evidence exists for the focused regressions;
- required gates and OpenSpec strict pass;
- broad-suite results explicitly separate any Issue #903 baseline failures;
- review reports zero actionable findings;
- the committed branch is pushed and reported before merge.
