## Why
Remove the Action Hub aside panel from the Repair Requests page to simplify UX and reduce layout/state complexity. The split-pane quick-create duplicated the Sheet form and added layout/persistence overhead with little additional value.

## What Changes
- Remove Action Hub aside (ResizableAside) and the ExpandAsideButton toggle
- Delete aside-related state (viewMode, asideWidth, asideCollapsed) and localStorage keys
- Simplify layout to a single-column content grid
- Keep creation via right-side Sheet (desktop) and FAB (mobile)

## Impact
- Affected specs: repair-requests
- Affected code:
  - src/app/(app)/repair-requests/page.tsx (imports, state, layout, header button)
  - src/app/(app)/repair-requests/_components/ResizableAside.tsx (deleted/emptied)
- No backend or RPC changes; UI-only

## Notes
- Keyboard shortcuts unaffected: "/" (search), "n" (open create sheet)
- Deep-link create via `equipmentId` query param remains supported
