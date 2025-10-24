## Why
Two clear filters controls created confusion and did not reset facility, causing partial results. We need a single clear action that reliably shows all results while respecting tenant/regional permissions.

## What Changes
- Hide chips-level "Xóa tất cả"; keep a single toolbar "Xóa".
- Clear now resets status, date range, search term, table filters, and facility to "Tất cả" when visible.

## Impact
- src/app/(app)/repair-requests/_components/FilterChips.tsx
- src/app/(app)/repair-requests/page.tsx
- No backend changes.