# Issue Template: Transfers Kanban Scalability Improvements

**Use this template to create a tracking issue in your issue tracker (GitHub, GitLab, Jira, etc.)**

---

## Title
Transfers Kanban scalability improvements (Deferred)

## Labels
`enhancement`, `performance`, `UX`, `deferred`, `transfers`

## Priority
Medium (UX improvement)

## Description

### Problem Statement
The transfers Kanban board doesn't scale well with 100+ transfer requests. Users experience:
- Visual overwhelm (hundreds of cards rendered)
- Slow initial render times
- Difficulty finding specific transfers
- Mobile scroll issues

### Proposed Solution
Optimize the existing Kanban board instead of adding alternative views (DataTable). This preserves the "at-a-glance" workflow visualization while handling large volumes efficiently.

**Documentation:** [docs/transfers-kanban-scalability-plan.md](./transfers-kanban-scalability-plan.md)

### Key Features
- ✅ Collapsible Done/Archive columns (header-only + counts)
- ✅ Per-column windowing (50 items + "Show more")
- ✅ Density toggle (compact vs rich)
- ✅ Saved views with filters
- ✅ Overview header (counts, WIP alerts)
- ✅ LocalStorage persistence

## Implementation Phases

### Phase 0: Quick Wins (2-3 hours) ⚡
**Goal:** Immediate relief for large boards

- [ ] Collapsible Done/Archive columns
- [ ] Per-column windowing (50 initial + "Show more")
- [ ] Density toggle (compact default)
- [ ] LocalStorage persistence for preferences

**Files:**
- `src/app/(app)/transfers/page.tsx`
- `src/components/transfers/CollapsibleLane.tsx` (new)
- `src/components/transfers/DensityToggle.tsx` (new)

### Phase 1: Filters & Saved Views (3-4 hours)
**Goal:** Make narrowing the default behavior

- [ ] OverviewHeader component
- [ ] FilterBar component
- [ ] Saved Views (create, edit, delete, set default)
- [ ] LocalStorage persistence for saved views

**Files:**
- `src/components/transfers/OverviewHeader.tsx` (new)
- `src/components/transfers/FilterBar.tsx` (new)
- `src/components/transfers/SavedViewsDialog.tsx` (new)

### Phase 2: Virtualization (2-3 hours)
**Goal:** Handle 1000+ items smoothly

- [ ] Optional virtualization for columns with 100+ items
- [ ] Realtime subscriptions scoped to visible columns
- [ ] Thin card payloads (details on demand)

**Dependencies:**
- Install `@tanstack/react-virtual`

### Phase 3: Advanced Features (3-4 hours)
**Goal:** Enhanced workflow management

- [ ] Swimlanes (grouping by assignee or priority)
- [ ] Soft WIP limits with visual cues
- [ ] Drag-and-drop between swimlanes

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
- [ ] All existing actions work correctly

### Security & Roles
- [ ] regional_leader cannot see write actions anywhere
- [ ] Facility/region filtering enforced for regional_leader
- [ ] Other roles have unchanged permissions

### UX
- [ ] Compact density reduces visual clutter significantly
- [ ] Overview header provides instant context
- [ ] Filter bar is intuitive and discoverable
- [ ] Mobile users can navigate board effectively

## Technical Details

### Test Datasets
- Empty: 0 items
- Small: 1-10 items
- Medium: 10-100 items
- Large: 100-500 items
- XL: 500-1000 items

### Browser Support
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile Safari & Chrome

### Performance Targets
- Initial render: < 200ms (100 items)
- "Show more": < 100ms
- DOM nodes: < 500 initially
- Memory: No leaks on repeated operations

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

## Related Issues
- Regional Leader Feature Implementation #[issue-number]
- Facility Filter Consolidation #[issue-number]

## Related Documentation
- [Transfers Kanban Scalability Plan](./transfers-kanban-scalability-plan.md)
- [Regional Leader Remaining Tasks](../.serena/memories/2025-10-08/regional-leader-remaining-tasks.md)
- [Facility Filter Hook](../src/hooks/useFacilityFilter.ts)

## Notes

### Why Not DataTable?
- Loses workflow context and "at-a-glance" benefit
- Requires building entire new component
- Duplicates effort
- Users prefer visual workflow management
- Kanban can scale to 1000+ items with proper optimizations

### Alternatives Considered
- DataTable view toggle - Deferred
- Timeline view - Not a priority
- Calendar view - Not a priority

---

**Created:** October 9, 2025  
**Status:** Deferred - Awaiting prioritization  
**Estimated Total Effort:** 10-15 hours (all phases)
