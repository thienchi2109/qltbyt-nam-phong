/**
 * Types, schema, and helper functions for EquipmentDetailDialog
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailTypes
 */

import * as React from "react"
import { z } from "zod"
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle,
  Settings,
  Trash2,
  Wrench,
} from "lucide-react"

import { normalizeDateForForm, normalizePartialDateForForm, isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE } from "@/lib/date-utils"
import { equipmentStatusOptions } from "@/components/equipment/equipment-table-columns"

// ============================================================================
// Types
// ============================================================================

/** Equipment status enum type */
export type EquipmentStatus = (typeof equipmentStatusOptions)[number]

// ============================================================================
// Form Schema
// ============================================================================

/**
 * Zod validation schema for equipment edit form
 * Used in both detail dialog and edit dialog
 */
export const equipmentFormSchema = z.object({
  ma_thiet_bi: z.string().min(1, "Mã thiết bị là bắt buộc"),
  ten_thiet_bi: z.string().min(1, "Tên thiết bị là bắt buộc"),
  model: z.string().optional().nullable(),
  serial: z.string().optional().nullable(),
  so_luu_hanh: z.string().optional().nullable(),
  hang_san_xuat: z.string().optional().nullable(),
  noi_san_xuat: z.string().optional().nullable(),
  nam_san_xuat: z.coerce.number().optional().nullable(),
  ngay_nhap: z.string().optional().nullable().refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE).transform(normalizePartialDateForForm),
  ngay_dua_vao_su_dung: z.string().optional().nullable().refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE).transform(normalizePartialDateForForm),
  nguon_kinh_phi: z.string().optional().nullable(),
  gia_goc: z.coerce.number().optional().nullable(),
  han_bao_hanh: z.string().optional().nullable().refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE).transform(normalizePartialDateForForm),
  // Required fields: preprocess null to "" so min(1) validation works
  vi_tri_lap_dat: z.preprocess(
    (val) => val ?? "",
    z.string().min(1, "Vị trí lắp đặt là bắt buộc")
  ),
  khoa_phong_quan_ly: z.preprocess(
    (val) => val ?? "",
    z.string().min(1, "Khoa/Phòng quản lý là bắt buộc")
  ),
  nguoi_dang_truc_tiep_quan_ly: z.preprocess(
    (val) => val ?? "",
    z.string().min(1, "Người trực tiếp quản lý (sử dụng) là bắt buộc")
  ),
  tinh_trang_hien_tai: z.enum(equipmentStatusOptions, { required_error: "Tình trạng hiện tại là bắt buộc" })
    .nullable()
    .superRefine((val, ctx) => {
      if (val === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tình trạng hiện tại là bắt buộc",
        });
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

/**
 * Inferred type from equipment form schema (output after validation)
 */
export type EquipmentFormValues = z.infer<typeof equipmentFormSchema>

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns the appropriate icon for a history event type
 * Used in the history timeline display
 */
export function getHistoryIcon(eventType: string): React.ReactNode {
  switch (eventType) {
    case "Sửa chữa":
      return <Wrench className="h-4 w-4 text-muted-foreground" />
    case "Bảo trì":
    case "Bảo trì định kỳ":
    case "Bảo trì dự phòng":
      return <Settings className="h-4 w-4 text-muted-foreground" />
    case "Luân chuyển":
    case "Luân chuyển nội bộ":
    case "Luân chuyển bên ngoài":
      return <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
    case "Hiệu chuẩn":
    case "Kiểm định":
      return <CheckCircle className="h-4 w-4 text-muted-foreground" />
    case "Thanh lý":
      return <Trash2 className="h-4 w-4 text-muted-foreground" />
    default:
      return <Calendar className="h-4 w-4 text-muted-foreground" />
  }
}

// ============================================================================
// Component Props Interfaces
// ============================================================================

/**
 * User session info needed for RBAC checks
 */
export interface UserSession {
  id: string | number
  role: string
  khoa_phong: string | null
}
