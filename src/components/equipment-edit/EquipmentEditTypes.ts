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

const nullableTextField = () => z.string().optional().nullable()

const nullableNumberField = () => z.coerce.number().optional().nullable()

const partialDateField = () =>
  z
    .string()
    .optional()
    .nullable()
    .refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE)
    .transform(normalizePartialDateForForm)

const normalizedDateField = () =>
  z.string().optional().nullable().transform(normalizeDateForForm)

const requiredTextField = (message: string) =>
  z.preprocess((value) => value ?? "", z.string().min(1, message))

export const equipmentFormSchema = z
  .object({
    ma_thiet_bi: z.string().min(1, "Mã thiết bị là bắt buộc"),
    ten_thiet_bi: z.string().min(1, "Tên thiết bị là bắt buộc"),
    model: nullableTextField(),
    serial: nullableTextField(),
    so_luu_hanh: nullableTextField(),
    hang_san_xuat: nullableTextField(),
    noi_san_xuat: nullableTextField(),
    nam_san_xuat: nullableNumberField(),
    ngay_nhap: partialDateField(),
    ngay_dua_vao_su_dung: partialDateField(),
    ngay_ngung_su_dung: z
      .string()
      .optional()
      .nullable()
      .refine(isValidFullDate, FULL_DATE_ERROR_MESSAGE)
      .transform(normalizeFullDateForForm),
    nguon_kinh_phi: nullableTextField(),
    gia_goc: nullableNumberField(),
    han_bao_hanh: partialDateField(),
    vi_tri_lap_dat: requiredTextField("Vị trí lắp đặt là bắt buộc"),
    khoa_phong_quan_ly: requiredTextField("Khoa/Phòng quản lý là bắt buộc"),
    nguoi_dang_truc_tiep_quan_ly: requiredTextField(
      "Người trực tiếp quản lý (sử dụng) là bắt buộc"
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
    cau_hinh_thiet_bi: nullableTextField(),
    phu_kien_kem_theo: nullableTextField(),
    ghi_chu: nullableTextField(),
    chu_ky_bt_dinh_ky: nullableNumberField(),
    ngay_bt_tiep_theo: normalizedDateField(),
    chu_ky_hc_dinh_ky: nullableNumberField(),
    ngay_hc_tiep_theo: normalizedDateField(),
    chu_ky_kd_dinh_ky: nullableNumberField(),
    ngay_kd_tiep_theo: normalizedDateField(),
    phan_loai_theo_nd98: z.enum(["A", "B", "C", "D"]).optional().nullable(),
  })
  .superRefine(validateDecommissionDateRules)

export type EquipmentFormValues = z.infer<typeof equipmentFormSchema>
