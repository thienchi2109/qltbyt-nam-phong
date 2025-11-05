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
