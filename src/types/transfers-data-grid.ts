import { z } from 'zod'

export type TransferType = 'noi_bo' | 'ben_ngoai' | 'thanh_ly'

export type TransferStatus =
  | 'cho_duyet'
  | 'da_duyet'
  | 'dang_luan_chuyen'
  | 'da_ban_giao'
  | 'hoan_thanh'

export interface TransferListFilters {
  /** Search text applied to transfer code, equipment name, or reason */
  q?: string
  /** Multi-status filter */
  statuses?: TransferStatus[]
  /** Transfer type filter (tab driven) */
  types?: TransferType[]
  /** Page number (1-indexed) */
  page?: number
  /** Number of items per page */
  pageSize?: number
  /** Facility filter (global/regional users) */
  facilityId?: number | null
  /** Date range start (ISO string) */
  dateFrom?: string
  /** Date range end (ISO string) */
  dateTo?: string
  /** Assignee filter */
  assigneeIds?: number[]
  /** User role - for query key cache isolation only (not sent to API) */
  _role?: string
  /** User dia_ban_id - for query key cache isolation only (not sent to API) */
  _diaBan?: number | null
  /** Tenant key - for query key cache isolation only (not sent to API) */
  _tenantKey?: string | number
}

export interface TransferEquipmentInfo {
  ten_thiet_bi: string | null
  ma_thiet_bi: string | null
  model: string | null
  serial: string | null
  khoa_phong_quan_ly: string | null
  facility_name: string | null
  facility_id: number | null
}

export interface TransferListItem {
  id: number
  ma_yeu_cau: string
  thiet_bi_id: number
  loai_hinh: TransferType
  trang_thai: TransferStatus
  nguoi_yeu_cau_id: number | null
  ly_do_luan_chuyen: string
  khoa_phong_hien_tai: string | null
  khoa_phong_nhan: string | null
  muc_dich: 'sua_chua' | 'cho_muon' | 'thanh_ly' | 'khac' | null
  don_vi_nhan: string | null
  dia_chi_don_vi: string | null
  nguoi_lien_he: string | null
  so_dien_thoai: string | null
  ngay_du_kien_tra: string | null
  ngay_ban_giao: string | null
  ngay_hoan_tra: string | null
  ngay_hoan_thanh: string | null
  nguoi_duyet_id: number | null
  ngay_duyet: string | null
  ghi_chu_duyet: string | null
  created_at: string
  updated_at: string | null
  created_by: number | null
  updated_by: number | null
  thiet_bi: TransferEquipmentInfo | null
}

export interface TransferListResponse {
  data: TransferListItem[]
  total: number
  page: number
  pageSize: number
}

export interface TransferStatusCounts {
  cho_duyet: number
  da_duyet: number
  dang_luan_chuyen: number
  da_ban_giao: number
  hoan_thanh: number
}

export interface TransferCountsResponse {
  totalCount: number
  columnCounts: TransferStatusCounts
}

// Zod schema for equipment info validation
export const TransferEquipmentInfoSchema = z.object({
  ten_thiet_bi: z.string().nullable(),
  ma_thiet_bi: z.string().nullable(),
  model: z.string().nullable(),
  serial: z.string().nullable(),
  khoa_phong_quan_ly: z.string().nullable(),
  facility_name: z.string().nullable(),
  facility_id: z.number().nullable(),
})

// Zod schema for runtime validation of individual transfer items
export const TransferListItemSchema = z.object({
  id: z.number(),
  ma_yeu_cau: z.string(),
  thiet_bi_id: z.number(),
  loai_hinh: z.enum(['noi_bo', 'ben_ngoai', 'thanh_ly']),
  trang_thai: z.enum(['cho_duyet', 'da_duyet', 'dang_luan_chuyen', 'da_ban_giao', 'hoan_thanh']),
  nguoi_yeu_cau_id: z.number().nullable(),
  ly_do_luan_chuyen: z.string(),
  khoa_phong_hien_tai: z.string().nullable(),
  khoa_phong_nhan: z.string().nullable(),
  muc_dich: z.enum(['sua_chua', 'cho_muon', 'thanh_ly', 'khac']).nullable(),
  don_vi_nhan: z.string().nullable(),
  dia_chi_don_vi: z.string().nullable(),
  nguoi_lien_he: z.string().nullable(),
  so_dien_thoai: z.string().nullable(),
  ngay_du_kien_tra: z.string().nullable(),
  ngay_ban_giao: z.string().nullable(),
  ngay_hoan_tra: z.string().nullable(),
  ngay_hoan_thanh: z.string().nullable(),
  nguoi_duyet_id: z.number().nullable(),
  ngay_duyet: z.string().nullable(),
  ghi_chu_duyet: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  created_by: z.number().nullable(),
  updated_by: z.number().nullable(),
  thiet_bi: TransferEquipmentInfoSchema.nullable(),
})

// Zod schema for table mode response validation (infinite scroll uses table mode)
export const TransferTableModeResponseSchema = z.object({
  data: z.array(TransferListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
})

export const TransferKanbanColumnDataSchema = z.object({
  tasks: z.array(TransferListItemSchema),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
})

export const TransferKanbanResponseSchema = z.object({
  columns: z.record(
    z.enum(['cho_duyet', 'da_duyet', 'dang_luan_chuyen', 'da_ban_giao', 'hoan_thanh']),
    TransferKanbanColumnDataSchema
  ),
  totalCount: z.number().int().nonnegative(),
})

// TypeScript types inferred from Zod schemas
export type TransferKanbanColumnData = z.infer<typeof TransferKanbanColumnDataSchema>
export type TransferKanbanResponse = z.infer<typeof TransferKanbanResponseSchema>

export type ViewMode = 'table' | 'kanban'

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  dang_luan_chuyen: 'Đang luân chuyển',
  da_ban_giao: 'Đã bàn giao',
  hoan_thanh: 'Hoàn thành',
}

export const ACTIVE_TRANSFER_STATUSES: TransferStatus[] = [
  'cho_duyet',
  'da_duyet',
  'dang_luan_chuyen',
  'da_ban_giao',
]
