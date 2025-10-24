## Why
The repair SummaryBar on the Dashboard created visual clutter and confusion. These KPIs are better scoped to the Repair Requests page.

## What Changes
- Remove the Repair SummaryBar cards from the Dashboard page.
- Drop related imports and helper component.

## Impact
- Affected code: `src/app/(app)/dashboard/page.tsx`
- No backend/RPC changes, no hooks needed.
