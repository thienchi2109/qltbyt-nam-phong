# Phase 4 Integration Evidence

## Checkpoint

- Phase base: `fd13c53c6085fc9fd1da35abb000a8b651a62d45`
- Scope: integration, concurrency, cache lifecycle, request counts, and related
  regressions only
- Live database writes: none
- Deployment: none

## Integration Matrix

| Task | Evidence                                                                                                                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | Page-level user events confirm a leaf unlink, show success feedback, remove the row, and change the visible count from `1/4` to `0/4`.                                                                                                                                             |
| 4.2  | Parent-category integration proves the intermediate parent's direct count changes from `2` to `1` and the distinct root aggregate changes from `4` to `3`, without a double decrement.                                                                                             |
| 4.3  | An affected-zero concurrency case removes the stale selected-category row while preserving the same equipment in the concurrently moved category cache.                                                                                                                            |
| 4.4  | The leaf fixture has minimum `1`; unlink succeeds and leaves cached current count `0`.                                                                                                                                                                                             |
| 4.5  | Leaf flow: one category-list read, one assigned-equipment read, one unlink mutation, zero immediate post-mutation reads. Parent flow: one category-list read, two assigned-equipment reads for two deliberate selections, one unlink mutation, zero immediate post-mutation reads. |
| 4.6  | The existing delayed pre-mutation read test proves cancellation prevents stale assigned/category/unassigned responses from overwriting the confirmed patch.                                                                                                                        |
| 4.7  | An invalidated inactive unassigned-equipment query performs no immediate read, then refetches exactly once when the real `useDeviceQuotaManualMappingEquipment` consumer remounts.                                                                                                 |
| 4.8  | Focused matrix passed: 14 test files, 144 tests. It includes manual assignment, category aggregation, assigned equipment, role matrix, hardened RPC source contract, and RPC whitelist coverage.                                                                                   |
| 4.9  | Focused RPC mocks show no duplicate or repetitive calls on the unlink critical path. The only extra assigned-equipment read in the parent test is caused by the explicit leaf-to-parent selection change before confirmation.                                                      |

## Regression Finding

`DeviceQuotaCategoryTree.test.tsx` failed after Phase 3 because the tree now consumes
the unassignment hook, which requires a Query Client. The isolated tree tests now
mock that hook and are split into layout, aggregation, and interaction suites below
the 450-line source ceiling. Together they preserve the original boundary and pass
25 of 25 tests.

## Performance Result

The confirmed unlink path remains cache-first: one required mutation, deterministic
cache writes, stale marking with no immediate refetch, and lifecycle-driven reads
only when a stale consumer later mounts.
