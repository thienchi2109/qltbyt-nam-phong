import { formatFullDateToDisplay, formatPartialDateToDisplay } from "@/lib/date-utils"
import { equipmentStatusOptions } from "@/components/equipment/equipment-table-columns"
import type { Equipment } from "@/types/database"

import type { EquipmentFormValues, EquipmentStatus } from "./EquipmentEditTypes"

export const DEFAULT_EQUIPMENT_FORM_VALUES: EquipmentFormValues = {
  ma_thiet_bi: "",
  ten_thiet_bi: "",
  vi_tri_lap_dat: "",
  khoa_phong_quan_ly: "",
  nguoi_dang_truc_tiep_quan_ly: "",
  tinh_trang_hien_tai: null,
  model: null,
  serial: null,
  hang_san_xuat: null,
  noi_san_xuat: null,
  nguon_kinh_phi: null,
  cau_hinh_thiet_bi: null,
  phu_kien_kem_theo: null,
  so_luu_hanh: null,
  ghi_chu: null,
  ngay_nhap: null,
  ngay_dua_vao_su_dung: null,
  ngay_ngung_su_dung: null,
  han_bao_hanh: null,
  ngay_bt_tiep_theo: null,
  ngay_hc_tiep_theo: null,
  ngay_kd_tiep_theo: null,
  nam_san_xuat: null,
  gia_goc: null,
  chu_ky_bt_dinh_ky: null,
  chu_ky_hc_dinh_ky: null,
  chu_ky_kd_dinh_ky: null,
  phan_loai_theo_nd98: null,
}

function normalizeEquipmentStatus(
  value: Equipment["tinh_trang_hien_tai"]
): EquipmentStatus | null {
  return typeof value === "string" && equipmentStatusOptions.includes(value as EquipmentStatus)
    ? (value as EquipmentStatus)
    : null
}

export function equipmentToFormValues(equipment: Equipment): EquipmentFormValues {
  const classification = equipment.phan_loai_theo_nd98
  const normalizedClassification =
    classification && ["A", "B", "C", "D"].includes(String(classification).toUpperCase())
      ? (String(classification).toUpperCase() as "A" | "B" | "C" | "D")
      : null

  return {
    ma_thiet_bi: equipment.ma_thiet_bi || "",
    ten_thiet_bi: equipment.ten_thiet_bi || "",
    vi_tri_lap_dat: equipment.vi_tri_lap_dat || "",
    khoa_phong_quan_ly: equipment.khoa_phong_quan_ly || "",
    nguoi_dang_truc_tiep_quan_ly: equipment.nguoi_dang_truc_tiep_quan_ly || "",
    tinh_trang_hien_tai: normalizeEquipmentStatus(equipment.tinh_trang_hien_tai),
    model: equipment.model || null,
    serial: equipment.serial || null,
    hang_san_xuat: equipment.hang_san_xuat || null,
    noi_san_xuat: equipment.noi_san_xuat || null,
    nguon_kinh_phi: equipment.nguon_kinh_phi || null,
    cau_hinh_thiet_bi: equipment.cau_hinh_thiet_bi || null,
    phu_kien_kem_theo: equipment.phu_kien_kem_theo || null,
    so_luu_hanh: equipment.so_luu_hanh || null,
    ghi_chu: equipment.ghi_chu || null,
    ngay_nhap: formatPartialDateToDisplay(equipment.ngay_nhap) || null,
    ngay_dua_vao_su_dung: formatPartialDateToDisplay(equipment.ngay_dua_vao_su_dung) || null,
    ngay_ngung_su_dung:
      formatFullDateToDisplay(
        (equipment as Equipment & { ngay_ngung_su_dung?: string | null }).ngay_ngung_su_dung
      ) || null,
    han_bao_hanh: formatPartialDateToDisplay(equipment.han_bao_hanh) || null,
    ngay_bt_tiep_theo:
      (equipment as Equipment & { ngay_bt_tiep_theo?: string }).ngay_bt_tiep_theo || null,
    ngay_hc_tiep_theo:
      (equipment as Equipment & { ngay_hc_tiep_theo?: string }).ngay_hc_tiep_theo || null,
    ngay_kd_tiep_theo:
      (equipment as Equipment & { ngay_kd_tiep_theo?: string }).ngay_kd_tiep_theo || null,
    nam_san_xuat: equipment.nam_san_xuat ?? null,
    gia_goc: equipment.gia_goc ?? null,
    chu_ky_bt_dinh_ky:
      (equipment as Equipment & { chu_ky_bt_dinh_ky?: number }).chu_ky_bt_dinh_ky ?? null,
    chu_ky_hc_dinh_ky:
      (equipment as Equipment & { chu_ky_hc_dinh_ky?: number }).chu_ky_hc_dinh_ky ?? null,
    chu_ky_kd_dinh_ky:
      (equipment as Equipment & { chu_ky_kd_dinh_ky?: number }).chu_ky_kd_dinh_ky ?? null,
    phan_loai_theo_nd98: normalizedClassification,
  }
}
