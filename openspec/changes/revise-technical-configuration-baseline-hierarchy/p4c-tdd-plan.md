# P4C TDD Plan - Hierarchical Authoring Controls

## Goal

Complete subgroup and criterion hierarchy authoring against the P1E mutation
contracts while keeping every P4C control unmounted from the production baseline
screen until P6A. Preserve the P4B hierarchy presentation and the existing explicit
Save, dirty-navigation, conflict, lock, reload, focus, scrolling, validation, pending
buffer, accessibility, and responsive contracts.

## Preflight

- Base: clean `main` at `89f39c5b`.
- Tracking issue: `#889`.
- Branch: `feat/889-p4c-hierarchical-authoring-controls`.
- Dependencies: P4B `#888` and P1E `#880` are present on the base commit.
- Code Review Graph and GitNexus were current at `89f39c5b`; reindex after the
  implementation before final impact review.
- Read-only live Supabase inspection confirmed the P1E subgroup and hierarchy
  criterion functions are deployed with `SECURITY DEFINER` and fixed
  `search_path`, but remain revoked from `authenticated` as required until P6A.
- No migration, generated database type, RPC function, allowlist activation, grant,
  or live database write belongs to P4C.

## Scope Decisions

### Keep production authoring unmounted

Hierarchy authoring is an explicit opt-in component capability. Tests mount the
editor with the capability enabled; `TechnicalConfigurationBaselineTab` continues to
omit it. Hiding with CSS or rendering disabled controls is insufficient because P6A
owns production activation.

### Extend the canonical nested draft

All UI actions delegate to the P4A immutable hierarchy helpers. Do not create a
parallel UI tree or regenerate criterion keys, IDs, or codes when criteria move.
Direct criteria remain before complete subgroup blocks, and section/subgroup
ordinals are derived from current array positions after every structural edit.

### Scope multiline state by criterion owner

Reuse `useTechnicalConfigurationBulkEntrySessions` with stable owner session keys:

- a main-section key for direct criteria;
- a subgroup-qualified key for subgroup criteria.

Pending input remains local until accepted or cancelled, contributes to dirty
navigation blocking, disables Save, survives collapse/remount, and is cleared only
for the owner that is deleted or explicitly cancelled.

### Preserve one Save transaction model

Extend the existing baseline save engine and typed RPC client. Do not add a second
Save button or autosave structural actions. The save sequence must:

1. validate before the first mutation;
2. create/update required parent rows;
3. create, update, or move criteria while preserving identity;
4. move any surviving criteria out of parents that will be removed;
5. delete removed criteria, then empty removed subgroups, then removed sections;
6. reorder the complete remaining criterion-owner, subgroup, and section ID sets;
7. chain every returned revision into the next call;
8. preserve accepted progress and all remaining local edits on partial failure.

Conflict detection, explicit reload, locked-version read-only rendering, and
save-resume behavior continue through `useTechnicalConfigurationBaselineEditor`.

### Extract before source files cross the threshold

The current editor, group section, baseline editor hook, and save steps are already
near the 350-line extraction threshold. Put new hierarchy-specific behavior in
grep-friendly module files instead of expanding those owners past the threshold.
No source file may exceed 450 lines.

## File Ownership

Expected production changes:

- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx`
  - accept the opt-in authoring capability and route hierarchy callbacks;
  - preserve the existing scroll container, summary, Save, and focus behavior.
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineGroupSection.tsx`
  - mount subgroup add controls only when authoring is enabled;
  - pass owner-scoped entry and move callbacks without changing direct workflows.
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineSubgroupSection.tsx`
  - support accessible rename/delete/reorder and subgroup entry controls;
  - preserve independent disclosure and focus acknowledgement.
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineSubgroupCriteria.tsx`
  and `TechnicalConfigurationCriteriaSpreadsheet.tsx`
  - expose criterion move actions without duplicating criterion row rendering.
- New hierarchy-specific component/type files under
  `src/app/(app)/technical-configurations/_components/`
  - keep control menus, owner choices, and callback contracts out of near-limit files.
- `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor.ts`
  and a new hierarchy-authoring hook
  - compose subgroup CRUD, criterion moves, owner-scoped entry, focus, and buffer
    cleanup with existing inline editing.
- `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions.ts`
  - synchronize stable direct/subgroup owner session keys.
- `src/app/(app)/technical-configurations/baseline-types.ts` and
  `_hooks/useTechnicalConfigurationBaseline.ts`
  - type the already-deployed P1E mutation paths;
  - keep their names in a hierarchy-only registry that is not imported by
    `BASELINE_RPC_FUNCTIONS` or either proxy role set;
  - assert that the production proxy still rejects those names until P6A.
- `src/app/(app)/technical-configurations/technical-configuration-baseline-save.ts`,
  `technical-configuration-baseline-save-mappers.ts`, and extracted hierarchy save
  steps
  - diff and persist subgroup rows and criterion ownership/order while preserving
    partial-save progress.

Expected tests:

- a focused authoring-controls test for subgroup CRUD/reorder, criterion moves,
  ordinals, keyboard/focus, validation, and responsive layout;
- an owner-scoped entry test for direct/subgroup single-row and multiline buffers;
- save-engine tests for RPC choice, revision chaining, identity, canonical order,
  conflict, deletion-before-reorder, and partial progress after subgroup creation
  and criterion movement;
- tab/workflow tests for production isolation, dirty navigation, reload blocking,
  conflict recovery, structural dirty/pending lock blocking, subgroup-only lock
  eligibility, lock replacement, and save-resume.

Extract or split test files around 350 lines and never exceed 450 lines. Put P4C save
cases in a new hierarchy-save module rather than extending the existing oversized
legacy save test.

## TDD Slices

1. RED: production baseline rendering contains no P4C controls, while an opted-in
   editor harness expects accessible subgroup create/rename/delete/reorder controls.
2. GREEN: add the opt-in authoring contract and minimum subgroup controls; keep the
   production tab call site unchanged.
3. RED: subgroup edits and criterion moves preserve stable criterion identity,
   canonical owner order, focus, and normalized Roman/decimal labels.
4. GREEN: compose the existing P4A hierarchy helpers through a hierarchy-specific
   inline editor hook and focused UI controls.
5. RED: direct and subgroup single-row/multiline entry use independent buffers,
   survive structural collapse, block Save/navigation while pending, and clear only
   the deleted owner.
6. GREEN: generalize bulk-session synchronization to stable owner keys and wire
   subgroup entry through the existing workbench.
7. RED: save tests require subgroup create/update/delete/reorder plus hierarchy
   criterion create/move/reorder calls with exact revision chaining,
   deletion-before-reorder, and no legacy identity replacement.
8. GREEN: extend the typed client and save-step engine using only deployed P1E
   function names kept outside the production allowlist; preserve partial progress
   and conflict classification.
9. RED: user-event save-resume tests cover successful save, late-step failure,
   retry immediately after subgroup creation and criterion movement without
   repeating accepted calls, stale-revision conflict, explicit reload, pending
   reload/lock blocking, subgroup-only lock eligibility, and locked-version
   replacement.
10. GREEN/REFACTOR: preserve current hook orchestration, validation/focus contracts,
    definite-height scrolling, accessibility, and responsive classes; remove any
    semantic duplication and keep files within limits.

Each RED must be run and observed failing for the intended missing P4C behavior
before its production implementation.

## Verification

Run through context-mode in repository order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-controls.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-entry.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-save.test.ts' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx'
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations'
node scripts/npm-run.js run react-doctor
openspec validate revise-technical-configuration-baseline-hierarchy --strict
```

Also verify:

- all changed controls are absent from the production baseline tab DOM;
- the local client uses the exact deployed P1E function names and no server
  allowlist/grant changed; automated tests prove the hierarchy names remain absent
  from both proxy role sets;
- Code Review Graph changed-file impact and GitNexus changed-symbol/process impact
  after reindexing the implemented branch;
- semantic deduplication against existing editor controls, disclosure, bulk-entry,
  focus, ordinal, operation-lock, and conflict/reload helpers;
- touched source-file line counts and responsive/accessibility regressions;
- `mix-gpt-5.6-sol` at the highest available reasoning level until the reviewer
  reports `Zero findings`.

## Completion Boundary

Before reporting:

- mark only P4C tasks complete in `tasks.md`;
- update Issue `#889` with verification evidence while leaving it open;
- commit and push the feature branch through enabled Lefthook hooks;
- do not open/merge a pull request, close the issue, activate P4C controls, change
  server grants/allowlists, or write to live Supabase before the user reviews the
  result and authorizes landing.
