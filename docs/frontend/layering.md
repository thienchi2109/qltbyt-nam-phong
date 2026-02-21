# Frontend Layering Contract

This document is the source of truth for z-index layering across shared UI primitives.

## Goals

- Keep destructive confirmations always visible and actionable.
- Prevent one-off z-index patches from causing cross-feature regressions.
- Make layering changes testable.

## Global Overlay Tiers

Use these tiers for shared primitives:

| Primitive | Overlay | Content | Notes |
|---|---|---|---|
| `Dialog` | `z-[999]` | `z-[1000]` | Base modal layer |
| `DropdownMenu` | n/a | `z-[1001]` | Menu above dialog content |
| `Sheet` | `z-[1002]` | `z-[1002]` | Side panels above dialogs |
| `Popover` | n/a | `z-[1003]` | Popovers above sheets/dialogs |
| `Select` | n/a | `z-[1003]` | Same tier as popover |
| `AlertDialog` | `z-[1100]` | `z-[1101]` | Must be top-most confirmation layer |
| `Tooltip` | n/a | `z-50` | Informational only, not a blocking layer |
| `ToastViewport` | n/a | `z-[100]` | Non-blocking notifications |

## Rules

1. Do not introduce arbitrary `z-[...]` values for overlays without updating this table.
2. If a shared primitive changes z-index, add or update a regression test.
3. Prefer changing shared primitive tiers over per-page z-index hacks.
4. `AlertDialog` must remain above `Dialog` and `Sheet` to avoid blocked confirmations.

## Required Tests

- `src/components/ui/__tests__/alert-dialog-z-index.test.tsx`

When modifying overlay tiers, run:

```bash
npm.cmd run test -- src/components/ui/__tests__/alert-dialog-z-index.test.tsx
```
