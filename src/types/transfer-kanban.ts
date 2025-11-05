/**
 * Types for Transfer Kanban Server-Side Architecture
 * Related: Day 2 - API Routes + TanStack Query
 */

// ============================================================================
// Transfer Kanban Item (RPC Response)
// ============================================================================

export interface TransferKanbanItem {
  id: number
  ma_yeu_cau: string
  thiet_bi_id: number
  loai_hinh: 'noi_bo' | 'ben_ngoai' | 'thanh_ly'
  trang_thai: 'cho_duyet' | 'da_duyet' | 'dang_luan_chuyen' | 'da_ban_giao' | 'hoan_thanh'
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
  // Equipment joined data
  thiet_bi_ma: string
  thiet_bi_ten: string
  thiet_bi_model: string | null
  thiet_bi_don_vi: number
  // Pagination metadata
  total_count: number
}

// ============================================================================
// Filter Parameters
// ============================================================================

export interface TransferKanbanFilters {
  facilityIds?: number[]
  assigneeIds?: number[]
  types?: Array<'noi_bo' | 'ben_ngoai' | 'thanh_ly'>
  statuses?: Array<'cho_duyet' | 'da_duyet' | 'dang_luan_chuyen' | 'da_ban_giao' | 'hoan_thanh'>
  dateFrom?: string // ISO date string
  dateTo?: string   // ISO date string
  searchText?: string
  limit?: number
  cursor?: number // For pagination
}

// ============================================================================
// API Response Types
// ============================================================================

export interface TransferKanbanResponse {
  transfers: {
    cho_duyet: TransferKanbanItem[]
    da_duyet: TransferKanbanItem[]
    dang_luan_chuyen: TransferKanbanItem[]
    da_ban_giao: TransferKanbanItem[]
    hoan_thanh: TransferKanbanItem[]
  }
  totalCount: number
  cursor: number | null
}

export interface TransferCountsResponse {
  totalCount: number
  columnCounts: {
    cho_duyet: number
    da_duyet: number
    dang_luan_chuyen: number
    da_ban_giao: number
    hoan_thanh: number
  }
}

// ============================================================================
// Kanban Column Configuration
// ============================================================================

export const KANBAN_COLUMNS = [
  {
    status: 'cho_duyet' as const,
    title: 'Chờ duyệt',
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-900',
  },
  {
    status: 'da_duyet' as const,
    title: 'Đã duyệt',
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-900',
  },
  {
    status: 'dang_luan_chuyen' as const,
    title: 'Đang luân chuyển',
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-900',
  },
  {
    status: 'da_ban_giao' as const,
    title: 'Đã bàn giao',
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-900',
  },
  {
    status: 'hoan_thanh' as const,
    title: 'Hoàn thành',
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900',
  },
] as const

export type TransferStatus = typeof KANBAN_COLUMNS[number]['status']
