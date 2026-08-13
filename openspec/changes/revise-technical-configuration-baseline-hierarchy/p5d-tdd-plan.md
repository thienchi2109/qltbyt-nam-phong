# P5D Hierarchy-Aware Result Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the stable technical-configuration result dataset and Excel workbook
with canonical section/subgroup/criterion rows and per-option structural aggregates
without changing ranking, matrix partitioning, snapshot identity, missing-data, or
read-only behavior.

**Architecture:** Keep the existing result-export RPC set and opaque snapshot tokens
unchanged. The collector receives the already loaded baseline version revision and
hierarchy snapshot, verifies that revision against the stable export manifest, and
builds one immutable hierarchy row union from the collected criterion axis and matrix.
The workbook model and ExcelJS renderer consume that union; only criterion rows own
response, supplementary-information, and assessment values.

**Tech Stack:** TypeScript, React, Vitest, ExcelJS, existing P5A aggregate model,
Context Mode, Code Review Graph, GitNexus, OpenSpec.

---

## Chunk 1: Gap And Scope Lock

### Baseline

- [x] Start from clean `main@40a60a3ecf5707232d76e000d123c15cc28988d1`.
- [x] Use branch `feat/issue-893-p5d-hierarchy-result-export`.
- [x] Reuse existing Issue #893 instead of creating a duplicate P5D issue.
- [x] Confirm Issue #906 is already included in the baseline commit.
- [x] Keep Issue #903, comparison behavior, and stale hierarchy phase gates outside
      this phase.

### Discovery Findings

- [x] The current result dataset exposes only option/criterion axes, ranking rows, and
      criterion-by-option matrix cells.
- [x] The current criterion axis repeats group fields but has no subgroup ownership or
      structural rows.
- [x] The current matrix workbook model maps one physical row per criterion, and the
      renderer gives every row three option cells.
- [x] The export control counts only `group.criteria`, so subgroup criteria are omitted
      from the dialog's total.
- [x] `ranking_only` intentionally does not fetch matrix cells. P5D must not add a
      hidden matrix fetch merely to calculate aggregates.
- [x] Live Supabase currently has no representative subgroup rows, so hierarchy behavior
      must be proven with deterministic fixtures and legacy no-subgroup regressions.
- [x] The selected baseline version already supplies `revision` and `groups`; the export
      manifest supplies the same baseline revision, and that revision participates in
      the existing snapshot token. A revision equality guard therefore preserves
      snapshot identity without an RPC or SQL change.

### Non-Goals

- No comparison component, comparison row model, or comparison RPC change.
- No ranking algorithm, ranking row, eligibility, count, or tie-order change.
- No mutation, get-or-create, cache write, migration, Supabase apply, or live DB write.
- No fix for Issue #903.
- No change to the P5C cache behavior already fixed by Issue #906.
- No synthetic response, evidence, technical-axis, evidence-axis, notes, or conclusion
  fields on section or subgroup rows.

## Chunk 2: Contract Design

### Stable Collection Input

- [x] Add a collection-only baseline hierarchy context:
  - exact `baselineRevision`;
  - readonly `baselineGroups`.
- [x] Propagate the selected version revision through
      `TechnicalConfigurationEvaluationWorkspace` ->
      `TechnicalConfigurationEvaluationActiveWorkspace` ->
      `TechnicalConfigurationResultExportControl` ->
      `useTechnicalConfigurationResultExport`.
- [x] Keep the dialog request and RPC scope unchanged.
- [x] Include the baseline revision in the hook identity key so a changed baseline
      snapshot cannot reuse stale export state.
- [x] After the first manifest read, reject the whole export as `snapshot_changed` when
      its baseline revision differs from the loaded hierarchy revision; retain the
      existing final manifest stability check.

### Dataset Hierarchy Union

- [x] Extend matrix-bearing dataset variants with readonly hierarchy rows:
  - `section`: stable ID/name plus per-option aggregate summaries;
  - `subgroup`: stable ID/section ID/name plus per-option aggregate summaries;
  - `criterion`: the existing criterion-axis item only.
- [x] Keep `ranking_only` hierarchy rows `null`, matching its existing `matrix: null`
      contract and RPC call set.
- [x] Preserve the existing `criterionAxis`, ranking, matrix, manifest, and token fields.
- [x] Build canonical rows with this exact tuple:
  1. group `sort_order`;
  2. group ID;
  3. direct criterion before subgroup criterion;
  4. subgroup `sort_order` for subgroup criteria;
  5. subgroup ID for subgroup criteria;
  6. criterion `sort_order`;
  7. criterion ID.
- [x] Reuse `flattenTechnicalConfigurationEvaluationLeaves`,
      `buildTechnicalConfigurationEvaluationHierarchySections`, and
      `buildTechnicalConfigurationEvaluationHierarchyRows`; do not copy their canonical
      comparator or introduce another baseline traversal.
- [x] For all-criterion scope, retain empty sections/subgroups and aggregate them as
      `no_criteria`.
- [x] For current-page criterion scope, emit only structural ancestors of exported
      leaves and aggregate only those exported descendants.
- [x] Fail closed when an exported criterion is absent, duplicated, or owned
      inconsistently in the supplied baseline hierarchy.

### Aggregate Semantics

- [x] Reuse `buildTechnicalConfigurationHierarchyAggregateStatus`; do not introduce a
      second precedence/count implementation.
- [x] Derive each option's structural aggregate from collected matrix conclusions.
- [x] Preserve missing criterion data as `not_evaluated`.
- [x] Carry aggregate status, descendant count, and every canonical derived-status
      count for each option.
- [x] Keep criterion denominators, ranking inputs, and score semantics unchanged.

### Workbook Model

- [x] Extend matrix rows to a discriminated section/subgroup/criterion union.
- [x] Structural rows expose `option_aggregates`; criterion rows expose
      `option_values`. Neither property is shared across row kinds.
- [x] Repeat the same canonical row union on every existing option partition.
- [x] Keep metadata keys, template kind/version, ordered selected IDs, option grouping,
      and the maximum-options-per-sheet formula unchanged.
- [x] Keep overview and ranking models unchanged.

## Chunk 3: TDD Sequence

### RED 1 - Dataset Projection

- [x] Add focused pure regressions for:
  - direct criteria before complete subgroup blocks;
  - deterministic ID ties;
  - multiple groups and subgroups;
  - empty structures in all scope;
  - current-page ancestor-only projection;
  - legacy groups without a `subgroups` array;
  - missing/duplicate/invalid ownership failure;
  - exact per-option aggregate status and counts;
  - absence of response/assessment fields on structural rows.
- [x] Add collector/hook regressions proving:
  - baseline revision mismatch rejects before workbook creation;
  - matching revision returns hierarchy rows;
  - a same-dossier/same-version revision-only prop change aborts any stale run, resets
    stale success/error state, and prevents retry from using the prior hierarchy;
  - subgroup criteria contribute to the export dialog total;
  - no additional RPC is called;
  - `ranking_only` still skips matrix and hierarchy aggregation.
- [x] Run the focused tests and record expected RED failures.

### GREEN 1 - Minimal Dataset Change

- [x] Add one result-export-specific hierarchy projection module.
- [x] Keep result-export fail-closed ownership/duplicate validation in that module
      because the evaluation helpers intentionally skip malformed hierarchy members.
- [x] Keep the projection pure and independent of React, ExcelJS, and RPC transport.
- [x] Reuse the P5A aggregate model.
- [x] Extend collection types and the hook/control prop chain only as required.
- [x] Run dataset/hook focused tests to GREEN.

### RED 2 - Workbook Contract And Renderer

- [x] Add workbook-model regressions for:
  - canonical structural/criterion order;
  - per-option aggregate summaries;
  - no structural `option_values`;
  - unchanged metadata and ranking rows;
  - unchanged option partition count and option IDs per partition;
  - legacy no-subgroup output;
  - empty and missing-data behavior.
- [x] Add ExcelJS regressions for:
  - visible section/subgroup rows;
  - merged aggregate summary across each option's three columns;
  - criterion-only response, supplementary, and conclusion cells;
  - stable frozen headers, column widths, auto-filter, and hidden `_meta`;
  - large matrix continuation sheets.
- [x] Run the focused tests and record expected RED failures.

### GREEN 2 - Minimal Workbook Change

- [x] Extend the pure workbook model with the hierarchy row union.
- [x] Render section and subgroup labels in the four context columns.
- [x] Merge each structural aggregate across its option group's three columns.
- [x] Format aggregate label, descendant total, and canonical status counts without
      presenting the merged cell as a response or assessment.
- [x] Keep criterion row rendering and status fills unchanged.
- [x] Run workbook focused tests to GREEN.

### REFACTOR

- [x] Keep every source file below the 450-line ceiling and extract before a file
      approaches 350 lines.
- [x] Remove any duplicate traversal/count formatting introduced during GREEN.
- [x] Keep result-export-only naming grep-friendly.
- [x] Re-run all focused tests after cleanup.

## Chunk 4: Verification And Review

### Focused Gates

- [x] `node scripts/npm-run.js run format:check`
- [x] `node scripts/npm-run.js run verify:no-explicit-any`
- [x] `node scripts/npm-run.js run verify:dedupe`
- [x] `node scripts/npm-run.js run typecheck`
- [x] Focused result-export dataset, hook/control, contract, renderer, boundary, and
      source-contract tests.
- [x] Existing P5A aggregate tests used by the projection.

### Broad Regressions

- [x] All technical-configuration result-export tests.
- [x] Existing result-export manifest, axes, and pages migration source tests proving
      the RPC set remains `STABLE`/read-only with unchanged auth, grants, page bounds,
      and no get-or-create/write calls.
- [x] All technical-configuration tests, reporting the two unchanged Issue #903 failures
      separately if they reproduce.
- [x] Representative large-matrix and continuation-sheet tests.
- [x] Existing P5C evaluation hierarchy/progress/workspace regressions.
- [x] Confirm comparison files have no diff.

### Final Gates

- [x] `node scripts/npm-run.js run react-doctor`
- [x] `npx openspec validate revise-technical-configuration-baseline-hierarchy --strict`
- [x] Code Review Graph change detection and affected-flow review.
- [x] GitNexus changed-symbol/flow review.
- [x] Semantic deduplication check against existing hierarchy and aggregate helpers.
- [x] Review the complete diff repeatedly until zero actionable findings.
- [x] Mark P5D.1-P5D.4 complete only after fresh evidence passes.
- [x] Commit, push the branch, update Issue #893, and report results before merge/land.

### Verification Evidence - 2026-08-13

- RED/GREEN review fixes:
  - subgroup criterion denominator failed with `Tất cả 3 tiêu chí`, then passed with
    `Tất cả 4 tiêu chí` after reusing the canonical hierarchy flatten helper;
  - `evaluation-core-composition` failed when P5D imported pure hierarchy logic from the
    evaluation component directory, then passed after moving the implementation to the
    feature root and retaining a compatibility re-export;
  - SonarCloud reported `typescript:S3776` on the hierarchy candidate collector; direct
    and subgroup ownership collection were extracted into one-pass helpers, then the
    hierarchy/export and broad suites plus React Doctor were rerun to GREEN.
- Cubic review follow-up:
  - fixed the narrowed workbook fixture so section aggregates are recomputed from the
    retained criterion set;
  - fixed the duplicate-criterion regression so it duplicates a real direct criterion;
  - fixed `no_criteria` rendering so it does not append the contradictory
    `0 tiêu chí` count;
  - retained the revision-based snapshot identity because baseline groups are immutable
    content of that revision and P5D explicitly preserves the identity contract;
  - retained the defensive subgroup tracker reset because canonical leaves always place
    direct criteria before subgroup blocks, while arbitrary noncanonical input should
    re-emit a subgroup heading after an interruption.
- Complete result-export suite: 13 files, 102 tests passed.
- P5A aggregate: 2 files, 27 tests passed.
- P5C hierarchy/progress/workspace: 9 files, 63 tests passed.
- Result-export RPC/migration source contracts: 4 files, 34 tests passed.
- Broad technical-configuration app/lib suite: 121 files, 1007 tests passed.
- The two stale Issue #903 phase gates reproduce separately: 2 failed, 18 passed. P5D
  does not modify those tests, migrations, RPC activation, or OpenSpec phase history.
- React Doctor: 100/100, no findings.
- OpenSpec strict: valid.
- Code Review Graph and reindexed GitNexus reviewed the final diff; `AGENTS.md` and
  `CLAUDE.md` were restored after each GitNexus reindex.
- Independent final review, including the Sonar follow-up: zero actionable findings.
- Scope audit: no comparison files, SQL, migrations, live DB writes, or production
  mutation paths changed.
- Pull request: #907 targets `main`; no merge/land was performed in this session.

## Completion Boundary

P5D is ready to land only when hierarchy rows and aggregates are present in
matrix-bearing result workbooks, structural rows cannot own criterion cells, all
existing snapshot/ranking/partition/missing-data/read-only contracts remain green, the
broad regression result is reported, and the final review has zero actionable findings.
