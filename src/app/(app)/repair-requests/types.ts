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
  don_vi_thuc_hien: RepairUnit | null
  ten_don_vi_thue: string | null
  ket_qua_sua_chua: string | null
  ly_do_khong_hoan_thanh: string | null
  thiet_bi: {
    ten_thiet_bi: string
    ma_thiet_bi: string
    model: string | null
    serial: string | null
    khoa_phong_quan_ly: string | null
    facility_name: string | null
    facility_id: number | null
  } | null
}

/**
 * Authenticated user type from NextAuth session
 * (matches module augmentation in src/types/next-auth.d.ts)
 */
export type AuthUser = {
  id: string
  username: string
  role: string
  khoa_phong?: string | null
  don_vi?: string | number | null
  current_don_vi?: number | null
  dia_ban_id?: string | number | null
  dia_ban_ma?: string | null
  full_name?: string | null
}
