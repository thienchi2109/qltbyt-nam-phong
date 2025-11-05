## Transfer Data Grid RPC Fallback Plan

### Problem
- `/api/transfers/list` and `/api/transfers/counts` now expect the new RPCs `transfer_request_list` and `transfer_request_counts` with expanded filter signatures.
- Production Supabase still exposes the legacy signatures (`transfer_request_list(p_q, p_status, p_page, p_page_size)` and `get_transfer_counts(...)`).
- Result: both API routes forward requests that PostgREST resolves to 404 `PGRST202`, so the React Query hooks render empty tables.

### Constraints & Goals
- Keep the new grid API contract intact so once the SQL migration lands no further changes are needed.
- Avoid breaking current users while waiting for the migration rollout.
- Preserve tenant isolation and filtering semantics as much as possible with legacy RPC responses.

### Proposed Fix
1. **API Route Fallbacks**
   - Wrap each RPC call in a try/catch (or status check) that detects 404 responses with `PGRST202`.
   - When detected, call the legacy RPC (`transfer_request_list` with single-status filter, `get_transfer_counts`) and adapt the payload to the grid response format.
2. **Client-Side Adapters**
   - For the list route: materialize the legacy result set, then apply type/status/date/facility filters and pagination in Node.js before returning JSON `{ data, total, page, pageSize }`.
   - For the counts route: aggregate the filtered list result (reusing the adapter util) to compute per-status totals so status badges remain accurate.
3. **Shared Utility**
   - Extract a small helper to process legacy list items and produce both paginated data and status counts to keep logic in sync between routes.

### Testing Strategy
- Unit-test manually via `npm run dev` with mock data, validating that the grid populates for all three tabs.
- Verify that legacy-only environments no longer emit 404s and badge totals reflect filtered rows.
- Re-run `npm run typecheck` to ensure adapter utilities are strongly typed.

### Rollout Notes
- Once the new Supabase functions are deployed, the fallback branch will stop executing (first call succeeds); no additional feature flags required.
- Remove the fallback path in a future cleanup task after confirming the migration is live in all environments.
