
export type Equipment = {
  id: number;
  ma_thiet_bi: string;
  ten_thiet_bi: string;
  model: string;
  serial: string;
  cau_hinh_thiet_bi: string;
  phu_kien_kem_theo: string;
  hang_san_xuat: string;
  noi_san_xuat: string;
  nam_san_xuat: number;
  ngay_nhap: string;
  ngay_dua_vao_su_dung: string;
  nguon_kinh_phi: string;
  gia_goc: number;
  nam_tinh_hao_mon: number;
  ty_le_hao_mon: string;
  han_bao_hanh: string;
  vi_tri_lap_dat: string;
  nguoi_dang_truc_tiep_quan_ly: string;
  khoa_phong_quan_ly: string;
  tinh_trang_hien_tai: "Hoạt động" | "Chờ sửa chữa" | "Chờ bảo trì" | "Chờ hiệu chuẩn/kiểm định" | "Ngưng sử dụng" | "Chưa có nhu cầu sử dụng" | null;
  ghi_chu: string;
  chu_ky_bt_dinh_ky: number;
  ngay_bt_tiep_theo: string;
  chu_ky_hc_dinh_ky: number;
  ngay_hc_tiep_theo: string;
  chu_ky_kd_dinh_ky: number;
  ngay_kd_tiep_theo: string;
  phan_loai_theo_nd98: string;
};

export const taskTypes = ["Bảo trì", "Hiệu chuẩn", "Kiểm định"] as const;
export type TaskType = typeof taskTypes[number];

export type MaintenancePlan = {
  id: number;
  created_at: string;
  ten_ke_hoach: string;
  nam: number;
  khoa_phong: string | null;
  trang_thai: "Bản nháp" | "Đã duyệt" | "Không duyệt";
  ngay_phe_duyet: string | null;
  nguoi_duyet: string | null;
  nguoi_lap_ke_hoach: string | null;
  loai_cong_viec: TaskType;
  ly_do_khong_duyet?: string | null;
  don_vi: number | null; // Facility ID
  facility_name?: string; // Facility name (joined client-side)
};

export type MaintenanceTask = {
  id: number;
  ke_hoach_id: number;
  thiet_bi_id: number | null;
  loai_cong_viec: TaskType | null;
  diem_hieu_chuan: string | null;
  don_vi_thuc_hien: string | null;
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
  ghi_chu: string | null;
  thiet_bi: {
      ma_thiet_bi: string;
      ten_thiet_bi: string;
      khoa_phong_quan_ly: string | null;
  } | null;
};
