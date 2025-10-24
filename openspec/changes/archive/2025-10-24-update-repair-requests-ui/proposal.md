## Why
Improve ergonomics and clarity of the Repair Requests page without backend/schema changes. Current UI mixes creation and management and lacks modern filtering, table ergonomics, and an efficient desktop detail experience.

## What Changes
- Filters: Add FilterChips under search and a FilterModal (status, facility when permitted, date range) with local persistence.
- Table ergonomics: Column-visibility presets (Compact/Standard/Full), density and text-wrap toggles with persistence.
- Sticky leading columns: Keep first two columns visible during horizontal scroll; align headers.
- SLA cues: Subtle left-border stripe for nearing/overdue desired dates on non-completed rows.
- Shortcuts: “/” focus search, “n” new request (if permitted), “Enter” open details.
- Details: Desktop uses right slide-over Sheet; mobile retains Dialog.
- Optional: Saved filter sets per user.
- Dashboard: Reuse SummaryBar for repair KPIs with click-through filter navigation.

Non-Goals / Removals
- CSV/XLSX export is explicitly out of scope.
- Desktop view-mode toggle and auto-collapse behavior are removed; keep current split with manual collapse only.

Constraints
- RPC-only data access via `/api/rpc/[fn]` and `callRpc`; no direct table access (see CLAUDE.md).
- Enforce multi-tenant isolation; never trust client-provided `p_don_vi` for non-global/regional roles.
- TypeScript strict; no `any`; adhere to project import/style conventions.

## Impact
- Affected specs: repair-requests
- Affected code:
  - src/app/(app)/repair-requests/page.tsx
  - src/app/(app)/repair-requests/_components/FilterChips.tsx (new)
  - src/app/(app)/repair-requests/_components/FilterModal.tsx (new)
  - src/lib/rr-prefs.ts (new)
  - src/components/summary/summary-bar.tsx (reused, no change)
  - src/app/(app)/dashboard/* (KPI reuse)
- No database changes; no new environment variables.
