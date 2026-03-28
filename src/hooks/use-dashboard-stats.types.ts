export interface EquipmentAttention {
  id: number
  ten_thiet_bi: string
  ma_thiet_bi: string
  model: string | null
  tinh_trang_hien_tai: string
  vi_tri_lap_dat: string | null
  ngay_bt_tiep_theo: string | null
}

export interface EquipmentAttentionRow {
  id: number
  ten_thiet_bi: string
  ma_thiet_bi: string
  model?: string | null
  tinh_trang_hien_tai: string
  vi_tri_lap_dat?: string | null
  ngay_bt_tiep_theo?: string | null
}

export interface EquipmentAttentionPage {
  data: EquipmentAttention[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface EquipmentAttentionPageResponse {
  data?: EquipmentAttentionRow[]
  total?: number
  page?: number
  pageSize?: number
  hasMore?: boolean
}

export function mapEquipmentAttentionRows(
  rows: readonly EquipmentAttentionRow[] | null | undefined,
): EquipmentAttention[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    ten_thiet_bi: row.ten_thiet_bi,
    ma_thiet_bi: row.ma_thiet_bi,
    model: row.model ?? null,
    tinh_trang_hien_tai: row.tinh_trang_hien_tai,
    vi_tri_lap_dat: row.vi_tri_lap_dat ?? null,
    ngay_bt_tiep_theo: row.ngay_bt_tiep_theo ?? null,
  }))
}
