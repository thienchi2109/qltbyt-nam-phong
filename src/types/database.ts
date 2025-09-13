export interface Equipment {
  id: number;
  ma_thiet_bi: string;
  ten_thiet_bi: string;
  model?: string;
  serial_number?: string;
  hang_san_xuat?: string;
  nam_san_xuat?: number;
  noi_san_xuat?: string;
  khoa_phong_id?: number;
  khoa_phong_quan_ly?: string;
  vi_tri_lap_dat?: string;
  nguoi_dang_truc_tiep_quan_ly?: string;
  tinh_trang_hien_tai?: string;
  tinh_trang: string;
  ngay_nhap: string;
  gia_tri?: number;
  ghi_chu?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  password: string;
  full_name: string;
  role: 'admin' | 'to_qltb' | 'qltb_khoa' | 'user';
  khoa_phong?: string;
  created_at: string;
}

export const USER_ROLES = {
  admin: 'Quản trị hệ thống',
  to_qltb: 'Tổ QLTB CDC', 
  qltb_khoa: 'QLTB Khoa/Phòng',
  user: 'Nhân viên'
} as const;

export type UserRole = keyof typeof USER_ROLES;

// Usage Log interfaces
export interface UsageLog {
  id: number;
  thiet_bi_id: number;
  nguoi_su_dung_id?: number;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc?: string;
  tinh_trang_thiet_bi?: string;
  ghi_chu?: string;
  trang_thai: 'dang_su_dung' | 'hoan_thanh';
  created_at: string;
  updated_at: string;

  // Relations
  thiet_bi?: Equipment;
  nguoi_su_dung?: User;
}

export const USAGE_STATUS = {
  dang_su_dung: 'Đang sử dụng',
  hoan_thanh: 'Hoàn thành'
} as const;

export type UsageStatus = keyof typeof USAGE_STATUS;

// Transfer Request interfaces
export interface TransferRequest {
  id: number;
  ma_yeu_cau: string;
  thiet_bi_id: number;
  loai_hinh: 'noi_bo' | 'ben_ngoai' | 'thanh_ly';
  trang_thai: 'cho_duyet' | 'da_duyet' | 'dang_luan_chuyen' | 'da_ban_giao' | 'hoan_thanh';
  
  // Request details
  nguoi_yeu_cau_id?: number;
  ly_do_luan_chuyen: string;
  
  // For internal transfers
  khoa_phong_hien_tai?: string;
  khoa_phong_nhan?: string;
  
  // For external transfers
  muc_dich?: 'sua_chua' | 'cho_muon' | 'thanh_ly' | 'khac';
  don_vi_nhan?: string;
  dia_chi_don_vi?: string;
  nguoi_lien_he?: string;
  so_dien_thoai?: string;
  
  // Timeline
  ngay_du_kien_tra?: string;
  ngay_ban_giao?: string;
  ngay_hoan_tra?: string;
  ngay_hoan_thanh?: string;
  
  // Approval
  nguoi_duyet_id?: number;
  ngay_duyet?: string;
  ghi_chu_duyet?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
  
  // Relations
  thiet_bi?: Equipment;
  nguoi_yeu_cau?: User;
  nguoi_duyet?: User;
  created_by_user?: User;
  updated_by_user?: User;
}

export interface TransferHistory {
  id: number;
  yeu_cau_id: number;
  trang_thai_cu?: string;
  trang_thai_moi: string;
  hanh_dong: string;
  mo_ta?: string;
  nguoi_thuc_hien_id?: number;
  thoi_gian: string;
  
  // Relations
  nguoi_thuc_hien?: User;
}

// Constants for transfer system
export const TRANSFER_TYPES = {
  noi_bo: 'Nội bộ',
  ben_ngoai: 'Bên ngoài',
  thanh_ly: 'Thanh lý'
} as const;

export const TRANSFER_STATUSES = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt', 
  dang_luan_chuyen: 'Đang luân chuyển',
  da_ban_giao: 'Đã bàn giao',
  hoan_thanh: 'Hoàn thành'
} as const;

export const TRANSFER_PURPOSES = {
  sua_chua: 'Sửa chữa',
  cho_muon: 'Cho mượn',
  thanh_ly: 'Thanh lý',
  khac: 'Khác'
} as const;

export type TransferType = keyof typeof TRANSFER_TYPES;
export type TransferStatus = keyof typeof TRANSFER_STATUSES;
export type TransferPurpose = keyof typeof TRANSFER_PURPOSES;

export interface MaintenanceTask {
  id: number;
  ke_hoach_id: number;
  thiet_bi_id: number;
  thang_1: boolean;
  thang_2: boolean;
  thang_3: boolean;
  thang_4: boolean;
  thang_5: boolean;
  thang_6: boolean;
  thang_7: boolean;
  thang_8: boolean;
  thang_9: boolean;
  thang_10: boolean;
  thang_11: boolean;
  thang_12: boolean;
  // Completion tracking fields
  thang_1_hoan_thanh: boolean;
  thang_2_hoan_thanh: boolean;
  thang_3_hoan_thanh: boolean;
  thang_4_hoan_thanh: boolean;
  thang_5_hoan_thanh: boolean;
  thang_6_hoan_thanh: boolean;
  thang_7_hoan_thanh: boolean;
  thang_8_hoan_thanh: boolean;
  thang_9_hoan_thanh: boolean;
  thang_10_hoan_thanh: boolean;
  thang_11_hoan_thanh: boolean;
  thang_12_hoan_thanh: boolean;
  // Completion date fields
  ngay_hoan_thanh_1?: string;
  ngay_hoan_thanh_2?: string;
  ngay_hoan_thanh_3?: string;
  ngay_hoan_thanh_4?: string;
  ngay_hoan_thanh_5?: string;
  ngay_hoan_thanh_6?: string;
  ngay_hoan_thanh_7?: string;
  ngay_hoan_thanh_8?: string;
  ngay_hoan_thanh_9?: string;
  ngay_hoan_thanh_10?: string;
  ngay_hoan_thanh_11?: string;
  ngay_hoan_thanh_12?: string;
  don_vi_thuc_hien: string | null;
  ghi_chu: string | null;
  created_at: string;
  updated_at: string;
  thiet_bi?: Equipment;
} 