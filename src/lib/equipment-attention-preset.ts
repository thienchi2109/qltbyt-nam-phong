import type { ColumnFiltersState } from "@tanstack/react-table"

import { isGlobalRole, isRegionalLeaderRole } from "@/lib/rbac"

export const EQUIPMENT_ATTENTION_ACTION = "attention-status" as const

export const EQUIPMENT_ATTENTION_STATUSES = [
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
] as const

export function getEquipmentAttentionHrefForRole(role: string | null | undefined): string {
  if (isGlobalRole(role) || isRegionalLeaderRole(role)) return "/equipment"
  return `/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`
}

export function applyAttentionStatusPresetFilters(prev: ColumnFiltersState): ColumnFiltersState {
  const withoutStatus = prev.filter((filter) => filter.id !== "tinh_trang_hien_tai")
  return [
    ...withoutStatus,
    { id: "tinh_trang_hien_tai", value: [...EQUIPMENT_ATTENTION_STATUSES] },
  ]
}
