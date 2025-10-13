# Kanban Architecture Decision - Server-Side Approved

**Date:** October 12, 2025  
**Decision:** Server-Side Hybrid Architecture (Option B)  
**Constraint Change:** Backend changes NOW ALLOWED  

## Key Decision Points

### Why Server-Side Wins
1. **Performance:** 80-90% improvement across all metrics
2. **Effort:** 10-12 hours (vs 15-20 hours client-side)
3. **Industry Standard:** How Jira, Trello, Asana, Linear do it
4. **Mobile:** 80% less memory usage (50-80MB vs 200-500MB)
5. **Scalability:** Handles 10,000+ items easily
6. **Security:** Backend enforces permissions properly
7. **Maintainability:** Cleaner code, simpler logic

### Phase 0 Investment
**NOT WASTED!** 70% reusable:
- ✅ CollapsibleLane.tsx - Keep
- ✅ DensityToggle.tsx - Keep
- ✅ TransferCard.tsx - Keep
- ✅ kanban-preferences.ts - Keep
- ❌ Client filtering - Remove (move to server)
- ❌ Windowing - Remove (replace with virtualization)

## Architecture Summary

### Backend Layer (Supabase PostgreSQL)
- New RPC function: `get_transfers_kanban()`
- Server-side filtering (6 criteria)
- Cursor-based pagination
- Full-text search with tsvector
- Proper indexes for performance
- Tenant isolation enforcement

### API Layer (Next.js)
- Route: `/api/transfers/kanban`
- Orchestrates RPC calls
- Groups results by status
- Returns paginated data (50-100 items)

### Client Layer
- TanStack Query for data fetching
- react-window for virtualization
- Keep Phase 0 UI components
- Minimal client-side logic

## Implementation Plan (10-12 hours)

### Day 1 (2.5 hours) - Backend
- Create RPC function `get_transfers_kanban()`
- Add database indexes (3 composite indexes)
- Test queries with EXPLAIN ANALYZE
- Update RPC proxy whitelist

### Day 2 (3 hours) - API Routes
- Create `/api/transfers/kanban/route.ts`
- Create `/api/transfers/counts/route.ts`
- Implement TanStack Query hook
- Add error handling

### Day 3 (2 hours) - Virtualization
- Install react-window + auto-sizer
- Create VirtualizedKanbanColumn component
- Refactor transfers page
- Integrate with existing components

### Day 4 (2.5 hours) - Testing
- Feature flag setup (A/B testing)
- Performance benchmarks
- Bug fixes
- Documentation

## Success Metrics

### Performance Targets
- Initial load: <500ms (100 items)
- Filter response: <100ms
- Memory usage: <100MB on mobile
- Scroll FPS: 60fps
- Browser crashes: Zero

### User Experience
- Regional leaders: Fast read-only views
- Facility managers: Responsive mobile editing
- All roles: Smooth interactions

## Documentation Created
1. `kanban-server-side-architecture-proposal.md` - Full technical proposal
2. `kanban-architecture-decision.md` - Decision matrix and comparison

## Next Action
Start Day 1 (Backend changes) immediately after approval.
