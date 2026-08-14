# Phase 0 Characterization Baseline

Recorded on 2026-08-14 after the independently deployed Phase 1 readability
change. Categories therefore uses the canonical `46-54` wide-desktop split,
while the legacy Mapping page retains the shared `40-60` split.

No browser screenshots were recorded. Equivalent DOM and interaction baselines
are locked by the focused tests below.

## Categories

- `DeviceQuotaCategoriesPage.test.tsx` covers the page-level authorization,
  toolbar, search, default leaf selection, master-detail selection, and the
  current leaf-only assigned-equipment presentation.
- `DeviceQuotaCategoryTree.test.tsx` covers the canonical `46-54` split,
  stacked narrower layout, category-row semantics, long-name hover/focus
  disclosure, intermediate-node selection, and detail-pane updates.
- `CategoryActionMenu.test.tsx` preserves the deferred dropdown-to-dialog
  regression.

## Manual Mapping

- `DeviceQuotaCategoryTree.test.tsx` under Mapping covers parent and leaf
  categories as valid manual assignment targets.
- `DeviceQuotaMappingPreviewDialog.test.tsx` covers preview rendering,
  exclusions, restore, cancel, and confirmation with only included equipment.
- `DeviceQuotaMappingActions.test.tsx` keeps the preview open during mutation
  and closes it only after success.
- `DeviceQuotaMappingMutations.test.tsx` covers RPC payload, success toast,
  selection reset, invalidation, and destructive error feedback.
- `DeviceQuotaMappingPage.test.tsx` locks the legacy `40-60` desktop layout.

## Facility-Wide Suggestions

- `DeviceQuotaMappingActions.test.tsx` covers the facility-scoped trigger.
- `SuggestedMappingPreviewDialog.test.tsx` covers grouped results, unmatched
  equipment, per-name and whole-group exclusions, role-aware confirmation,
  batch apply, save error, retry, and result counts.
- `useSuggestMapping.test.ts` and `useSuggestMapping.async-jobs.test.ts` cover
  pipeline failure, async retry, batch RPC payloads, and save lifecycle.

## Current Role Matrix

| Role                              | Device Quota module | Mapping | Categories        | Suggested mapping |
| --------------------------------- | ------------------- | ------- | ----------------- | ----------------- |
| `global`, `admin`, `to_qltb`      | Allowed             | Allowed | Allowed           | Preview and apply |
| `regional_leader`                 | Allowed             | Allowed | Hidden/restricted | Preview only      |
| `qltb_khoa`, `technician`, `user` | Denied              | Denied  | Denied            | Denied            |

`regional_leader` is the only current Mapping-only role. The implementation
does not contain a second non-manager role with Mapping access.
