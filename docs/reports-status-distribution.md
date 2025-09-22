Equipment Status Distribution RPC (equipment_status_distribution)

Request args
- `p_q: text | null` — optional search term
- `p_don_vi: bigint | null` — tenant filter (ignored for non‑global; enforced from JWT)
- `p_khoa_phong: text | null` — department filter
- `p_vi_tri: text | null` — location filter

Response JSON shape
```
{
  total_equipment: number,
  status_counts: { [key: string]: number },
  by_department: Array<{
    name: string,
    total: number,
    hoat_dong: number,
    cho_sua_chua: number,
    cho_bao_tri: number,
    cho_hieu_chuan: number,
    ngung_su_dung: number,
    chua_co_nhu_cau: number,
    khac?: number
  }>,
  by_location: Array<...same as above...>,
  departments: string[],
  locations: string[]
}
```

Notes
- Non‑global users are automatically scoped to their `don_vi` claim regardless of `p_don_vi`.
- Department/location filters are applied server‑side to reduce client work.
- Status keys are canonical: `hoat_dong`, `cho_sua_chua`, `cho_bao_tri`, `cho_hieu_chuan`, `ngung_su_dung`, `chua_co_nhu_cau`, `khac`.

