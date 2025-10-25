[ARCHIVED] See `openspec/changes/archive/2025-10-25-refactor-server-status-and-search-filtering-repair-requests/proposal.md`.

### New Requirements
- The system SHALL support multi-select status filtering on the server for Repair Requests.
- The system SHALL keep search (`q`) fully server-side with debounce on the client.
- The system SHALL provide a single RPC to return counts per status for the current filter set (excluding status), respecting tenant/facility/date/search constraints.

### Modified Requirements
- Client SHALL pass `p_statuses TEXT[]` rather than maintaining client-side status column filters.
- Pagination SHALL reflect the result of server-side filters (status, q, facility, date).
- Clear Filters SHALL reset both `p_statuses` and `p_q` and refetch page 1.

### Security Requirements (unchanged)
- Preserve tenant isolation and role rules: global users can access all tenants; non-global users are restricted to allowed facilities; regional_leader remains read-only.
- Regional leaders SHALL only see data from facilities within their assigned region (as determined by `allowed_don_vi_for_session()`), and cannot create/update/delete on this page.
- RPCs MUST be `SECURITY DEFINER` with hardened `search_path` and use `allowed_don_vi_for_session()`.

### Acceptance Criteria
- Given a tenant user with facility F, when they filter by statuses and search, then only results from F are returned and pagination totals match.
- Given a regional_leader with region R (multiple facilities), when they filter/search, then only results from facilities within R are returned; create/update/delete actions are hidden; totals match direct SQL.
- Given a global user, when they set `p_don_vi` or leave it null, then they see results for the selected facility or all facilities respectively.
- When `statuses=["Đã duyệt","Hoàn thành"]` and `q='abc'` and a date range is set, the list and the `repair_request_status_counts` reflect the same filters (counts exclude status as specified) and update in a single request each.
- Status chip selections persist in UI, are reflected in the query key, and survive reload via local persistence.
- Clearing filters resets status selections and search, resets to page 1, and refetches.
- Network payload size reduces compared to client-side status filtering for the same view (sampled).
