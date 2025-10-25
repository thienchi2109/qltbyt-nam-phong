## ADDED Requirements (Archived)

- Server-side date range filtering for Repair Requests by `ngay_yeu_cau`.
- Inclusive range using half-open bounds with VN timezone.
- Preserves facility scoping and role-based access.

See original in: `openspec/changes/add-server-date-range-filtering-repair-requests/specs/repair-requests/spec.md` (copied below).

---

## Specification

The system SHALL support server-side date range filtering for Repair Requests by request date (`ngay_yeu_cau`).

- Both: `p_date_from` and `p_date_to` provided → include rows where date within range (inclusive).
- From only: include rows where `date(ngay_yeu_cau) >= p_date_from`.
- To only: include rows where `date(ngay_yeu_cau) <= p_date_to`.
- No params: no date filter.
- Tenant/regional scoping preserved for all queries.
