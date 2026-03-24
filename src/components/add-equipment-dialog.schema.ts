import { z } from "zod"

import {
  FULL_DATE_ERROR_MESSAGE,
  isValidFullDate,
  normalizeFullDateForForm,
  validateDecommissionDateRules,
} from "@/components/equipment-decommission-form"
import {
  PARTIAL_DATE_ERROR_MESSAGE,
  isValidPartialDate,
  normalizePartialDateForForm,
} from "@/lib/date-utils"

export const ADD_EQUIPMENT_STATUS_OPTIONS = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng",
] as const

export const addEquipmentFormSchema = z
  .object({
    ma_thiet_bi: z.string().min(1, "Mã thiết bị là bắt buộc"),
    ten_thiet_bi: z.string().min(1, "Tên thiết bị là bắt buộc"),
    model: z.string().optional(),
    serial: z.string().optional(),
    so_luu_hanh: z.string().optional(),
    hang_san_xuat: z.string().optional(),
    noi_san_xuat: z.string().optional(),
    nam_san_xuat: z.coerce.number().optional().nullable(),
    ngay_nhap: z
      .string()
      .optional()
      .nullable()
      .refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE)
      .transform(normalizePartialDateForForm),
    ngay_dua_vao_su_dung: z
      .string()
      .optional()
      .nullable()
      .refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE)
      .transform(normalizePartialDateForForm),
    ngay_ngung_su_dung: z
      .string()
      .optional()
      .nullable()
      .refine(isValidFullDate, FULL_DATE_ERROR_MESSAGE)
      .transform(normalizeFullDateForForm),
    nguon_kinh_phi: z.string().optional(),
    gia_goc: z.coerce.number().optional().nullable(),
    han_bao_hanh: z
      .string()
      .optional()
      .nullable()
      .refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE)
      .transform(normalizePartialDateForForm),
    vi_tri_lap_dat: z.string().min(1, "Vị trí lắp đặt là bắt buộc"),
    khoa_phong_quan_ly: z.string().min(1, "Khoa/Phòng quản lý là bắt buộc"),
    nguoi_dang_truc_tiep_quan_ly: z
      .string()
      .min(1, "Người trực tiếp quản lý (sử dụng) là bắt buộc"),
    tinh_trang_hien_tai: z.enum(ADD_EQUIPMENT_STATUS_OPTIONS, {
      required_error: "Tình trạng hiện tại là bắt buộc",
    }),
    cau_hinh_thiet_bi: z.string().optional(),
    phu_kien_kem_theo: z.string().optional(),
    ghi_chu: z.string().optional(),
  })
  .superRefine(validateDecommissionDateRules)

export type AddEquipmentFormValues = z.infer<typeof addEquipmentFormSchema>

export const DEFAULT_ADD_EQUIPMENT_FORM_VALUES: AddEquipmentFormValues = {
  ma_thiet_bi: "",
  ten_thiet_bi: "",
  model: "",
  serial: "",
  so_luu_hanh: "",
  hang_san_xuat: "",
  noi_san_xuat: "",
  nam_san_xuat: null,
  ngay_nhap: "",
  ngay_dua_vao_su_dung: "",
  ngay_ngung_su_dung: "",
  nguon_kinh_phi: "",
  gia_goc: null,
  han_bao_hanh: "",
  vi_tri_lap_dat: "",
  khoa_phong_quan_ly: "",
  nguoi_dang_truc_tiep_quan_ly: "",
  tinh_trang_hien_tai: "" as AddEquipmentFormValues["tinh_trang_hien_tai"],
  cau_hinh_thiet_bi: "",
  phu_kien_kem_theo: "",
  ghi_chu: "",
}
