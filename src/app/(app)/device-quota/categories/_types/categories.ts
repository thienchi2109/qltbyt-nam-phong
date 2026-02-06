export interface CategoryListItem {
  id: number
  parent_id: number | null
  ma_nhom: string
  ten_nhom: string
  phan_loai: 'A' | 'B' | 'C' | 'D' | null
  don_vi_tinh: string | null
  thu_tu_hien_thi: number
  level: number
  so_luong_hien_co: number
  mo_ta?: string | null
}

export interface CategoryFull extends CategoryListItem {
  created_at?: string
  updated_at?: string
}

export interface CategoryFormInput {
  ma_nhom: string
  ten_nhom: string
  parent_id: number | null
  phan_loai: 'A' | 'B' | 'C' | 'D' | null
  don_vi_tinh: string | null
  thu_tu_hien_thi: number
  mo_ta: string | null
}

export type CategoryDialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; category: CategoryListItem }

export interface CategoryDeleteState {
  categoryToDelete: CategoryListItem | null
}
