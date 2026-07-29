## Why

The main Equipments list already places equipment at the end of the complete
server-paginated result when both conditions match:

- `tinh_trang_hien_tai = 'Ngưng sử dụng'`
- normalized `khoa_phong_quan_ly = 'VT-TBYT- KHO THANH LÍ'`

However, the current ordering only creates a liquidation group and then applies
the requested table sort inside that group. With the default `id.asc` sort, an
older equipment record that is moved into the liquidation warehouse can appear
at the start of the liquidation group. Filtering the list to the liquidation
warehouse makes that same row appear at the top of the filtered result.

Read-only live inspection on 2026-07-29 confirmed that all 272 visible rows in
the liquidation warehouse are already `Ngưng sử dụng`, so the current priority
key is identical for every filtered row. The newly moved row has an old ID but a
current `ngay_ngung_su_dung`, which demonstrates that ID order does not represent
warehouse-entry chronology.

## What Changes

- Refine the opt-in `equipment_list_enhanced` ordering so liquidation rows are
  ordered by `ngay_ngung_su_dung` ascending inside the liquidation group.
- Treat null or blank decommission dates as legacy/unknown records and place
  them before dated liquidation rows.
- Keep the requested user sort after the liquidation chronology key, so it only
  orders rows that share the same decommission date.
- Apply the same ordering whether the user views the general Equipments list or
  filters specifically to `VT-TBYT- KHO THANH LÍ`.
- Keep the ordering before `OFFSET/LIMIT`, so the newest dated liquidation rows
  remain at the end of the complete filtered result.
- Preserve the existing opt-in scope: only the main Equipments table sends
  `p_liquidation_last = true`; export and other RPC consumers keep their current
  order.
- Do not add an `updated_at` column, audit join, warehouse-entry timestamp,
  frontend sort override, or client-side reordering in this change.

The v1 guarantee is decommission-date chronology, not exact warehouse-entry
chronology. Rows sharing one date still use the requested sort and ID, while an
already-decommissioned device moved later into the warehouse may retain an old
or missing date. Exact transition ordering requires a separate timestamp-backed
change.

## Runtime Impact

This proposal does not change runtime behavior by itself. Runtime behavior
changes only after the implementation migration is reviewed and explicitly
applied to live Supabase through MCP.

After rollout, the newest decommission-date cohort in the liquidation group
appears after older dated cohorts in both the general list and a
liquidation-warehouse-filtered list. Rows outside the liquidation group and RPC
calls with `p_liquidation_last = false` remain unchanged.

## Impact

- Affected capability: `equipment-liquidation-ordering` (new capability).
- Expected implementation files:
  - a superseding migration after
    `20260722094302_equipment_list_liquidation_last.sql`
  - `src/app/api/rpc/__tests__/equipment-list-liquidation-order-migration.test.ts`
  - `supabase/tests/equipment_list_enhanced_liquidation_order_smoke.sql`
- No planned TypeScript/React runtime changes.
- No schema column, index, RPC signature, or API payload changes.
- Live migration apply and transactional smoke fixtures require explicit user
  permission before each approved write set.
