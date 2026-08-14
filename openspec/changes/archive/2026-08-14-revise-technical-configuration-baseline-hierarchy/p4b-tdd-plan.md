# P4B TDD Plan - Subgroup Presentation

## Goal

Deliver the presentation-only hierarchy required by P4B so the baseline editor renders
main sections, direct criteria, subgroup structural rows, and subgroup criteria in
canonical order. Main sections and subgroups must collapse independently while the
existing editor keeps its definite-height scrolling, focus transitions, pending
multiline buffers, validation associations, and responsive layout.

## Preflight

- issue: `#888`;
- clean starting commit: `fadeb90a4490405386d8724765215f0d4043f265`;
- implementation branch: `feat/888-p4b-subgroup-presentation`;
- AgentMemory had no prior P4B-specific entry;
- GitNexus was current at `fadeb90a`, so no pre-edit reindex was required.

Any subgroup authoring control, response or assessment control, migration, generated
database change, RPC change, or live database write is a stop condition.

## Scope Decisions

### Render the canonical nested editor tree

The current editor `group` is the P4 hierarchy main section. Each section renders:

1. its existing direct criteria;
2. then its ordered subgroup blocks;
3. then each subgroup's ordered criteria.

Legacy two-level drafts continue to render exactly as before because P4A normalizes
missing subgroup arrays to `subgroups: []`.

### Keep P4B presentation-only

Existing section and direct-criterion editing behavior remains intact. P4B adds
subgroup structural rows and subgroup criterion presentation, but does not add:

- subgroup create, rename, delete, or reorder controls;
- criterion move controls between direct and subgroup owners;
- subgroup-scoped single-row or multiline entry;
- response, evidence, assessment, or aggregate-status controls.

Those behaviors remain owned by P4C and later phases.

### Reuse disclosure and preserve native keyboard behavior

Main-section disclosure remains owned by
`useTechnicalConfigurationGroupDisclosure`. Subgroup disclosure reuses the same hook
with subgroup keys scoped inside the section component. Both structural levels use a
native button trigger with explicit accessible names, `aria-expanded`, and
`aria-controls`; Enter and Space behavior therefore comes from the button primitive.
Every structural row starts expanded and preserves independent collapsed state while
its key remains present.

### Preserve direct-criterion workflows

The existing direct-criterion spreadsheet, bulk-entry workbench, callbacks, focus
targets, validation IDs, pending-input description, and editor scroll container stay
on their current ownership path. Hierarchy focus lookup expands the containing main
section when a target criterion belongs to a subgroup, while the subgroup presentation
owns the final focus and nearest scrolling behavior.

### Keep presentation files below the extraction threshold

`TechnicalConfigurationBaselineGroupSection.tsx` is already close to the 350-line
extraction threshold. Subgroup structural rows and subgroup criterion presentation
must be extracted into grep-friendly `TechnicalConfigurationBaseline...` components
instead of extending the existing file toward the 450-line hard ceiling.

## File Ownership

Create:

- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineSubgroupSection.tsx`
  for one accessible, independently collapsible subgroup structural row;
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineSubgroupCriteria.tsx`
  for subgroup criterion presentation, focus, scrolling, and validation association;
- `src/app/(app)/technical-configurations/technical-configuration-baseline-ordinals.ts`
  for a presentation-facing re-export of the existing canonical Roman ordinal
  formatter;
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-subgroup-presentation.test.tsx`
  for focused canonical hierarchy, collapse, keyboard, focus, validation, and
  responsive coverage.

Modify:

- `TechnicalConfigurationBaselineEditor.tsx` only for hierarchy-aware containing
  section lookup;
- `TechnicalConfigurationBaselineGroupSection.tsx` only to mount ordered subgroup
  presentation after direct criteria;
- existing hierarchy regression tests only where direct-flow preservation or the
  canonical accessibility-name contract needs an explicit assertion;
- this OpenSpec `tasks.md` only after all P4B checks pass.

Do not modify production hooks, editor-state mutation helpers, save mappers, RPCs,
migrations, generated database types, or Supabase state.

## TDD Slices

1. RED: a canonical hierarchy fixture must render one main section, its direct
   criterion, one subgroup, and the subgroup criterion in document order.
2. GREEN: add the minimum subgroup presentation components and mount them after direct
   criteria.
3. RED: main-section and subgroup disclosure must collapse independently and respond
   to Enter and Space without losing the other level's state.
4. GREEN: reuse the disclosure hook and accessible Collapsible primitives with stable
   content IDs.
5. RED: subgroup criterion focus must expand its containing structural rows, focus the
   requirement field, and call nearest `scrollIntoView`.
6. GREEN: extend hierarchy focus lookup and add subgroup-local focus handling without
   changing direct-criterion callbacks.
7. RED: subgroup validation must remain associated with its structural row and
   criterion field; pending direct multiline input and definite-height workspace
   classes must remain unchanged.
8. GREEN: wire validation IDs and preserve current direct-workflow props and layout.
9. RED: narrow viewport rendering must avoid fixed-width structural content and no
   P4C, response, or assessment controls may be present.
10. GREEN/REFACTOR: keep responsive min-width constraints, remove duplication, and
    verify every touched source file remains below 450 lines.

Each RED test must be run and observed failing for the intended missing P4B behavior
before the corresponding production edit.

## Verification

Run through context-mode in repository order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-subgroup-presentation.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-group-section.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-hierarchical-editor.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-focus-transitions.test.tsx'
node scripts/npm-run.js exec vitest run 'src/app/(app)/technical-configurations'
node scripts/npm-run.js run react-doctor
openspec validate revise-technical-configuration-baseline-hierarchy --strict
```

Also verify:

- Code Review Graph changed-file impact and affected flows;
- GitNexus changed-symbol impact after reindexing the implemented branch;
- semantic deduplication against existing collapsible hierarchy components;
- touched source-file line counts;
- `mix-gpt-5.6` at `xhigh` reasoning until the reviewer reports zero findings.

## Verification Evidence

- Base and tracking: clean `main` at `fadeb90a`, issue `#888`, branch
  `feat/888-p4b-subgroup-presentation`.
- Initial RED: the focused P4B file reported four intended failures and one passing
  direct multiline-buffer preservation test before production edits.
- Initial GREEN: the focused P4B file passed `5/5`.
- First `mix-gpt-5.6` `xhigh` review found three actionable gaps: canonical ordinal
  labels, narrow-layout overflow, and repeated focus-token auto-expansion.
- Review-fix RED/GREEN: regression tests reproduced all three findings before the
  production fixes; the focused plus adjacent set then passed `49/49`.
- Final-review RED/GREEN: a regression reproduced stale focus-token replay after a
  parent collapse unmounted and remounted a collapsed subgroup; focus-request
  acknowledgement moved to the persistent main-section component, and the focused
  file returned to `5/5`.
- Final module regression: technical-configurations passed `93/93` files and
  `770/770` tests.
- TypeScript gates: `verify:no-explicit-any`, `verify:dedupe`, and `typecheck`
  passed.
- Formatting: all P4B-owned files pass the repository Prettier binary. The broad
  diff-aware `format:check` also sees unrelated unstaged `AGENTS.md` and
  `CLAUDE.md`; those user-owned files remain untouched and excluded from P4B.
- React Doctor: `100/100`, zero issues across the changed React files.
- OpenSpec strict validation: the change is valid.
- Final `mix-gpt-5.6` `xhigh` review: `Zero findings`.
- File size: every changed production source file remains below the 350-line
  extraction threshold; the largest is 334 lines. No changed file exceeds the
  450-line hard ceiling.
- Deduplication: subgroup disclosure reuses
  `useTechnicalConfigurationGroupDisclosure`, while presentation ordinals re-export
  the existing workbook-contract Roman formatter instead of duplicating its
  algorithm.
- Scope audit: no P4C authoring controls, response/assessment controls, migration,
  RPC, generated database type, or live database changes were added.

## Completion Boundary

P4B is ready to report before landing when:

- canonical section/direct/subgroup/subgroup-criterion order is visible;
- main sections and subgroups collapse independently with accessible keyboard
  triggers;
- direct criterion editing, pending multiline buffers, focus, validation, scrolling,
  and responsive behavior remain covered;
- subgroup authoring, response/assessment controls, migrations, and DB writes remain
  absent;
- all required gates and strict OpenSpec validation pass;
- final `mix-gpt-5.6` xhigh review reports zero findings;
- the branch is committed and pushed, but not merged.
