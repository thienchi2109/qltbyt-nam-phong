# P4A TDD Plan - Hierarchical Editor State

## Goal

Deliver the pure hierarchy-aware baseline editor state and save projection required by
P4A while preserving the current production editor behavior. The model must support
sections, subgroups, direct criteria, subgroup criteria, structural moves, reorder,
delete, validation, clone, and dirty comparison without changing criterion identity.

## Preflight

- clean starting commit: `122e161041ac501010f5f6e7af233e2ae5d745bd`;
- implementation branch: `feat/887-p4a-hierarchical-editor-state`;

Any migration, generated database type, production RPC activation, or production
editor rendering change is a stop condition.

## Scope Decisions

### Use one canonical nested editor tree

Each section owns:

- direct criteria in `criteria`;
- ordered subgroup blocks in `subgroups`;
- each subgroup owns its complete ordered `criteria` block.

Wire groups with no `subgroups` property normalize to `subgroups: []`. Existing
two-level drafts therefore remain valid and continue to render through the unchanged
production editor, which reads only direct group criteria.

### Preserve criterion identity across ownership moves

A criterion move relocates the existing editor criterion object without regenerating
its `key`, `id`, or `criterionCode`. The target owner is explicit:

- direct owner: section key plus `subgroupKey: null`;
- subgroup owner: section key plus the subgroup key.

Invalid source or target owners are no-ops. Moving a subgroup or section always moves
the complete nested block.

### Keep canonical order structural

The nested tree is the source of truth:

1. section;
2. direct criteria;
3. subgroup blocks in subgroup order;
4. criteria within each subgroup.

The dormant save mapper emits this canonical order. It does not call RPCs or alter the
current P2 save orchestration.

### Keep production editor isolated

P4A may extend shared editor types, mapping, clone, validation, and dirty comparison,
but it must not modify:

- `TechnicalConfigurationBaselineEditor.tsx`;
- `TechnicalConfigurationBaselineTab.tsx`;
- `useTechnicalConfigurationBaselineEditor.ts`;
- baseline RPC names, allowlists, or client methods.

P4B and P4C own hierarchy rendering and authoring controls.

## File Ownership

Create:

- `src/app/(app)/technical-configurations/technical-configuration-baseline-hierarchy-editor-state.ts`
  for hierarchy-specific pure mutations;
- `src/app/(app)/technical-configurations/technical-configuration-baseline-editor-snapshot.ts`
  for hierarchy-aware deep clone and dirty comparison;
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-editor-state.test.ts`
  for focused P4A behavior;
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-editor-ordering.test.ts`
  for target-index and ordering regressions;
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-editor-snapshot.test.ts`
  for validation, clone, dirty, and save-row projection regressions;
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-editor-state-fixtures.ts`
  for hierarchy wire fixtures shared by the focused tests.

Modify:

- `technical-configuration-baseline-editor-state.ts` for hierarchy-aware types, wire
  mapping, validation, and editor key helpers;
- `technical-configuration-baseline-save-mappers.ts` for the dormant canonical save
  projection;
- `technical-configuration-baseline-editor.ts` only to re-export the new pure module;
- existing editor-state/save tests only where the backward-compatible normalized
  `subgroups: []` shape changes expected data;
- this OpenSpec `tasks.md` only after all P4A checks pass.

Do not modify production components, hooks, migrations, generated database files, or
Supabase state.

## TDD Slices

1. RED: hierarchy wire mapping, legacy two-level normalization, and section/subgroup/
   direct-criterion/subgroup-criterion creation.
2. GREEN: minimal hierarchy-aware editor types and creation helpers.
3. RED: section/subgroup reorder, criterion reorder, direct-to-subgroup,
   subgroup-to-direct, and subgroup-to-subgroup moves with stable identity.
4. GREEN: immutable hierarchy operations using the existing generic item mover.
5. RED: section/subgroup/criterion delete, subgroup validation, hierarchy deep clone,
   and dirty comparison for content, order, and ownership.
6. GREEN: hierarchy-aware validation, clone, and dirty comparison.
7. RED: canonical dormant save rows with direct criteria before complete subgroup
   blocks and stable identity fields.
8. GREEN: minimal save projection without RPC or production-hook wiring.
9. REFACTOR: remove local duplication, keep every source file below the 450-line hard
   ceiling, and preserve the existing production import graph.

## Verification

Run the focused RED and GREEN command after each slice:

```bash
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-editor-state.test.ts"
```

Then run the required chain in repository order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run verify:ts-docstrings
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-editor-state.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-editor-ordering.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-editor-snapshot.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-editor-state.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-save.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-types.test.ts"
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__"
node scripts/npm-run.js run react-doctor
openspec validate revise-technical-configuration-baseline-hierarchy --strict
```

Before commit:

- run Code Review Graph change detection;
- run GitNexus changed-file impact;
- verify production editor components and hooks are absent from the diff;
- run independent subagent review until zero findings;
- mark only P4A tasks complete;
- commit and push the feature branch through enabled Lefthook hooks;
- do not open or merge a pull request, and do not close Issue #887 before the user
  reviews the result.

## TDD Evidence

- Initial focused RED: 9/9 tests failed because subgroup wire mapping, hierarchy
  mutation APIs, hierarchy snapshot behavior, and the canonical save-row mapper did
  not exist.
- Initial GREEN: the same 9/9 focused tests passed after adding the minimum canonical
  nested state, immutable mutations, hierarchy-aware snapshot behavior, and dormant
  save projection.
- Compatibility refactor: existing two-level expectations were updated only for
  canonical `subgroups: []` mapping. A no-op identity regression test then failed
  because boundary moves and missing deletes returned new drafts; the mutation
  helpers were tightened to preserve the original draft reference.
- Identity dirty-check RED: 1/4 snapshot tests failed because changing persisted
  `criterionCode` was incorrectly considered clean. Comparing `criterion_code` fixed
  the false-clean state while preserving client-only `key` exclusion.
- Full-suite compatibility RED: 10/762 tests failed because legacy production test
  drafts omitted `subgroups`, and the empty validation object exposed a new field
  before hierarchy activation. Hierarchy readers now treat missing `subgroups` as an
  empty array, while `subgroupErrors` is present only when a hierarchy actually
  contains subgroups.
- Focused final regression: 6 files and 40/40 tests passed.
- Full technical-configuration regression: 92 files and 765/765 tests passed.
- React Doctor diff scan: 100/100 with zero issues.
- OpenSpec strict validation: valid.
- Code Review Graph and GitNexus were refreshed after the implementation changes.
  Semantic reuse review found no equivalent existing immutable hierarchy helper.
- The first `mix-gpt-5.6` xhigh review found missing explicit dirty-order and
  target-index regressions plus incomplete file ownership documentation. The findings
  were accepted and fixed before final review.
- The final `mix-gpt-5.6` xhigh re-review checked the current staged evidence and
  completed with zero findings.

## Completion Boundary

P4A is complete when the hierarchy editor model and dormant save projection are fully
tested while:

- legacy two-level drafts normalize without data loss;
- criterion `key`, `id`, and `criterionCode` survive ownership moves;
- direct criteria precede complete subgroup blocks in canonical save order;
- the production editor rendering and RPC surface remain unchanged;
- no migration or live database write occurs;
- strict OpenSpec validation and independent review finish with zero findings.
