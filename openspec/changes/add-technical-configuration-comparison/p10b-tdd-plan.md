# P10B TDD Plan - Comparison Matrix UI

## Scope And Delivery Decision

P10B ships as three sequential, deploy-safe UI leaves:

```text
P3A + P10A2 -> P10B1
P10B1       -> P10B2
P10B2       -> P10B3
P10B3 + P11 -> P12A
```

Each leaf starts from updated `main` after its dependency is merged. Do not
stack unmerged P10B branches.

1. `P10B1 - Core Read-Only Comparison Matrix`
2. `P10B2 - Many-Option Column Ergonomics`
3. `P10B3 - Lazy Read-Only Evidence Inspector`

This split is required because core request/render state, many-column view state
and lazy evidence state have independent failure modes, acceptance scenarios and
review boundaries. P10B1 activates a complete useful tab; P10B2 and P10B3 only
extend that deployed surface, so no leaf creates dormant production UI.

Browser tests are not required in P10B1/P10B2/P10B3 by explicit product-owner
direction on 2026-07-28. P13B remains the normative desktop/mobile browser
screenshot and interaction regression owner. Every P10B leaf still runs
focused React, keyboard/focus, responsive-source and file-size gates.

## Readiness And Fixed Inputs

P10B1 may start only after:

- P3A workspace shell and comparison tab ownership are present on `main`;
- P10A1 live comparison RPC has been applied and gated;
- P10A2 types, adapter, ordered immutable query key and dormant
  `useTechnicalConfigurationComparison` are on `main`;
- P7B2/P9B2 document read contracts and query keys are available;
- P8B3 remains the only option-response authoring owner.

The fixed P10A contract is:

- one request accepts one baseline version, 1-8 unique ordered option IDs,
  `page >= 1` and `1 <= pageSize <= 100`;
- option order is request order and must never be sorted by P10B;
- criteria are already returned in canonical group/criterion order;
- one comparison response includes fixed-size evidence summaries only;
- full baseline/option evidence is loaded separately through existing bounded
  document reads;
- reference-product response/evidence is not part of the matrix payload;
- comparison reads create no comparison set, revision or audit mutation.

## Shared UI State Contract

### Request State

- `baselineVersionId` identifies the exact baseline compared.
- `selectedOptionIds` is the immutable ordered request membership.
- Selecting an option appends it; removal preserves the order of remaining IDs.
- A ninth option stays available but cannot join the current request.
- Baseline or selected-option changes reset criterion page to one.
- P10B1 uses fixed `pageSize: 50`; no page-size selector is added.

### View State

- `visibleOptionIds` is an ordered subset of `selectedOptionIds`.
- Visibility changes never change request membership/order or the query key.
- Baseline is always visible and sticky.
- `pinnedOptionIds` is an ordered subset of visible options with a maximum of
  two IDs, rendered in selected-option order.
- `focusedOptionId` shows baseline plus one selected option.
- Entering/exiting focus mode does not mutate selected, visible or pinned state.

### Detail State

- At most one baseline or option cell detail is active.
- P10B1 detail contains full requirement, response and supplementary text.
- P10B3 extends the same detail with lazy evidence.
- Closing detail restores focus to the control that opened it.
- Supplementary information is labeled as non-scoring and never contributes to
  derived compliance.

## Ownership And Conflict Prevention

| Concern                                    | Primary owner             | Forbidden overlap                                  |
| ------------------------------------------ | ------------------------- | -------------------------------------------------- |
| RPC/types/adapter/query key                | P10A1/P10A2               | P10B1-3 must not redefine or wrap a second path    |
| Shared read-only option list query         | P10B1                     | No P8 draft/mutation behavior change               |
| Request selection and criterion paging     | P10B1                     | P10B2 view state cannot change request order       |
| Core rows, sticky baseline and text detail | P10B1                     | P10B2/P10B3 only extend assigned surfaces          |
| Visibility, pinning and focus              | P10B2                     | No comparison refetch caused by view-only controls |
| Full evidence detail                       | P10B3 through P7/P9 reads | No preload, N+1 or evidence mutations              |
| Response authoring and dirty state         | P8B3                      | No P10 response textarea/copy/save controls        |
| Manual evaluation and ranking              | P11/P12                   | No assessment field or derived compliance in P10B  |
| Browser regression                         | P13B                      | No browser gate in P10B1/P10B2/P10B3               |

## Required Workflow Before Each Leaf

- Recall AgentMemory with the leaf ID and target files/symbols.
- Use Code Review Graph minimal context before broad source reading.
- Use GitNexus context/impact for the narrowed shell, hooks and components.
- Invoke `karpathy-coding-heuristics`.
- Invoke `next-best-practices`, then `react-best-practices`.
- Invoke `test-driven-development` before production edits.
- Invoke `code-deduplication` before adding/extracting option-list query behavior,
  state helpers or reusable matrix primitives.
- Keep every production source file below 350 lines where practical and never
  above the 450-line hard ceiling.
- Keep all state/data ownership outside
  `TechnicalConfigurationWorkspaceShell.tsx`.
- Do not modify SQL, migrations, RPC allowlists, comparison types, the P10A2
  adapter/query key or shared `callTechnicalConfigurationRpc`.
- A dependency gap requires an OpenSpec/issue update, not scope expansion.

## P10B1 - Core Read-Only Comparison Matrix

### Issue And Branch

- Issue title:
  `P10B1: Add core read-only technical configuration comparison matrix`
- Branch:
  `feat/technical-config-p10b1-core-matrix`

### Production Files

- Create:
  `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationComparisonTab.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrix.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrixToolbar.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationCriterionPanel.tsx`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationComparisonMatrix.ts`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionListQuery.ts`
- Modify:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptions.ts`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`

Estimated production additions: 600-850 lines across 8 files.

### Test Files

- Create:
  `src/app/(app)/technical-configurations/__tests__/comparison-matrix-core.test.tsx`
- Modify only when needed for integration/regression:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx`
- Rerun:
  `comparison-contract.test.ts`,
  `supplier-options.test.tsx` and relevant supplier-option workspace cases.

Estimated test additions: 450-650 lines across 1-2 files.

### RED 1 - Shared Read-Only Option Query

- Prove the new query seam uses
  `technicalConfigurationOptionsQueryKey(dossierId)`.
- Prove it delegates to `listAllTechnicalConfigurationOptions` once with
  `AbortSignal`, `staleTime: 30_000`, `retry: false` and
  `refetchOnWindowFocus: false`.
- Prove the existing P8 hook consumes the seam without changing selection,
  dirty, conflict, mutation or navigation behavior.

### GREEN 1

- Extract the minimum shared option-list query hook.
- Rewire only the P8 read query construction; leave all draft/mutation state in
  `useTechnicalConfigurationOptions`.

### RED 2 - Ordered Request State

- Adding options appends IDs and removing one preserves remaining order.
- Duplicate selection is ignored and the ninth selection is blocked.
- Deleted/missing option reconciliation filters stale IDs without sorting.
- Baseline/selection changes reset page to one.
- Empty baseline or selection leaves the P10A2 hook disabled.
- Every request uses fixed page size 50.

### GREEN 2

- Add the matrix orchestration hook with explicit request transitions.
- Consume `useTechnicalConfigurationComparison` unchanged.

### RED 3 - Core Matrix Rendering

- Render canonical group/criterion order.
- Render sticky baseline and option columns in request order.
- Render supplier/option display labels from P10A2 data.
- Render concise long text, empty response, supplementary information and
  fixed evidence summaries without an evidence request.
- Open a text-only detail with full requirement/response/supplementary content.
- Render loading, error, no-selection, empty-page and retry states.
- Prove no P8B3 authoring label/control is present.

### GREEN 3

- Add toolbar, matrix and text-only detail components.
- Enable the workspace comparison tab only when the P10B1 component is mounted.

### P10B1 Exit Gate

- TC-13-S01, the TC-13-S02 core-dimension/text gate and TC-17-S01 React/source
  gates pass; P10B3/P12A remain responsible for evidence/assessment composition.
- TC-17-S02 regression proves supplementary information remains non-scoring.
- Ordered query and P8 supplier-option regressions pass.
- The shell remains composition-only and below the extraction threshold.
- No browser test is run; P13B remains responsible.

## P10B2 - Many-Option Column Ergonomics

### Issue And Branch

- Issue title:
  `P10B2: Add comparison column visibility, pinning and focus mode`
- Branch:
  `feat/technical-config-p10b2-column-ergonomics`

### Files

- Create:
  `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationMatrixColumnControls.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/comparison-matrix-columns.test.tsx`
- Modify only if the shared matrix contract changes:
  `src/app/(app)/technical-configurations/__tests__/comparison-matrix-core.test.tsx`
- Modify:
  `TechnicalConfigurationMatrix.tsx`,
  `TechnicalConfigurationMatrixToolbar.tsx` and
  `useTechnicalConfigurationComparisonMatrix.ts`.

Estimated production additions: 250-400 lines across 3-4 files.
Estimated test additions: 300-450 lines across 1-2 files.

### RED 1 - View State Separation

- Hiding/showing columns preserves `selectedOptionIds` and the comparison query
  key.
- Visible IDs remain an ordered subset after selection refresh/removal.
- Baseline cannot be hidden.

### GREEN 1

- Add explicit view-state transitions to the matrix hook.
- Add a dedicated column-controls component.

### RED 2 - Pinning

- At most two visible option columns are pinned.
- Pinned columns render in selected-option order with deterministic offsets.
- Hiding/removing a pinned option reconciles pin state without reordering other
  options.

### GREEN 2

- Add stable column widths and computed sticky offsets.

### RED 3 - Focus Mode And Accessibility

- Focus mode renders baseline plus one selected option.
- Exiting restores the previous visible/pinned view.
- Toolbar controls are keyboard-operable and return focus deterministically.
- Eight selected options remain horizontally reachable under narrow/wide class
  constraints without layout-shifting dimensions.

### GREEN 3

- Add focus controls and responsive layout constraints.

### P10B2 Exit Gate

- TC-13-S03 React, reducer, keyboard and responsive-source gates pass.
- Request membership/order and P10A2 query count remain unchanged.
- Matrix/toolbar/state files satisfy file-size checks.
- No browser test is run; P13B remains responsible.

## P10B3 - Lazy Read-Only Evidence Inspector

### Issue And Branch

- Issue title:
  `P10B3: Add lazy read-only comparison evidence inspector`
- Branch:
  `feat/technical-config-p10b3-evidence-inspector`

### Files

- Create:
  `src/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationComparisonEvidence.tsx`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationComparisonEvidence.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/comparison-matrix-evidence.test.tsx`
- Modify only if the shared detail-panel contract changes:
  `src/app/(app)/technical-configurations/__tests__/comparison-matrix-core.test.tsx`
- Modify:
  `TechnicalConfigurationCriterionPanel.tsx`.

Estimated production additions: 300-500 lines across 3 files.
Estimated test additions: 300-500 lines across 1-2 files.

### RED 1 - Lazy Enablement

- Closed detail triggers no evidence query.
- `hasEvidence: false` triggers no evidence query.
- Opening one baseline cell calls only the existing baseline document-list path.
- Opening one option cell calls only the existing exact-baseline option
  document-list path.
- Switching/closing detail cancels or disables the obsolete request.

### GREEN 1

- Add one read-only evidence hook using existing RPC wrappers/query keys.
- Keep baseline and option request branches explicit; add no generic owner
  abstraction that changes P7/P9 behavior.

### RED 2 - Bounded Evidence Rendering

- Render only documents/citations applicable to the active criterion.
- Support bounded page/load-more behavior and avoid all-cell preload.
- Render loading, error, no-evidence and long-excerpt states.
- Restore focus to the opening matrix cell on close.
- Render no create/update/delete/citation-editor/save controls.

### GREEN 2

- Extend the existing criterion panel with a read-only evidence section.

### P10B3 Exit Gate

- The TC-13-S02/S05 evidence-inspection gates and rerun TC-13-S01/S03,
  TC-17-S01/S02 gates pass; P12A remains responsible for composing manual
  assessment into the detail workflow.
- Existing P7/P9 document contract/delegation tests remain green.
- One comparison page plus at most one active detail read is observed; no N+1 or
  per-option comparison fetch path is introduced.
- No assessment data is invented and reference-product evidence stays outside
  the matrix.
- No browser test is run; P13B remains responsible.

## Verification Order For Every P10B Leaf

Run through one `ctx_batch_execute`:

1. `node scripts/npm-run.js run format:check`
2. `node scripts/npm-run.js run verify:no-explicit-any`
3. `node scripts/npm-run.js run verify:dedupe`
4. `node scripts/npm-run.js run typecheck`
5. Leaf-focused Vitest files plus named upstream regressions
6. `node scripts/npm-run.js run react-doctor`
7. `openspec validate add-technical-configuration-comparison --type change --strict --no-interactive`
8. `git diff --check`

Invoke `code-deduplication` before commit and push because P10B1 introduces a
shared option-list query seam and all leaves add reusable comparison behavior.

## Explicit Out Of Scope

- SQL, migrations, grants, indexes or live DB operations.
- P10A2 wire/domain types, adapter, query key or shared transport changes.
- Sorting selected option IDs independently of user selection order.
- Response textarea, copy-from-baseline, dirty draft, save or save-next.
- Evidence create/update/delete or citation editing.
- Manual assessment persistence, notes, progress, ranking or compliance.
- Reference-product aggregation into the matrix.
- Full-evidence preload, permanent evidence columns or N+1 fetches.
- Browser tests in P10B1/P10B2/P10B3; P13B owns them.
