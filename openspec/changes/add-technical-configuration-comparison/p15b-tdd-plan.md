# P15B TDD Plan - Active Dossier Metadata Editing

> **For agentic workers:** Execute test-first with
> `superpowers:test-driven-development`, `karpathy-coding-heuristics`,
> `next-best-practices`, `vercel-react-best-practices` and
> `code-deduplication`. This leaf is independent of P15A and must not import,
> expose or conditionally depend on the dormant delete contract.

## Goal

Allow `admin/global` users to edit the device type, dossier name and description
of an active dossier through the existing
`technical_configuration_dossiers_update` RPC. Reuse one form contract for
create/edit and introduce a row-action ownership seam that P15C can extend
without growing `TechnicalConfigurationsClient.tsx` into a state-heavy module.

**Tracking issue:** [#863](https://github.com/thienchi2109/qltbyt-nam-phong/issues/863)

## Preconditions

- P3A is merged and verified on `main`.
- The execution branch starts from clean, synchronized `main`.
- Current file sizes and row/table ownership are rechecked before editing.
- Code Review Graph and GitNexus confirm the callers of
  `TechnicalConfigurationDossierForm`,
  `TechnicalConfigurationDossierTable` and the dossier query root.

## Frozen Product Contract

- Editable fields: `device_type_name`, `name`, `description`.
- The edit form is prefilled from the selected active dossier.
- Opening, typing and cancelling do not call the backend.
- Explicit save sends the current dossier revision exactly once.
- Success adopts the returned dossier and new revision in list/detail state.
- `stale_revision`, validation and network errors keep the form open and show a
  retryable error without discarding user input.
- Metadata remains editable after a baseline is locked because it is outside the
  immutable baseline aggregate.
- Archived dossier rejection remains authoritative at the existing RPC guard.
- No archive UI, delete affordance, delete type, delete adapter or P15A
  `can_delete` dependency belongs to this leaf.

## Planned Files

- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierRowActions.tsx`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDossierActions.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-rpc.ts`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierForm.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierTable.tsx`
- Modify:
  `src/app/(app)/technical-configurations/TechnicalConfigurationsClient.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-rpc.test.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-form.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-shell.test.tsx`

## Chunk 1: RED - Typed Update Adapter

- [ ] Add adapter tests for
      `updateTechnicalConfigurationDossier(args, signal?)`.
- [ ] Require the exact RPC name and body fields:
      `p_id`, `p_device_type_name`, `p_name`, `p_description`,
      `p_expected_revision`.
- [ ] Reuse the existing typed error path and prove
      status/code/message/details/hint preservation for `stale_revision`.
- [ ] Run:
      `rtk node scripts/npm-run.js run test -- 'src/app/(app)/technical-configurations/__tests__/technical-configuration-rpc.test.ts'`.
- [ ] Confirm RED because the update adapter is missing.
- [ ] Add the minimal adapter without changing shared `callRpc()`.
- [ ] Rerun and confirm GREEN.

## Chunk 2: RED/GREEN - Generalize The Dossier Form

- [ ] Add form tests for create defaults and edit prefill.
- [ ] Prove opening/editing/cancelling causes no mutation.
- [ ] Prove edit submit maps all three fields plus ID/current revision.
- [ ] Prove validation, pending state, error display and retry preserve values.
- [ ] Generalize the existing component with explicit create/edit inputs and
      labels while keeping one Zod schema and one field tree.
- [ ] Reset the form only when opening a new create/edit target; do not erase an
      in-progress retry state due to unrelated parent renders.
- [ ] Run:
      `rtk node scripts/npm-run.js run test -- 'src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-form.test.tsx'`.

## Chunk 3: RED/GREEN - Row Action And Mutation Ownership

- [ ] Add shell tests that open an edit action from the intended dossier row,
      never from another row.
- [ ] Add tests for cancel, success, pending lock, API error and stale revision.
- [ ] Create one icon/menu row-action component with accessible labels and
      tooltips consistent with the existing UI system.
- [ ] Create an action-state hook that owns selected edit target, dialog state,
      update mutation and success/error transitions.
- [ ] Keep `TechnicalConfigurationsClient.tsx` focused on page/query/workspace
      orchestration. Recheck the 350-line extraction threshold after integration.
- [ ] On success: - update the matching item in the dossier-list cache - update the selected/open dossier when IDs match - preserve current page and workspace - invalidate only the dossier query root needed for reconciliation
- [ ] Do not introduce optimistic metadata values before server success.
- [ ] Run:
      `rtk node scripts/npm-run.js run test -- 'src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-shell.test.tsx'`.

## Chunk 4: Refactor And Gate

- [ ] Run `code-deduplication` against existing row-action hooks, side-sheet
      forms and query-cache update patterns before keeping new helpers.
- [ ] Verify P15B imports no delete RPC manifest, delete adapter or
      `can_delete`.
- [ ] Verify baseline lock does not disable edit metadata in UI tests.
- [ ] Run in repository order through one context-mode batch.

  ```bash
  rtk node scripts/npm-run.js run format:check
  rtk node scripts/npm-run.js run verify:no-explicit-any
  rtk node scripts/npm-run.js run verify:dedupe
  rtk node scripts/npm-run.js run typecheck
  # Run the three focused Vitest files above.
  rtk node scripts/npm-run.js run react-doctor
  rtk openspec validate add-technical-configuration-comparison --strict
  ```

- [ ] Run browser verification at desktop and narrow widths for row action,
      side sheet, validation and no-overlap behavior.
- [ ] Request code review, triage findings and rerun affected gates.

## Exit Gate

P15B is independently deployable when active metadata edit is complete and
revision-safe, the create workflow remains green and no hard-delete surface is
reachable. P15C may reuse the row-action seam but must not be folded into this
leaf.
