1. Establish scope and confirm file locations/line refs
- Repo: D:\qltbyt-nam-phong
- Target feature page: src/app/(app)/repair-requests/page.tsx
- Filter hook: src/lib/filters/useFacilityFilter.ts
- Verify referenced lines exist or map to current equivalents:
  - page.tsx: 332 (getFacilityName may return null), 422–430 (thiet_bi can be null), 1109 (accessorFn), 1261/1278 (table state), 1981/1997 (counts)
  - useFacilityFilter.ts: 142 (filter logic)
- Note any drift and update line numbers in the document accordingly
2. Create issue doc scaffold in project root
- Add file: GITHUB_ISSUE_REPAIR_CRASH.md at D:\qltbyt-nam-phong
- Sections:
  1) Title, Severity (Critical/P0), Summary
  2) Affected Files and Versions
  3) Root Cause Analysis (4 issues)
  4) Detailed Problem Descriptions with code locations
  5) 3-Phase Fix Plan (Immediate, Medium, Long-term)
  6) Code Examples for all proposed fixes
  7) Testing Checklist
  8) Impact Assessment and Risk
  9) Prevention Strategies
  10) Rollout Plan and Owners
- Follow project Response Format Rules for code diffs (changed code only, minimal context, file path headers)
3. Document Root Cause 1 (Null safety in useFacilityFilter.ts L142)
- Problem: Filter compares potentially null/undefined facility names; upstream can return null (page.tsx L332) and thiet_bi can be null (L422–430)
- Symptom: Crash/incorrect filter matching, unstable state when selection includes items with missing facility_name
- Add code locations and minimal repro pathway
- Code example (Before/After, changed lines only):

```ts
// File: src/lib/filters/useFacilityFilter.ts
// Before (L142)
return items.filter((it) => (getName(it) || null) === selectedFacilityName);

// After: normalize to a sentinel to avoid null/undefined traps
const NULL_FACILITY = '__NO_FACILITY__';
const normalizeFacilityName = (name?: string | null): string =>
  typeof name === 'string' && name.trim().length > 0 ? name : NULL_FACILITY;

return items.filter(
  (it) => normalizeFacilityName(getName(it)) === normalizeFacilityName(selectedFacilityName)
);
```

- Note: Ensure filter option list includes a user-facing "Chưa gán đơn vị" mapped to __NO_FACILITY__, preserving UX
4. Document Root Cause 2 (Incorrect count calculations in page.tsx L1981, L1997)
- Problem: Using unfiltered requests instead of tableData/filteredItems causes count mismatch vs displayed rows
- Symptom: Bad totals and status counts after applying filters/search
- Add code locations and observed mismatches
- Code example:

```ts
// File: src/app/(app)/repair-requests/page.tsx
// Before
const totalCount = requests.length;
const urgentCount = requests.filter(r => r.is_urgent).length;

// After: always derive from the same source as table rendering
const totalCount = tableData.length;
const urgentCount = tableData.filter(r => r.is_urgent).length; // use actual predicate
```
5. Document Root Cause 3 (Accessor function null safety in page.tsx L1109)
- Problem: accessorFn can produce "undefined undefined" and may propagate undefined downstream
- Symptom: Rendering anomalies, potential table computation issues
- Code example:

```ts
// File: src/app/(app)/repair-requests/page.tsx
// Before
accessorFn: row => `${row.thiet_bi?.ten_thiet_bi} ${row.mo_ta_su_co}`,

// After: safe join with fallbacks
accessorFn: (row) => {
  const name = row.thiet_bi?.ten_thiet_bi?.trim();
  const desc = row.mo_ta_su_co?.trim();
  if (!name && !desc) return '—';
  if (!name) return desc!;
  if (!desc) return name!;
  return `${name} — ${desc}`;
},
```
6. Document Root Cause 4 (React Table state corruption on data switches in page.tsx L1261, L1278)
- Problem: Swapping between filtered/unfiltered data without resetting table state corrupts selection/pagination/sorting
- Symptom: Rows mismatch, wrong pages, stale selections after filters change
- Code example (choose one or combine):
  - Auto-reset via options:
```ts
// File: src/app/(app)/repair-requests/page.tsx
const table = useReactTable({
  data: tableData,
  columns,
  getCoreRowModel: getCoreRowModel(),
  autoResetPageIndex: true,
  autoResetSorting: true,
  autoResetFilters: true,
  autoResetRowSelection: true,
});
```
  - Or explicit reset on data change:
```ts
useEffect(() => {
  table.resetRowSelection();
  table.resetSorting();
  table.resetColumnFilters();
  table.resetPagination();
}, [tableData, table]);
```
7. Author Phase 1 (Immediate) fixes with concrete code diffs
- Include only changed code per file with minimal context
- Files:
  - src/lib/filters/useFacilityFilter.ts (normalizeFacilityName + filter change)
  - src/app/(app)/repair-requests/page.tsx
    - Counts: replace requests.* with tableData.*
    - AccessorFn: safe string join
    - Table reset: autoReset* options or useEffect reset
- Ensure TypeScript strictness (no any), explicit return types, and @/* import aliases
8. Author Phase 2 (Medium) improvements: ErrorBoundary and validation logging
- Error Boundary (new):
```tsx
// File: src/components/common/ErrorBoundary.tsx
import React from 'react';

type Props = { fallback?: React.ReactNode; children: React.ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // route to monitoring; no console logs in prod
    // reportError(error, info);
  }
  render() { return this.state.hasError ? (this.props.fallback ?? null) : this.props.children; }
}
```
- Wrap repair-requests page content or critical subtrees with ErrorBoundary
- Validation logging for missing facility data (dev-only/no-op in prod):
```ts
// File: src/lib/logging/validation.ts
export const logValidation = (msg: string, ctx?: Record<string, unknown>): void => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug(`[validation] ${msg}`, ctx ?? {});
  }
};
```
- Add a one-time effect on page load to log counts of rows missing thiet_bi/don_vi
9. Author Phase 3 (Long-term): DB constraints and runtime validation
- Add idempotent migration (manual review, do not auto-apply):
```sql
-- File: supabase/migrations/DDMMYYYYHHMM_enforce_thiet_bi_don_vi_not_null.sql
-- Migration: Enforce thiet_bi.don_vi NOT NULL via sentinel assignment
-- Date: [Creation date]
-- Purpose: Prevent null don_vi causing UI/runtime null paths
-- Dependencies: [List prior]
-- MANUAL REVIEW REQUIRED - DO NOT AUTO-APPLY

BEGIN;

-- 1) Create sentinel DON_VI if needed
INSERT INTO don_vi (id, ten_don_vi)
SELECT 'UNASSIGNED_DON_VI', 'Chưa gán đơn vị'
WHERE NOT EXISTS (SELECT 1 FROM don_vi WHERE id = 'UNASSIGNED_DON_VI');

-- 2) Backfill thiet_bi with null don_vi
UPDATE thiet_bi
SET don_vi = 'UNASSIGNED_DON_VI'
WHERE don_vi IS NULL;

-- 3) Enforce NOT NULL
ALTER TABLE thiet_bi
  ALTER COLUMN don_vi SET NOT NULL;

COMMIT;
```
- Add runtime validation (no any) for incoming rows:
```ts
// File: src/types/repair.ts
import { z } from 'zod';

export const EquipmentSchema = z.object({
  id: z.string(),
  ten_thiet_bi: z.string().optional(),
  don_vi: z.string().nullable(),
});

export const RepairRequestSchema = z.object({
  id: z.string(),
  mo_ta_su_co: z.string().nullable().optional(),
  thiet_bi: EquipmentSchema.nullable().optional(),
});

export type RepairRequest = z.infer<typeof RepairRequestSchema>;
```
- Validate data at fetch boundary and map null/undefined facility to sentinel before UI usage
10. Compose Detailed Problem Descriptions per issue
- For each issue, include:
  - Symptom and how it manifests on Repair Requests page
  - Exact code locations (file, line)
  - Why it fails (null handling, stale state, wrong source of truth)
  - Evidence references (lines 332, 422–430, etc.)
  - Security and role impact: Confirm no role permissions altered
11. Add Testing Checklist
- Unit tests (src/lib/__tests__/):
  - useFacilityFilter.test.ts: normalization and filter behavior with null/undefined/empty strings and sentinel
- Component/integration tests:
  - page.counts.test.tsx: counts reflect tableData after filters/search
  - page.accessor.test.tsx: accessorFn never emits "undefined"; renders fallback
  - page.state-reset.test.tsx: table resets selection/sorting/pagination when data changes
- Role-based UI tests:
  - regional_leader remains read-only; no write actions shown
  - tenant isolation preserved in displayed data
- Negative tests: missing thiet_bi/don_vi doesn’t crash; ErrorBoundary catches render faults
- Run npm run typecheck and npm run lint; ensure zero errors
12. Add Impact Assessment, Risks, and Affected Files
- Impact: Critical/P0; affects all users navigating Repair Requests
- Risks: Minor UX change adding "Chưa gán đơn vị" filter option; table resets might clear pagination/selection on data change
- Mitigations: Auto-reset behaviors aligned with React Table; comprehensive tests
- Affected files:
  - src/app/(app)/repair-requests/page.tsx
  - src/lib/filters/useFacilityFilter.ts
  - src/components/common/ErrorBoundary.tsx (new)
  - src/lib/logging/validation.ts (new)
  - src/types/repair.ts (new/updated)
  - supabase/migrations/DDMMYYYYHHMM_enforce_thiet_bi_don_vi_not_null.sql (new; manual)
  - tests in src/lib/__tests__/ and component tests
13. Write Prevention Strategies
- Enforce NOT NULL at DB and sentinel mapping at fetch boundary
- Standardize normalize* utilities for optional strings and IDs
- Add autoReset* defaults for all React Table instances
- Mandate unit tests whenever filters or counts are introduced/changed
- Adopt runtime validation (zod) for all critical UI data shapes
14. Finalize and save GITHUB_ISSUE_REPAIR_CRASH.md
- Populate all sections with concise, actionable content and diffs
- Ensure code blocks follow internal import alias rules and TypeScript strict mode
- Save file at: D:\qltbyt-nam-phong\GITHUB_ISSUE_REPAIR_CRASH.md
15. Review, assign, and link tasks
- Add Owners/Assignees and labels (bug, P0, frontend, db-migration)
- Include task checklist:
  - [ ] Phase 1 fixes
  - [ ] Tests added/updated
  - [ ] Phase 2 components/logging
  - [ ] Phase 3 migration PR (MANUAL REVIEW ONLY)
  - [ ] QA sign-off (multi-tenant and regional_leader read-only)
- Reference this issue in follow-up PRs