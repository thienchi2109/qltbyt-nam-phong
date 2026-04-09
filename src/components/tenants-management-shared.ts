import type { TenantRow } from "@/components/edit-tenant-dialog"

export const ROLE_LABELS = {
  to_qltb: "Tổ QLTB",
  qltb_khoa: "QLTB Khoa/Phòng",
  technician: "Kỹ thuật viên",
  user: "Nhân viên",
} as const

export type TenantUserRole = keyof typeof ROLE_LABELS

export const LOWER_LEVEL_ORDER: TenantUserRole[] = ["qltb_khoa", "technician", "user"]

export interface TenantHierarchyUser {
  id: number
  username: string
  full_name: string
  role: string
  khoa_phong?: string | null
  current_don_vi?: number | null
  created_at?: string | null
}

export type TenantHierarchyRow = TenantRow & {
  users: TenantHierarchyUser[]
}

export type TenantGroups = Record<TenantUserRole, TenantHierarchyUser[]>
