# Transfers Kanban Board - Final Review Findings

**Date:** 2026-01-13
**Branch:** `feature/transfers-kanban-board`
**PR:** #72
**Reviewers:** Code Quality Agent, Security Agent, Performance Agent

---

## Executive Summary

The Transfers Kanban Board implementation is well-architected with proper patterns for virtual scrolling, tenant isolation, and TypeScript typing. However, the final review identified **10 consolidated findings** that should be addressed before or shortly after merge.

| Severity | Count |
|----------|-------|
| Critical (Security) | 2 |
| High (Security) | 1 |
| P1 (Code/Perf) | 5 |
| P2 (Code Quality) | 2 |

---

## Critical Security Issues (Block Merge)

### Finding #1: ILIKE SQL Injection via `p_q` Search Parameter

**File:** `supabase/migrations/20260112_extend_transfer_list_for_kanban.sql`
**Lines:** 133-136, 200-204, 238-243, 296-301
**Severity:** Critical
**Type:** SQL Injection / DoS

#### Description

The search parameter `p_q` is concatenated directly into ILIKE patterns without escaping special characters (`%`, `_`, `\`), allowing pattern injection attacks.

#### Vulnerable Code

```sql
yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
tb.ma_thiet_bi ILIKE '%' || p_q || '%'
```

#### Attack Vectors

```typescript
// Bypass search and return all records
callRpc({ fn: 'transfer_request_list', args: { p_q: '%%%' } })

// Catastrophic backtracking (DoS)
callRpc({ fn: 'transfer_request_list', args: { p_q: '%_%_%_%' } })
```

#### Impact

- Information leakage (bypassing filters)
- DoS via regex catastrophic backtracking
- Performance degradation on large datasets

#### Remediation

```sql
-- Create sanitization function
CREATE OR REPLACE FUNCTION public._sanitize_ilike_pattern(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF input IS NULL OR input = '' THEN
    RETURN NULL;
  END IF;
  -- Escape special characters: % _ \
  RETURN replace(replace(replace(input, '\', '\\'), '%', '\%'), '_', '\_');
END;
$$;

-- Use in queries
AND (
  p_q IS NULL OR p_q = '' OR
  yclc.ma_yeu_cau ILIKE '%' || public._sanitize_ilike_pattern(p_q) || '%' OR
  ...
)
```

---

### Finding #2: Missing Input Validation on Array Parameters

**File:** `supabase/migrations/20260112_extend_transfer_list_for_kanban.sql`
**Lines:** 129-130, 197-198
**Severity:** Critical
**Type:** DoS / Memory Exhaustion

#### Description

Array parameters `p_types` and `p_assignee_ids` are used directly in `ANY()` clauses without validation of array length, allowing memory exhaustion attacks.

#### Vulnerable Code

```sql
AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
```

#### Attack Vector

```typescript
// Massive array attack
callRpc({
  fn: 'transfer_request_list',
  args: {
    p_types: Array(10000).fill('unknown_type'),
    p_assignee_ids: Array(10000).fill(999999)
  }
})
```

#### Impact

- Memory exhaustion
- Query optimizer breakdown
- Database CPU starvation

#### Remediation

```sql
DECLARE
  v_max_array_size INT := 100;
BEGIN
  -- Validate array sizes
  IF p_types IS NOT NULL AND array_length(p_types, 1) > v_max_array_size THEN
    RAISE EXCEPTION 'p_types array exceeds maximum size of %', v_max_array_size;
  END IF;

  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > v_max_array_size THEN
    RAISE EXCEPTION 'p_assignee_ids array exceeds maximum size of %', v_max_array_size;
  END IF;
```

---

## High Severity Issues

### Finding #3: No Rate Limiting on Infinite Scroll

**File:** `src/hooks/useTransfersKanban.ts`
**Lines:** 90-134
**Severity:** High (Security)
**Type:** DoS

#### Description

The `useTransferColumnInfiniteScroll` hook has `maxPages: 10` but no rate limiting. A malicious user can rapidly trigger infinite scroll across all 5 columns simultaneously.

#### Impact

- Backend resource exhaustion
- Database connection pool depletion
- Denial of service for legitimate users

#### Calculation

```
5 columns × 10 pages × 30 items = 1,500 records
Repeated rapidly = potential DoS
```

#### Remediation

```typescript
// Add request throttling
import { useThrottle } from '@/hooks/useThrottle'

export function useTransferColumnInfiniteScroll(...) {
  const throttledFetchNextPage = useThrottle(fetchNextPage, 500) // 500ms between requests
  // ...
}
```

---

## P1 Issues (High Priority)

### Finding #4: Potential Duplicate Items in Merged Data

**File:** `src/hooks/useTransfersKanban.ts`
**Lines:** 153-162
**Priority:** P1
**Type:** Bug

#### Description

`useMergedColumnData` concatenates initial kanban data with infinite scroll pages without deduplication. If a transfer is created/moved during polling, duplicates appear.

#### Problematic Code

```typescript
const additionalTasks = infiniteData.flatMap(page => page.data)
const merged = [...tasks, ...additionalTasks]  // No deduplication
```

#### Impact

- Visual duplicates confuse users
- Memory waste from duplicate objects

#### Remediation

```typescript
const merged = [...tasks]
const existingIds = new Set(tasks.map(t => t.id))
for (const page of infiniteData) {
  for (const task of page.data) {
    if (!existingIds.has(task.id)) {
      merged.push(task)
      existingIds.add(task.id)
    }
  }
}
```

---

### Finding #5: `referenceDate` Causes Full Re-render Every 60 Seconds

**File:** `src/components/transfers/TransfersKanbanView.tsx`
**Lines:** 120-127
**Priority:** P1
**Type:** Performance

#### Description

The `referenceDate` state refreshes every 60 seconds via `setInterval`, causing the entire kanban view and all columns/cards to re-render.

#### Problematic Code

```typescript
const [referenceDate, setReferenceDate] = React.useState(() => new Date())
React.useEffect(() => {
  const interval = setInterval(() => {
    setReferenceDate(new Date())  // Triggers full tree re-render
  }, 60_000)
  return () => clearInterval(interval)
}, [])
```

#### Impact

- All 4-5 columns and 120-150 cards re-render every minute
- Unnecessary CPU usage
- Potential scroll position reset

#### Remediation

```typescript
// Option 1: Use ref instead of state (no re-render)
const referenceDateRef = React.useRef(new Date())
React.useEffect(() => {
  const interval = setInterval(() => {
    referenceDateRef.current = new Date()
    // Only force update cards with ngay_du_kien_tra near boundary
  }, 60_000)
  return () => clearInterval(interval)
}, [])

// Option 2: Move overdue check to individual cards with their own interval
```

---

### Finding #6: `renderActions(task)` Inline Breaks React.memo

**File:** `src/components/transfers/TransfersKanbanColumn.tsx`
**Line:** 116
**Priority:** P1
**Type:** Performance

#### Description

`renderActions(task)` is called inline during render, creating new React elements each time. This breaks the memoization of `TransfersKanbanCard` because the `actions` prop always changes.

#### Problematic Code

```tsx
<TransfersKanbanCard
  transfer={task}
  onClick={onClickTask}
  actions={renderActions(task)}  // New object every render
  referenceDate={referenceDate}
/>
```

#### Impact

- Cards re-render on every parent render
- `React.memo` on `TransfersKanbanCard` is ineffective
- Wasted CPU cycles

#### Remediation

```tsx
// Option 1: Pass render function, call inside card
<TransfersKanbanCard
  transfer={task}
  onClick={onClickTask}
  renderActions={renderActions}  // Stable reference
  referenceDate={referenceDate}
/>

// In TransfersKanbanCard:
const actions = React.useMemo(() => renderActions(transfer), [transfer, renderActions])
```

---

### Finding #7: Missing Covering Index for LATERAL Query

**File:** `supabase/migrations/20260112_extend_transfer_list_for_kanban.sql`
**Lines:** 26-27, 208
**Priority:** P1
**Type:** Performance (SQL)

#### Description

The `idx_yclc_status_created_desc` index on `(trang_thai, created_at DESC)` does not cover the JOIN on `thiet_bi_id`, forcing a table lookup for every row in the LATERAL subquery.

#### Current Index

```sql
CREATE INDEX idx_yclc_status_created_desc
ON public.yeu_cau_luan_chuyen (trang_thai, created_at DESC);
```

#### Impact

- Additional I/O for every row fetched
- Slower query execution with large datasets

#### Remediation

```sql
-- Add covering index that includes thiet_bi_id
CREATE INDEX idx_yclc_kanban_covering
ON public.yeu_cau_luan_chuyen (trang_thai, created_at DESC, thiet_bi_id);

-- Or with INCLUDE for more columns
CREATE INDEX idx_yclc_kanban_covering_full
ON public.yeu_cau_luan_chuyen (trang_thai, created_at DESC)
INCLUDE (thiet_bi_id, id, ma_yeu_cau, loai_hinh);
```

---

### Finding #8: Unused `statusCounts` Prop

**File:** `src/components/transfers/TransfersKanbanView.tsx`
**Lines:** 22, 115
**Priority:** P1
**Type:** Dead Code

#### Description

The `statusCounts` prop is declared in the interface and destructured but never used in the component.

#### Code

```typescript
interface TransfersKanbanViewProps {
  // ...
  statusCounts: TransferStatusCounts | undefined  // Declared
}

export function TransfersKanbanView({
  // ...
  statusCounts,  // Destructured but never referenced
}: TransfersKanbanViewProps)
```

#### Impact

- Misleading API - parent components pass data that's ignored
- Possible incomplete implementation

#### Remediation

Either:
1. Use `statusCounts` for column headers (more accurate than `data.columns[status].total`)
2. Remove the prop entirely if not needed

---

## P2 Issues (Medium Priority)

### Finding #9: `useMergedColumnData` Naming Violation

**File:** `src/hooks/useTransfersKanban.ts`
**Lines:** 140-171
**Priority:** P2
**Type:** Code Quality

#### Description

The function is named `useMergedColumnData` (starts with `use`) but does not call any React hooks internally. It's a pure function. The `use` prefix signals to React's linter and developers that it follows hooks rules.

#### Impact

- Violates React naming conventions
- May confuse developers and linting tools
- ESLint rules-of-hooks may give false positives

#### Remediation

```typescript
// Option 1: Rename to pure function
export function getMergedColumnData(...)

// Option 2: Wrap in useMemo to make it a true hook
export function useMergedColumnData(...) {
  return React.useMemo(() => {
    // ... existing logic
  }, [initialData, infiniteData, isInitialLoading, perColumnLimit])
}
```

---

### Finding #10: Missing Error State Handling

**File:** `src/components/transfers/TransfersKanbanView.tsx`
**Priority:** P2
**Type:** UX / Code Quality

#### Description

The component handles `isLoading` state but does not handle `isError` or `error` states from `useTransfersKanban`. If the RPC call fails, users see no feedback.

#### Current Code

```typescript
const { data, isLoading, isFetching } = useTransfersKanban(...)
// No error handling
```

#### Impact

- Silent failures confuse users
- No way to retry failed requests
- Poor user experience

#### Remediation

```typescript
const { data, isLoading, isFetching, isError, error } = useTransfersKanban(...)

if (isError) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-6 w-6" />
        <p>Lỗi tải dữ liệu: {error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    </div>
  )
}
```

---

## Additional Observations (P3)

These are lower-priority items noted during review:

| Issue | File | Description |
|-------|------|-------------|
| Magic number `3` for scroll threshold | TransfersKanbanColumn.tsx:57 | Extract to named constant |
| Inline style object creates new reference | TransfersKanbanView.tsx:171 | Extract to constant |
| `isOverdue` has unusual epoch check | TransfersKanbanCard.tsx:46 | Use `isNaN()` instead |
| Missing ARIA attributes | TransfersKanbanColumn.tsx | Add `aria-busy`, `aria-live` |
| `JSON.stringify` for filtersKey | TransfersKanbanView.tsx:56 | Consider deterministic serialization |
| ILIKE prevents index usage | SQL migration | Consider `pg_trgm` extension |
| Duplicate filter logic in SQL | SQL migration:113-140, 150-210 | Consider materialized CTE |

---

## Positive Findings

The review also identified several well-implemented patterns:

1. **RPC-Only Architecture** - All database access through `callRpc()` → `/api/rpc/[fn]`
2. **Tenant Isolation** - JWT claims signed by proxy, `p_don_vi` forced for non-global users
3. **Virtual Scrolling** - Correct use of `@tanstack/react-virtual` with dynamic measurement
4. **Ref Pattern for Callbacks** - Using `onLoadMoreRef` to avoid infinite loops in effects
5. **Memoized Components** - `React.memo` on `TransfersKanbanCard`
6. **Zod Runtime Validation** - Proper schema validation on RPC responses
7. **Query Key Factory** - Clean, consistent key structure in `transferKanbanKeys`
8. **TypeScript Typing** - Explicit interfaces, no `any` types
9. **SECURITY DEFINER with search_path** - Prevents function search path hijacking

---

## Remediation Priority

| Priority | Issue | Effort | Recommendation |
|----------|-------|--------|----------------|
| **P0** | #1 ILIKE injection | Medium | Block merge until fixed |
| **P0** | #2 Array validation | Low | Block merge until fixed |
| **P1** | #3 Rate limiting | Medium | Fix in follow-up PR |
| **P1** | #4 Deduplication | Low | Fix in follow-up PR |
| **P1** | #5 referenceDate re-renders | Low | Fix in follow-up PR |
| **P1** | #6 renderActions memo | Low | Fix in follow-up PR |
| **P1** | #7 Covering index | Low | Fix in follow-up PR |
| **P1** | #8 Unused prop | Low | Fix in follow-up PR |
| **P2** | #9 Hook naming | Low | Backlog |
| **P2** | #10 Error handling | Low | Backlog |

---

## Conclusion

The Transfers Kanban Board implementation demonstrates solid architecture and security practices. The **2 Critical security issues** (#1, #2) must be addressed before production deployment. The remaining P1 issues can be addressed in follow-up PRs without blocking the initial merge.

**Recommendation:** Fix Critical issues (#1, #2), then merge. Create follow-up tickets for P1 issues.
