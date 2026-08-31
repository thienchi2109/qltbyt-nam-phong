# Phase 0 Excel Import Contract Baseline

This document freezes the existing Excel contracts for
`add-device-quota-draft-catalog`. It is characterization documentation only.
Phase 0 does not modify either importer, its API/RPC calls, active writes, or
generated contracts.

## Category Excel Import

Entry point:

- `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx`
- Existing category-management dialog, gated by the existing category
  workspace permissions.

Parsing and validation:

- Reads the first workbook sheet through `readExcelFile` and
  `worksheetToJson`.
- Normalizes Vietnamese headers and maps them through
  `src/lib/category-import-validation.ts`.
- Required fields are `ma_nhom` and `ten_nhom`.
- `ma_nhom` accepts the existing 1-4-level dotted code format.
- Duplicate codes inside one workbook are blocking validation errors.
- Codes already present in the tenant are warnings; valid rows remain
  importable and the server can report per-row failures.
- `phan_loai`, display order, and optional text fields keep their current
  validation and normalization.
- Optional quota columns are `dinh_muc_toi_da` and `toi_thieu`. If provided,
  they must be integers, `dinh_muc_toi_da > 0`, `toi_thieu >= 0`, and
  `toi_thieu <= dinh_muc_toi_da`.
- Rows with validation errors are omitted from `parsedRows`; valid rows may
  still be imported when other workbook rows have errors.

Primary RPC:

```text
dinh_muc_nhom_bulk_import(
  p_items: ParsedCategoryRow[],
  p_don_vi: bigint
) -> {
  success: boolean,
  inserted: number,
  failed: number,
  total: number,
  details: Array<{ index, success, ma_nhom, id?, error? }>
}
```

The RPC processes parent categories before children, rejects duplicate codes
inside the batch and parent cycles, and records existing-database or
per-row failures in `details`. Its category writes target active
`nhom_thiet_bi` data. The existing role and tenant behavior is preserved:
`global`/`admin` use the caller-provided tenant argument, while `to_qltb` is
forced to its JWT tenant claim.

Optional quota behavior:

- After category RPC success, the dialog selects valid rows where
  `dinh_muc_toi_da > 0`.
- It maps each selected row to
  `{ ma_nhom, so_luong_dinh_muc, so_luong_toi_thieu }`, defaulting minimum
  quantity to `0`.
- It calls `dinh_muc_unified_import(p_items, p_don_vi)`.
- The unified RPC creates the draft quota decision and delegates line-item
  validation/write behavior to `dinh_muc_chi_tiet_bulk_import`.
- A quota import failure after category success leaves category writes in
  place, reports the quota failure, and exposes the existing
  `partial_success` state. This is not rolled back by the dialog.
- Category and decision query invalidation/toast behavior remains part of the
  current UI contract.

## Quota-Decision Excel Import

Entry point:

- `src/app/(app)/device-quota/decisions/_components/DeviceQuotaImportDialog.tsx`
- Props include `open`, `quyetDinhId`, tenant categories, and `onSuccess`.

Header aliases:

| Excel header                      | Payload field        |
| --------------------------------- | -------------------- |
| `Mã nhóm thiết bị`, `Mã nhóm`     | `ma_nhom`            |
| `Số lượng định mức`, `Định mức`   | `so_luong_dinh_muc`  |
| `Số lượng tối thiểu`, `Tối thiểu` | `so_luong_toi_thieu` |
| `Ghi chú`                         | `ghi_chu`            |

Validation and payload mapping:

- `ma_nhom` is required and must exist in the category list supplied to the
  dialog.
- `so_luong_dinh_muc` is required, an integer, and greater than zero.
- `so_luong_toi_thieu` is optional, but when present must be an integer,
  non-negative, and no greater than `so_luong_dinh_muc`.
- Negative, fractional, and malformed numeric values are rejected before RPC.
- Empty optional minimum and note values become `null`.
- Valid rows are sent as
  `{ ma_nhom, so_luong_dinh_muc, so_luong_toi_thieu, ghi_chu }`.
- Any validation error disables submission; this importer does not submit a
  mixed valid/invalid workbook.

Primary RPC:

```text
dinh_muc_chi_tiet_bulk_import(
  p_quyet_dinh_id: bigint,
  p_items: Array<{
    ma_nhom: string,
    so_luong_dinh_muc: integer,
    so_luong_toi_thieu?: integer | null,
    ghi_chu?: string | null
  }>
) -> {
  success: boolean,
  inserted: number,
  updated: number,
  failed: number,
  total: number,
  details: Array<{
    index,
    success,
    operation?,
    ma_nhom,
    id?,
    error?
  }>
}
```

The RPC requires an authorized role, verifies the decision belongs to the
effective tenant and is still `draft`, resolves each category within that
tenant, rejects parent categories, and delegates each successful row to the
existing quota upsert/audit path. Per-row failures are reported in `details`;
successful rows are not discarded because another row failed.

## Phase 0 Compatibility Boundary

No Phase 0 code may:

- import either dialog or alter its validation/mapping;
- change `dinh_muc_nhom_bulk_import`, `dinh_muc_unified_import`, or
  `dinh_muc_chi_tiet_bulk_import`;
- change active category, decision, assignment, compliance, report, or
  generated database contracts;
- expose the Thong tu source snapshot through application runtime;
- touch the unrelated `#928` initiative.
