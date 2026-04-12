## Why
Repair requests currently do not store repair cost, so maintenance reports and exports cannot answer basic cost questions by time, facility, or equipment.

GitHub Issue #237 asks for an MVP that stores repair cost on `yeu_cau_sua_chua` and exposes it to statistics. Product clarification: the cost is optional, collected when the user is about to mark a request `Hoàn thành`, and blank cost means unknown (`NULL`), not zero.

## What Changes
- Add nullable `chi_phi_sua_chua numeric(14,2)` on `public.yeu_cau_sua_chua` with default `0` for future omitted inserts while leaving existing rows `NULL`.
- Extend `repair_request_complete` to accept optional `p_chi_phi_sua_chua` for the `Hoàn thành` path.
- Keep create, update, and approve dialogs free of the cost field.
- Show optional "Tổng chi phí sửa chữa" in the completion dialog as a friendly recommendation for reporting and analysis.
- Expose cost fields and aggregates in repair list/detail/report/export flows.
- Preserve existing RPC security patterns: JWT guards, tenant scoping, role restrictions, `SECURITY DEFINER`, and `SET search_path = public, pg_temp`.

## Impact
- Affected specs: `repair-request-cost-statistics` (new capability).
- Affected code:
  - Supabase migration for repair request schema and RPC bodies.
  - Repair request completion dialog, context mutation, and detail display.
  - Maintenance report hooks/UI and export sheet utilities.
- Testing:
  - SQL smoke tests for schema, completion write contract, terminal lock, tenant/security guards, and report aggregates.
  - Vitest coverage for cost parsing, completion dialog payloads, detail display, reports, and export output.
