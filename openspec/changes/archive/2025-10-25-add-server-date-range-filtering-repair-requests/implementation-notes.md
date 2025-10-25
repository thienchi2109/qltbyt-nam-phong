# Implementation Notes

- Implemented new params `p_date_from DATE`, `p_date_to DATE` to `public.repair_request_list(...)`.
- Filtering uses half-open range on `ngay_yeu_cau` with VN timezone boundary:
  - `>= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`
  - `<  ((p_date_to   + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`
- Preserved facility scoping logic via `v_effective_donvi` and `allowed_don_vi_for_session()`.
- Query retains pagination and total calculation.

Client:
- Added `dateFrom/dateTo` into React Query key and RPC args.
- Fixed persisted date bug by switching from `toISOString().slice(0,10)` to `format(date, 'yyyy-MM-dd')` to avoid UTC shift.
- Reset pagination on date change.

UI:
- Raised Popover calendar z-index above Dialog/Sheet using `z-[1100]`.

Validation:
- Compared RPC counts to direct SQL with the same constraints; matched.
- Verified in DB timezone UTC with VN-local boundaries.
