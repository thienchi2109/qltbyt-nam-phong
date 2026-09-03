## Phase 0 Characterization And Coordination

Date: 2026-09-02

### Scope

Phase 0 is limited to characterization, coordination, and test-harness
decisions. No runtime presentation code, API, database, migration, mobile
behavior, business rule, or issue `#982` implementation was changed.

Automated UI interactions use `@testing-library/user-event`. No browser,
Playwright, or browser-viewport test was run for this phase. Visual viewport
review is recorded as a manual/equivalent evidence item for a later phase.

### Documents Re-read

- Current proposal: `proposal.md`
- Current design: `design.md`
- Current tasks: `tasks.md`
- Current capability spec:
  `specs/device-quota-category-workspace/spec.md`
- Parent proposal, design, tasks, and capability spec:
  `../add-device-quota-draft-catalog/`
- Resolved Wayfinder decision: issue `#984`
- Initiative map: issue `#983`

Note: neither change stores a root-level `spec.md`; the canonical OpenSpec
specification is under `specs/device-quota-category-workspace/spec.md`.

### Baseline

- Branch started from `main`.
- Baseline commit: `8621060ccf97a9b5fda4f9151fc7ef69ed7b8f64`.
- `HEAD` and `origin/main` matched at baseline.
- The baseline contains the parent draft-catalog runtime and focused tests,
  including the current editor, item row, section, hook, mutation, mapper,
  query, and disclosure modules.
- PR `#985` is documentation-only and landed the current polish proposal
  artifacts; it did not change runtime presentation code.

### Existing Behavior Characterization

Evidence source:
`src/app/(app)/device-quota/categories/draft-catalog/__tests__/DeviceQuotaDraftCatalogEditor.test.tsx`
and the focused hook suites under
`src/app/(app)/device-quota/categories/_hooks/__tests__/`.

| Behavior               | Current contract characterized                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save                   | Ordinary field edits call the existing staged update callback; Save remains a separate action and is disabled when clean or invalid.                                    |
| Pending locks          | Save, field writes, exclude, and restore controls are disabled while save, exclude, restore, or recovery is pending.                                                    |
| Validation             | Negative and fractional quantities expose the existing validation message and block Save.                                                                               |
| Read-only              | Read-only mode hides mutation controls and editable fields and does not leave orphaned labels.                                                                          |
| Section navigation     | Five sections and 42 source-ordered rows render; section selection calls `scrollIntoView`; section collapse hides children without changing source order.               |
| Source/rule disclosure | Source appendix/page/order/level/parent metadata remains visible; complete multiline rules are behind the existing disclosure control.                                  |
| Exclusion              | Exclude invokes the existing immediate mutation callback and excluded rows remain visible in place.                                                                     |
| Restoration            | Restore invokes the existing immediate mutation callback for an excluded row.                                                                                           |
| Stale conflict         | Hook tests cover captured revision use, conflict reporting without replacing local staged values, recovery refetch, recovery locking, and failed-recovery preservation. |

The editor interaction assertions now use `userEvent.setup()` for section
navigation, rule disclosure, field editing, save, exclude, restore, and retry.
The hook suites remain the source of truth for mutation locking and stale
recovery semantics.

### Snapshot And Revision Preservation

The user-facing technical metadata row is still present at this baseline; its
removal belongs to Phase 1. Internal values are confirmed separately:

- `useDeviceQuotaDraftCatalog` retains `localRevision`, derives `revision`, and
  passes `expectedRevision` to save, exclude, and restore mutations.
- The same hook exposes `metadata.snapshotMarker` and `metadata.revision` for
  the current editor composition.
- Existing focused tests assert save uses the captured revision and stale
  conflict recovery reloads the latest draft snapshot.

Therefore Phase 1 may remove only the user-facing metadata presentation after
adding an assertion that the internal save/conflict path is still intact.

### Issue #982 Coordination

Issue `#982` remains open and owns the React complexity refactor for:

- `src/app/(app)/device-quota/categories/_hooks/useDeviceQuotaDraftCatalog.ts`
- `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogItemRow.tsx`

The polish change also owns presentation work in the item row and may touch
the editor/section/shared hierarchical-editor boundaries. The landing order is:

1. Establish this characterization baseline from `8621060c`.
2. Land issue `#982`'s behavior-preserving hook/item-row refactor first if it
   is ready before Phase 1 runtime work.
3. Rebase this change onto the exact `#982` merge commit before the first
   presentation commit that touches an overlapping file.
4. Keep `#982` complexity acceptance criteria, hook restructuring, and
   unrelated maintainability cleanup out of this change.

If polish runtime work must land first, the `#982` branch must instead rebase
onto the polish merge commit. No implementation file is being silently shared
between the scopes.

### Visual Baseline Status

No browser harness or screenshot capture was used in Phase 0, per the updated
decision. The requested viewport targets remain:

- `1024px`
- `1280x720`
- `1366x768`
- `1440x900`

They are a later manual/equivalent visual-review obligation, not an automated
browser test. Automated interaction coverage is the `user-event` focused suite.

### Phase 0 Exit Criteria

- Documents and parent change re-read: complete.
- Exact baseline recorded: complete.
- Issue `#982` overlap and rebase order recorded: complete.
- Existing save, pending, validation, read-only, navigation, disclosure,
  exclusion, restoration, and stale-conflict behavior characterized: complete.
- Snapshot/revision internal preservation recorded: complete.
- No runtime presentation source changed: complete.
- Visual viewport capture: intentionally not performed; gap recorded above.

Phase 0 is ready for review. Phase 1 must not start until this evidence and the
explicit `#982` coordination point are accepted.
