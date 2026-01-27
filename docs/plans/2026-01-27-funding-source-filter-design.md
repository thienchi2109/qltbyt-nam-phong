# Funding Source Filter Design

**Goal:** Add a server-side equipment filter for funding source (mapped to `thiet_bi.nguon_kinh_phi`) visible in both desktop faceted filters and the mobile bottom-sheet, while preserving RPC-only tenant isolation. Missing values should appear as **"Chưa có"** and be filterable.

## Architecture & Data Flow
- Continue using TanStack Table `columnFilters` to drive server-side filtering.
- Add a new filter key: `nguon_kinh_phi`.
- `useEquipmentFilters` will expose `selectedFundingSources` from `columnFilters`.
- `useEquipmentData` will:
  - Fetch funding source options from a new RPC `equipment_funding_sources_list_for_tenant`.
  - Pass `p_nguon_kinh_phi_array` to `equipment_list_enhanced`.
  - Include funding sources in `filterData` for the bottom-sheet.
- Tenant isolation remains enforced by `/api/rpc/[fn]` and SQL claim checks.

## UI Changes
- **Desktop:** Add a new `DataTableFacetedFilter` bound to `table.getColumn("nguon_kinh_phi")` with title “Nguồn kinh phí”.
- **Mobile/Tablet:** Add a new section to `FilterBottomSheet` with key `nguon_kinh_phi` and label “Nguồn kinh phí”.

## RPC & Security
- **New RPC:** `equipment_funding_sources_list_for_tenant(p_don_vi BIGINT DEFAULT NULL)`
  - Pattern matches existing filter-option RPCs.
  - Aggregates with:
    - `COALESCE(NULLIF(TRIM(nguon_kinh_phi), ''), 'Chưa có')` as the display label.
    - Returns `{ name, count }` JSONB, ordered by count desc.
  - Enforces tenant isolation using `allowed_don_vi_for_session_safe()` and JWT claims.
- **Extend `equipment_list_enhanced`:**
  - Add `p_nguon_kinh_phi` and `p_nguon_kinh_phi_array` parameters.
  - Filtering logic:
    - If array includes “Chưa có”, include `(nguon_kinh_phi IS NULL OR trim(nguon_kinh_phi) = '')`.
    - For other values, use exact match with `ANY(ARRAY[...])` and `quote_literal`.
  - Preserve current array-first, single-value fallback pattern.
- **RPC Gateway:** Add `equipment_funding_sources_list_for_tenant` to `ALLOWED_FUNCTIONS` in `src/app/api/rpc/[fn]/route.ts`.

## Performance
- Add a **btree index** on `(don_vi, nguon_kinh_phi)` to support tenant-scoped filtering.

## Edge Cases
- “Chưa có” is treated as missing/blank values in both option list and filtering.
- If a literal value “Chưa có” exists in data, it will be indistinguishable from missing values. Prefer avoiding that literal value in data entry.

## Testing
- Extend `src/app/(app)/equipment/__tests__/useEquipmentData.test.ts` to cover:
  - Funding source RPC call and filter data mapping.
  - `equipment_list_enhanced` called with `p_nguon_kinh_phi_array` when filters set.
- Optional: add SQL verification comments for new filter logic in migration.
