# Transfers Kanban Scalability Plan

**Status:** ✅ Phase 0 COMPLETE + Server-Side Architecture IMPLEMENTED (Oct 12, 2025)  
**Decision:** Server-side architecture implemented (supersedes original client-only plan)  

## Implementation Update (October 12, 2025)

**Completed:**
- ✅ **Phase 0:** Collapsible columns, windowing, density toggle, localStorage persistence (Oct 11)
- ✅ **Server-Side Backend:** RPC functions with filtering, pagination, JWT auth (Oct 12, Day 1-2)
- ✅ **Virtualization:** react-window integration with FilterBar (Oct 12, Day 3)
- ✅ **Performance:** All targets met (<500ms load, <100ms filter, 60fps scrolling)

**Remaining Phases (Optional Enhancements):**
- ⏸️ Phase 1: Overview header, saved views (deferred - basic filtering sufficient)
- ⏸️ Phase 2: Advanced virtualization features (deferred - current performance excellent)
- ⏸️ Phase 3: Swimlanes, WIP limits (deferred - not currently needed)
- ⏸️ Phase 4: Stable ranking, A/B testing (deferred - drag-drop not implemented)

**Related Documentation:**
- [Server-Side Architecture Proposal](./kanban-server-side-architecture-proposal.md) - ✅ Implemented
- [Day 3 Implementation Summary](../session-notes/2025-10-12-kanban-day3-implementation-complete.md)
- [Phase 0 Completion](../../.serena/memories/2025-10-11/phase-0-kanban-scalability-complete.md)

## Original Context (For Reference)

- **Original Plan:** Client-only UX improvements (Phase 0-4)
- **Actual Implementation:** Hybrid server-client architecture (superior approach)
- **Goal Achieved:** Kanban scales smoothly with 1000+ items

## Objectives

- Reduce DOM and cognitive load without losing context
- Make narrowing the default (filters/saved views)
- Keep write permissions/role rules intact
- No backend schema/RPC changes; client-only UX improvements

## Non-Goals

- No changes to database schema or RPC functions
- No new roles or permission changes
- No immediate addition of alternative views (DataTable/Timeline/Calendar)

## UX Flow (Fast Path)

1. Open board → Overview header shows totals, WIP alerts, active filters
2. Default Saved View applies: "Mine, last 30 days"
3. Each column renders first 50 items; "Show more" for increments
4. Done/Archive auto-collapsed to header-only with counts

## Design Patterns That Scale

### 1. Overview Header First
- Per-column counts, WIP warnings, "Top filters in effect"
- Gives context before rendering hundreds of cards

### 2. Narrowing by Default
- **Filter bar:** assignee, facility, type, status, date, text
- **Saved Views:** "My work (30 days)", "Urgent", "This week"
- Persist in localStorage

### 3. Swimlanes to Chunk Cognition
- Optional grouping by assignee or priority
- Reduces visual scanning within columns

### 4. Collapse What's Cold
- Auto-collapse Done/Archive to header-only with counts + "Show 50"
- Keeps focus on active work

### 5. Density Modes
- **Compact:** Title + 1–2 badges (default for 100+ items)
- **Rich:** Full card with all details

### 6. Per-Column Pagination + Virtualization
- Window columns by 50; optional virtualization for long lists
- "Show more" loads next 50 incrementally

### 7. Stable Ranking
- Order key that inserts between without mass reindex
- Prevents re-render churn on drag-and-drop

### 8. WIP Limits
- Soft limits per column (e.g., "Doing" ≤ 15) + visual nudge
- Encourages finishing work before starting new

### 9. Performance Guardrails
- Counts first, cards later
- Subscribe only to visible columns
- Thin card payloads (hydrate details on open)

## Component Architecture

### New Components (Client-Side)

```typescript
// src/components/transfers/OverviewHeader.tsx
// Shows counts, WIP alerts, active filters summary

// src/components/transfers/FilterBar.tsx
// Filter controls + Saved Views dropdown

// src/components/transfers/CollapsibleLane.tsx
// Kanban column with header-only mode + count + "Show more"

// src/components/transfers/VirtualColumn.tsx
// Optional: Windowing for very long columns

// src/components/transfers/DensityToggle.tsx
// Switch between compact/rich card display

// src/components/transfers/TransferCard.tsx
// Refactored card with compact/rich modes

// src/components/transfers/SavedViewsDialog.tsx
// Create/edit/delete saved views
```

## State & Persistence

### LocalStorage Keys

```typescript
// View preferences
const STORAGE_KEYS = {
  KANBAN_PREFS: 'transfers-kanban-prefs',
  SAVED_VIEWS: 'transfers-saved-views',
  LANE_COLLAPSED: 'transfers-lane-collapsed',
  DENSITY_MODE: 'transfers-density-mode',
  ACTIVE_VIEW_ID: 'transfers-active-view-id',
} as const;
```

### Type Definitions

```typescript
type Role = 'global' | 'regional_leader' | 'to_qltb' | 'admin' | 'technician' | 'user';
type TransferStatus = 'cho_duyet' | 'da_duyet' | 'dang_luan_chuyen' | 'da_ban_giao' | 'hoan_thanh';

type ViewPrefs = {
  density: 'compact' | 'rich';
  collapsed: Record<TransferStatus, boolean>;
  perColumnLimit: number; // default 50
  swimlane: 'none' | 'assignee' | 'priority';
  savedViewId?: string;
};

type SavedView = {
  id: string;
  name: string;
  filters: {
    assigneeIds?: string[];
    facilityIds?: string[];
    types?: ('noi_bo' | 'thanh_ly' | 'ben_ngoai')[];
    statuses?: TransferStatus[];
    dateFrom?: string; // ISO date
    dateTo?: string;   // ISO date
    text?: string;     // Search term
    onlyMine?: boolean; // Show only my requests
  };
  isDefault?: boolean; // Auto-apply on load
};

type ColumnData = {
  status: TransferStatus;
  items: TransferRequest[];
  visibleCount: number; // How many currently shown
  totalCount: number;   // Total matching filter
  isCollapsed: boolean;
  wipLimit?: number;    // Soft limit
};
```

## Role & Security

### Regional Leader (Read-Only)
- Hide/disable all write actions (Create, Edit, Delete, Approve, etc.)
- Enforce facility/region filtering identical to current rules
- Show appropriate UI messaging for restricted actions
- All state changes are client-side only

### Other Roles
- Unchanged behavior
- Respect existing action handlers and permission checks
- No new APIs or RPC functions required

## Performance

### Rendering Budget
- **Target:** < 500 DOM nodes initially
- **Strategy:** Counts first, cards lazy-loaded

### Optimization Techniques

1. **Counts-First Rendering**
   ```typescript
   // Compute totals from existing data
   const columnCounts = useMemo(() => {
     return KANBAN_COLUMNS.map(col => ({
       status: col.status,
       count: displayedTransfers.filter(t => t.trang_thai === col.status).length
     }));
   }, [displayedTransfers]);
   ```

2. **Column Windowing**
   ```typescript
   // Initial 50 items, then +50 increments
   const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({
     cho_duyet: 50,
     da_duyet: 50,
     dang_luan_chuyen: 50,
     da_ban_giao: 50,
     hoan_thanh: 50,
   });
   ```

3. **Memoization**
   - Memoize filter pipelines
   - Debounce text search (250ms)
   - Cache computed columns

4. **Optional Virtualization**
   - Use `@tanstack/react-virtual` for columns with 100+ items
   - Only render visible cards in viewport

## Testing Strategy

### Test Datasets
- **Empty:** 0 items
- **Small:** 1-10 items
- **Medium:** 10-100 items
- **Large:** 100-500 items
- **XL:** 500-1000 items

### Test Scenarios

1. **Facility Filter Integration**
   - Verify no conflicts with existing facility filter
   - Test with regional_leader role (multiple facilities)
   - Ensure saved views respect facility boundaries

2. **Saved Views Persistence**
   - Create, edit, delete saved views
   - Verify localStorage persistence across reloads
   - Test default view auto-application

3. **Collapsed Lanes**
   - Verify correct counts in collapsed state
   - Test "Show more" pagination
   - Ensure collapse state persists

4. **Role-Based UI**
   - regional_leader: no write actions visible
   - Other roles: correct action buttons per status
   - Permission checks remain enforced

5. **Mobile Responsiveness**
   - Horizontal scroll works smoothly
   - Touch targets remain accessible (44px min)
   - Compact density on small screens

6. **Performance**
   - Initial render < 200ms (desktop, 100 items)
   - "Show more" < 100ms
   - No memory leaks on repeated filter changes

## Phased Implementation

### Phase 0: Quick Wins (2-3 hours)
**Goal:** Immediate relief for large boards

- [ ] Collapsible Done/Archive columns (header-only + counts)
- [ ] Per-column windowing (50 initial + "Show more")
- [ ] Density toggle (compact default)
- [ ] LocalStorage persistence for preferences

**Files to modify:**
- `src/app/(app)/transfers/page.tsx` - Add collapsible state and windowing
- Create `src/components/transfers/CollapsibleLane.tsx`
- Create `src/components/transfers/DensityToggle.tsx`

### Phase 1: Filters & Saved Views (3-4 hours)
**Goal:** Make narrowing the default behavior

- [ ] OverviewHeader component (counts, WIP alerts, filters summary)
- [ ] FilterBar component (assignee, facility, type, status, date, text)
- [ ] Saved Views (create, edit, delete, set default)
- [ ] LocalStorage persistence for saved views

**Files to create:**
- `src/components/transfers/OverviewHeader.tsx`
- `src/components/transfers/FilterBar.tsx`
- `src/components/transfers/SavedViewsDialog.tsx`

### Phase 2: Virtualization (2-3 hours)
**Goal:** Handle 1000+ items smoothly

- [ ] Optional virtualization for columns with 100+ items
- [ ] Realtime subscriptions scoped to visible columns
- [ ] Thin card payloads (details on demand)

**Dependencies:**
- Install `@tanstack/react-virtual`
- Refactor card component for virtualization

### Phase 3: Advanced Features (3-4 hours)
**Goal:** Enhanced workflow management

- [ ] Swimlanes (grouping by assignee or priority)
- [ ] Soft WIP limits with visual cues
- [ ] Drag-and-drop between swimlanes

**Files to create:**
- `src/components/transfers/Swimlane.tsx`
- `src/components/transfers/WIPLimitIndicator.tsx`

### Phase 4: Ranking & Optimization (2-3 hours)
**Goal:** Stable ordering and performance tuning

- [ ] Stable ranking key (insert-between ordering)
- [ ] Performance monitoring (render times, memory)
- [ ] A/B test compact vs rich default density

## Acceptance Criteria

### Performance
- [ ] Initial render < 200ms on 100+ items (desktop)
- [ ] "Show more" loads next 50 without jank
- [ ] No memory leaks on repeated filter operations
- [ ] Smooth scrolling on mobile devices

### Functionality
- [ ] Done/Archive collapsed by default with accurate counts
- [ ] Saved View "Mine, last 30 days" persists across reloads
- [ ] Facility filter integrates seamlessly
- [ ] All existing actions (Approve, Start, Complete, etc.) work correctly

### Security & Roles
- [ ] regional_leader cannot see write actions anywhere
- [ ] Facility/region filtering enforced for regional_leader
- [ ] Other roles have unchanged permissions

### UX
- [ ] Compact density reduces visual clutter significantly
- [ ] Overview header provides instant context
- [ ] Filter bar is intuitive and discoverable
- [ ] Mobile users can navigate board effectively

## Risks & Mitigations

### Risk: Visual Complexity
**Mitigation:** Keep defaults minimal; progressive disclosure for advanced features

### Risk: Over-fetching
**Mitigation:** Thin card model; hydrate details on card open/hover

### Risk: Mobile Overflow
**Mitigation:** Ensure horizontal scroll, compact density default on mobile

### Risk: Breaking Changes
**Mitigation:** All changes are additive; existing functionality preserved

### Risk: localStorage Limits
**Mitigation:** Limit saved views to 10 per user; compress data if needed

## Alternatives Considered (Deferred)

### DataTable View
- **Pros:** Familiar, sortable, filterable
- **Cons:** Loses workflow context, requires new component, duplicates effort
- **Decision:** Revisit if Kanban-first approach is insufficient

### Timeline View
- **Pros:** Good for date-based planning
- **Cons:** Complex implementation, less useful for status-based workflow
- **Decision:** Not a priority

### Calendar View
- **Pros:** Deadline visualization
- **Cons:** Requires date field prominence, less useful for active workflow
- **Decision:** Not a priority

## Migration Path

### Backward Compatibility
- All existing functionality preserved
- No database changes required
- New features are opt-in (can ignore)

### Rollout Strategy
1. Deploy Phase 0 to staging
2. Gather feedback from power users
3. Adjust based on feedback
4. Deploy to production with feature flag
5. Monitor performance metrics
6. Iterate on Phases 1-4 based on usage

## Success Metrics

### Quantitative
- 50% reduction in initial DOM nodes
- 70% reduction in render time for 100+ items
- 90% of users find items within 3 seconds
- Zero permission violations

### Qualitative
- Users report less visual overwhelm
- Regional leaders can navigate multi-facility boards effectively
- No complaints about missing Kanban view
- Positive feedback on compact density

## References

- Existing facility filter: `src/hooks/useFacilityFilter.ts`
- Current Kanban: `src/app/(app)/transfers/page.tsx`
- TanStack Table example: `src/app/(app)/repair-requests/page.tsx`
- Role-based access rules: `.serena/rules/project-rules.md`

## Related Documentation

- [Regional Leader Remaining Tasks](../.serena/memories/2025-10-08/regional-leader-remaining-tasks.md)
- [Facility Filter Consolidation](../.serena/memories/2025-10-08/facility-filter-consolidation.md)

---

**Last Updated:** October 9, 2025  
**Owner:** Development Team  
**Status:** Deferred - Awaiting prioritization
