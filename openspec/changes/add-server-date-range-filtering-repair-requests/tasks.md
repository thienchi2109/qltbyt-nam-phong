## 1. Implementation
- [ ] RPC: Modify `repair_request_list(p_q text, p_status text, p_page int, p_page_size int, p_don_vi int)` to also accept `p_date_from date DEFAULT NULL`, `p_date_to date DEFAULT NULL`.
  - [ ] Apply filter: `WHERE (p_date_from IS NULL OR date(ngay_yeu_cau AT TIME ZONE 'Asia/Ho_Chi_Minh') >= p_date_from)
        AND (p_date_to IS NULL OR date(ngay_yeu_cau AT TIME ZONE 'Asia/Ho_Chi_Minh') <= p_date_to)` in addition to existing predicates and facility scoping.
  - [ ] Keep pagination/total semantics unchanged.
  - [ ] Consider index: expression index on `date(ngay_yeu_cau AT TIME ZONE 'Asia/Ho_Chi_Minh')` if needed.
- [ ] API proxy: allow `p_date_from`, `p_date_to` to pass through; no security changes (proxy already enforces role/tenant scoping).
- [ ] Client: `repair-requests/page.tsx`
  - [ ] Add `date_from`/`date_to` to TanStack Query `queryKey`.
  - [ ] Pass `p_date_from`, `p_date_to` in `callRpc` args derived from `uiFilters.dateRange` (YYYY-MM-DD strings).
  - [ ] Reset behavior: Clear filters should null out both and refetch.
  - [ ] Deep link: support `?from=YYYY-MM-DD&to=YYYY-MM-DD` (optional) to preapply.
- [ ] QA checklist
  - [ ] From-only, To-only, both, and none return expected results.
  - [ ] Works with facility scoping for global/regional leaders and tenant users.
  - [ ] Pagination totals correct under date filters.
  - [ ] Typecheck + lint pass.

## 2. Rollout
- [ ] Backward-compatible: new RPC params are optional with defaults.
- [ ] No migration needed for clients; deploy RPC first, then UI.
