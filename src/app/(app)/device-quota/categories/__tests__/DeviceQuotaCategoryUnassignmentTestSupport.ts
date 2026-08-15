import type { QueryClient } from "@tanstack/react-query"

import type { EquipmentPreviewItem } from "@/app/(app)/device-quota/_components/mapping-preview/MappingPreviewPrimitives"
import type { CategoryListItem } from "../_types/categories"
import { deviceQuotaCategoryAssignedEquipmentQueryKey } from "../_queries/deviceQuotaCategoryAssignedEquipmentQuery"

export type UnassignmentVariables = {
  thiet_bi_ids: [number]
  nhom_id: number
  donViId: number
}

export const ASSIGNED_KEY = deviceQuotaCategoryAssignedEquipmentQueryKey(5, 7)
export const CATEGORY_LIST_KEY = ["dinh_muc_nhom_list", { donViId: 7 }] as const
export const FILTERED_CATEGORY_LIST_KEY = [
  "dinh_muc_nhom_list",
  { donViId: 7, consumer: "filtered-workspace" },
] as const
export const OTHER_TENANT_CATEGORY_LIST_KEY = ["dinh_muc_nhom_list", { donViId: 8 }] as const
export const UNASSIGNED_KEY = ["dinh_muc_thiet_bi_unassigned", { donViId: 7 }] as const
export const FILTER_OPTIONS_KEY = [
  "dinh_muc_thiet_bi_unassigned_filter_options",
  { donViId: 7 },
] as const
export const COMPLIANCE_KEY = ["dinh_muc_compliance_summary", { donViId: 7 }] as const
export const AFFECTED_QUERY_KEYS = [
  ASSIGNED_KEY,
  CATEGORY_LIST_KEY,
  UNASSIGNED_KEY,
  FILTER_OPTIONS_KEY,
  COMPLIANCE_KEY,
] as const
export const AFFECTED_SEEDED_QUERY_KEYS = [
  ASSIGNED_KEY,
  CATEGORY_LIST_KEY,
  FILTERED_CATEGORY_LIST_KEY,
  UNASSIGNED_KEY,
  FILTER_OPTIONS_KEY,
  COMPLIANCE_KEY,
] as const
export const SEEDED_CACHE_KEYS = [
  ...AFFECTED_SEEDED_QUERY_KEYS,
  OTHER_TENANT_CATEGORY_LIST_KEY,
] as const

export const VARIABLES: UnassignmentVariables = {
  thiet_bi_ids: [101],
  nhom_id: 5,
  donViId: 7,
}

export const equipment: EquipmentPreviewItem = {
  id: 101,
  ma_thiet_bi: "TB-001",
  ten_thiet_bi: "Máy X quang",
  model: null,
  serial: null,
  hang_san_xuat: null,
  khoa_phong_quan_ly: null,
  tinh_trang: "Hoạt động",
}
Object.freeze(equipment)

const parentCategory: CategoryListItem = {
  id: 1,
  parent_id: null,
  ma_nhom: "CHA",
  ten_nhom: "Nhóm cha",
  phan_loai: "A",
  don_vi_tinh: null,
  thu_tu_hien_thi: 1,
  level: 1,
  so_luong_hien_co: 10,
  so_luong_toi_da: 20,
  so_luong_toi_thieu: 5,
  mo_ta: null,
}
Object.freeze(parentCategory)

const category: CategoryListItem = {
  id: 5,
  parent_id: 1,
  ma_nhom: "CĐHA",
  ten_nhom: "Chẩn đoán hình ảnh",
  phan_loai: "A",
  don_vi_tinh: null,
  thu_tu_hien_thi: 2,
  level: 2,
  so_luong_hien_co: 3,
  so_luong_toi_da: 5,
  so_luong_toi_thieu: 2,
  mo_ta: null,
}
Object.freeze(category)

const siblingCategory: CategoryListItem = {
  ...category,
  id: 6,
  ma_nhom: "XN",
  ten_nhom: "Xét nghiệm",
  thu_tu_hien_thi: 3,
  so_luong_hien_co: 7,
}
Object.freeze(siblingCategory)

export function seedVisibleCaches(queryClient: QueryClient) {
  const otherTenantCategory = { ...category, so_luong_hien_co: 99 }
  Object.freeze(otherTenantCategory)

  queryClient.setQueryData(ASSIGNED_KEY, Object.freeze([equipment]))
  queryClient.setQueryData(
    CATEGORY_LIST_KEY,
    Object.freeze([parentCategory, category, siblingCategory])
  )
  queryClient.setQueryData(
    FILTERED_CATEGORY_LIST_KEY,
    Object.freeze([parentCategory, category, siblingCategory])
  )
  queryClient.setQueryData(OTHER_TENANT_CATEGORY_LIST_KEY, Object.freeze([otherTenantCategory]))
  queryClient.setQueryData(UNASSIGNED_KEY, Object.freeze([]))
  queryClient.setQueryData(FILTER_OPTIONS_KEY, Object.freeze([]))
  queryClient.setQueryData(
    COMPLIANCE_KEY,
    Object.freeze([Object.freeze({ nhom_id: 5, so_luong_hien_co: 3 })])
  )
}

export function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}
