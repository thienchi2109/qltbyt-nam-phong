import { z } from "zod"
import { getEquipmentStatusMetadata, type EquipmentStatusRow } from "@/lib/equipment-status"
import {
  FULL_DATE_ERROR_MESSAGE,
  isValidFullDate,
  normalizeFullDateForForm,
  validateDecommissionDateRules,
} from "@/components/equipment-decommission-form"
import {
  isValidPartialDate,
  normalizeDateForForm,
  normalizePartialDateForForm,
  PARTIAL_DATE_ERROR_MESSAGE,
} from "@/lib/date-utils"

export type EquipmentStatus = string

const nullableTextField = () => z.string().optional().nullable()

const nullableNumberField = () =>
  z.preprocess((value) => (value === "" ? null : value), z.coerce.number().optional().nullable())

const partialDateField = () =>
  z
    .string()
    .optional()
    .nullable()
    .refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE)
    .transform(normalizePartialDateForForm)

const normalizedDateField = () => z.string().optional().nullable().transform(normalizeDateForForm)

const requiredTextField = (message: string) =>
  z.preprocess((value) => value ?? "", z.string().min(1, message))

/** Shared schema for validating and normalizing equipment edit form submissions. */
export function createEquipmentFormSchema(
  catalog: readonly EquipmentStatusRow[],
  currentStatus?: string | null
) {
  return z
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
      nam_tinh_hao_mon: nullableNumberField(),
      ty_le_hao_mon: nullableTextField(),
      han_bao_hanh: partialDateField(),
      vi_tri_lap_dat: requiredTextField("Vị trí lắp đặt là bắt buộc"),
      khoa_phong_quan_ly: requiredTextField("Khoa/Phòng quản lý là bắt buộc"),
      nguoi_dang_truc_tiep_quan_ly: requiredTextField(
        "Người trực tiếp quản lý (sử dụng) là bắt buộc"
      ),
      tinh_trang_hien_tai: z
        .string({
          required_error: "Tình trạng hiện tại là bắt buộc",
        })
        .nullable()
        .superRefine((value, context) => {
          if (value === null) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Tình trạng hiện tại là bắt buộc",
            })
          } else {
            const metadata = getEquipmentStatusMetadata(catalog, value)
            if (!metadata || (!metadata.is_active && value !== currentStatus)) {
              context.addIssue({ code: z.ZodIssueCode.custom, message: "Tình trạng không hợp lệ" })
            }
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
    .superRefine((values, ctx) =>
      validateDecommissionDateRules(values, ctx, catalog, currentStatus)
    )
}

export type EquipmentFormValues = z.infer<ReturnType<typeof createEquipmentFormSchema>>
