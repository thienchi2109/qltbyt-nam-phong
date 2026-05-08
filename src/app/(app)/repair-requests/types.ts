import type { Session } from "next-auth"

export type RepairUnit = 'noi_bo' | 'thue_ngoai'

export type EquipmentSelectItem = {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  khoa_phong_quan_ly?: string | null
}

export type RepairRequestWithEquipment = {
  id: number
  thiet_bi_id: number
  ngay_yeu_cau: string
  trang_thai: string
  mo_ta_su_co: string
  hang_muc_sua_chua: string | null
  ngay_mong_muon_hoan_thanh: string | null
  nguoi_yeu_cau: string | null
  ngay_duyet: string | null
  ngay_hoan_thanh: string | null
  nguoi_duyet: string | null
  nguoi_xac_nhan: string | null
  chi_phi_sua_chua: number | null
  don_vi_thuc_hien: RepairUnit | null
  ten_don_vi_thue: string | null
  ket_qua_sua_chua: string | null
  ly_do_khong_hoan_thanh: string | null
  thiet_bi: {
    ten_thiet_bi: string
    ma_thiet_bi: string
    model: string | null
    hang_san_xuat?: string | null
    serial: string | null
    khoa_phong_quan_ly: string | null
    facility_name: string | null
    facility_id: number | null
  } | null
}

export type RepairRequestOverdueItem = RepairRequestWithEquipment & {
  days_difference: number
}

export interface RepairRequestOverdueSummary {
  total: number
  overdue: number
  due_today: number
  due_soon: number
  items: RepairRequestOverdueItem[]
}

export type RepairRequestStatusCounts = Record<
  'Chờ xử lý' | 'Đã duyệt' | 'Hoàn thành' | 'Không HT',
  number
>

export interface RepairRequestPageMetrics {
  counts: RepairRequestStatusCounts
  overdue_summary: RepairRequestOverdueSummary
}

export interface RepairRequestChangeHistory {
  id: number
  action_type: string
  admin_username: string
  admin_full_name: string | null
  action_details: Record<string, unknown> | null
  created_at: string
}

/**
 * Authenticated user type from NextAuth session
 * (matches module augmentation in src/types/next-auth.d.ts)
 */
export type AuthUser = Session["user"]
