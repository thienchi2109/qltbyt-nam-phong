# Issues 960 and 961 Technical Configuration Test Fixtures Design

## Goal

Restore the stale Technical Configurations regression suites without changing
production behavior, backend contracts, or RPC implementations.

## Scope

The change updates five existing test files:

- `baseline-locking.test.tsx`
- `baseline-contract.test.ts`
- `technical-configuration-inline-workflow.test.tsx`
- `technical-configuration-version-workflow-review.test.tsx`
- `technical-configuration-workspace-shell-source.test.ts`

No production source file should change unless a focused test proves an actual
production defect. The current baseline shows fixture and matcher failures only.

## Test Contract

Version workflow tests should query the current accessible selector contract
instead of assuming that version and status text are rendered as separate text
nodes. Existing behavioral assertions for locking, history navigation, copied
lineage, stale revisions, dirty-state guards, and draft creation must remain.

The inline workflow suite should render the baseline tab under a local
`QueryClientProvider`, matching the component's existing cross-dossier hook
dependency. The test client must disable retries and avoid sharing cache state
between tests.

The RPC contract fixture should include the three already-present cross-dossier
copy functions. This refreshes the expected client contract without changing
the RPC implementation.

The source-size assertion should count physical lines without treating a final
newline as an additional line. The documented extraction threshold is
approximately 350 lines, so a 350-line source file is accepted while files over
350 physical lines fail. The pre-existing 357-line
`useTechnicalConfigurationBaselineEditor.ts` hook remains outside this
test-maintenance scope and is locked to exactly 357 lines as a ratchet: either
growth or later shrinkage requires an intentional follow-up.

## Verification

The five focused suites must pass 34/34 tests. Because the diff touches
TypeScript and React tests, the change must also pass formatting,
`verify:no-explicit-any`, `verify:dedupe`, typecheck, and React Doctor.
