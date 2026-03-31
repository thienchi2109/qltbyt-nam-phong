import { z } from "zod"
import {
  FULL_DATE_ERROR_MESSAGE,
  isValidFullDate,
  normalizeFullDateForForm,
  validateDecommissionDateRules,
} from "@/components/equipment-decommission-form"
import { equipmentStatusOptions } from "@/components/equipment/equipment-table-columns"
import {
  isValidPartialDate,
  normalizeDateForForm,
  normalizePartialDateForForm,
  PARTIAL_DATE_ERROR_MESSAGE,
} from "@/lib/date-utils"

export type EquipmentStatus = (typeof equipmentStatusOptions)[number]

export const equipmentFormSchema = z
  .object({
    ma_thiet_bi: z.string().min(1, "Mã thiết bị là bắt buộc"),
    ten_thiet_bi: z.string().min(1, "Tên thiết bị là bắt buộc"),
    model: z.string().optional().nullable(),
    serial: z.string().optional().nullable(),
    so_luu_hanh: z.string().optional().nullable(),
    hang_san_xuat: z.string().optional().nullable(),
    noi_san_xuat: z.string().optional().nullable(),
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
    nguon_kinh_phi: z.string().optional().nullable(),
    gia_goc: z.coerce.number().optional().nullable(),
    han_bao_hanh: z
      .string()
      .optional()
      .nullable()
      .refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE)
      .transform(normalizePartialDateForForm),
    vi_tri_lap_dat: z.preprocess(
      (value) => value ?? "",
      z.string().min(1, "Vị trí lắp đặt là bắt buộc")
    ),
    khoa_phong_quan_ly: z.preprocess(
      (value) => value ?? "",
      z.string().min(1, "Khoa/Phòng quản lý là bắt buộc")
    ),
    nguoi_dang_truc_tiep_quan_ly: z.preprocess(
      (value) => value ?? "",
      z.string().min(1, "Người trực tiếp quản lý (sử dụng) là bắt buộc")
    ),
    tinh_trang_hien_tai: z
      .enum(equipmentStatusOptions, {
        required_error: "Tình trạng hiện tại là bắt buộc",
      })
      .nullable()
      .superRefine((value, context) => {
        if (value === null) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Tình trạng hiện tại là bắt buộc",
          })
        }
      }),
    cau_hinh_thiet_bi: z.string().optional().nullable(),
    phu_kien_kem_theo: z.string().optional().nullable(),
    ghi_chu: z.string().optional().nullable(),
    chu_ky_bt_dinh_ky: z.coerce.number().optional().nullable(),
    ngay_bt_tiep_theo: z.string().optional().nullable().transform(normalizeDateForForm),
    chu_ky_hc_dinh_ky: z.coerce.number().optional().nullable(),
    ngay_hc_tiep_theo: z.string().optional().nullable().transform(normalizeDateForForm),
    chu_ky_kd_dinh_ky: z.coerce.number().optional().nullable(),
    ngay_kd_tiep_theo: z.string().optional().nullable().transform(normalizeDateForForm),
    phan_loai_theo_nd98: z.enum(["A", "B", "C", "D"]).optional().nullable(),
  })
  .superRefine(validateDecommissionDateRules)

export type EquipmentFormValues = z.infer<typeof equipmentFormSchema>
