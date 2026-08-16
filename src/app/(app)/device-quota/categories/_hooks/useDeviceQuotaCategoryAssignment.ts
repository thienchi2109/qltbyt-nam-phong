"use client"

import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query"

import type { EquipmentPreviewItem } from "@/app/(app)/device-quota/_components/mapping-preview/MappingPreviewPrimitives"
import { useToast } from "@/hooks/use-toast"
import {
  invalidateDeviceQuotaLinkQueries,
  linkDeviceQuotaEquipment,
  unlinkDeviceQuotaEquipment,
  type LinkEquipmentVariables,
  type UnlinkEquipmentVariables,
} from "../../mapping/_components/DeviceQuotaMappingMutations"
import {
  deviceQuotaCategoryAssignedEquipmentQueryKey,
  deviceQuotaCategoryAssignedEquipmentQueryOptions,
} from "../_queries/deviceQuotaCategoryAssignedEquipmentQuery"
import type { CategoryListItem } from "../_types/categories"

type UseDeviceQuotaCategoryAssignmentOptions = {
  clearEquipmentSelection: () => void
  onReconciled: (confirmedIds: number[]) => void
}

type CategoryAssignmentVariables = LinkEquipmentVariables & {
  donViId: number | null
}

export type DeviceQuotaCategoryUnassignmentVariables = UnlinkEquipmentVariables & {
  donViId: number
}

function normalizeAffectedCount(result: number, requestedCount: number) {
  if (!Number.isFinite(result)) return 0
  return Math.min(Math.max(Math.trunc(result), 0), requestedCount)
}

function getUnassignmentQueryKeys(variables: DeviceQuotaCategoryUnassignmentVariables) {
  const scope = { donViId: variables.donViId }

  return {
    assigned: deviceQuotaCategoryAssignedEquipmentQueryKey(variables.nhom_id, variables.donViId),
    categories: ["dinh_muc_nhom_list", scope] as const,
    unassigned: ["dinh_muc_thiet_bi_unassigned", scope] as const,
    filterOptions: ["dinh_muc_thiet_bi_unassigned_filter_options", scope] as const,
    compliance: ["dinh_muc_compliance_summary", scope] as const,
  }
}

async function cancelUnassignmentQueries(
  queryClient: QueryClient,
  variables: DeviceQuotaCategoryUnassignmentVariables
) {
  const keys = getUnassignmentQueryKeys(variables)

  await Promise.all(Object.values(keys).map((queryKey) => queryClient.cancelQueries({ queryKey })))

  return keys
}

function removeAssignedEquipment(
  queryClient: QueryClient,
  queryKey: ReturnType<typeof deviceQuotaCategoryAssignedEquipmentQueryKey>,
  equipmentId: number
) {
  queryClient.setQueryData<EquipmentPreviewItem[]>(queryKey, (current) => {
    if (!current?.some((item) => item.id === equipmentId)) return current
    return current.filter((item) => item.id !== equipmentId)
  })
}

function decrementDirectCategoryCount(
  queryClient: QueryClient,
  queryKey: readonly ["dinh_muc_nhom_list", { donViId: number }],
  categoryId: number
) {
  queryClient.setQueriesData<CategoryListItem[]>({ queryKey }, (current) => {
    if (!current) return current

    const categoryIndex = current.findIndex((category) => category.id === categoryId)
    if (categoryIndex === -1) return current

    const category = current[categoryIndex]
    const nextCount = Math.max(0, category.so_luong_hien_co - 1)
    if (nextCount === category.so_luong_hien_co) return current

    const next = [...current]
    next[categoryIndex] = { ...category, so_luong_hien_co: nextCount }
    return next
  })
}

function invalidateUnassignmentQueries(
  queryClient: QueryClient,
  queryKeys: ReturnType<typeof getUnassignmentQueryKeys>,
  affectedCount: number
) {
  const keys =
    affectedCount === 0 ? [queryKeys.assigned, queryKeys.categories] : Object.values(queryKeys)

  return Promise.all(
    keys.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
        refetchType: "none",
      })
    )
  )
}

/** Links equipment and waits for exact selected-category reconciliation. */
export function useDeviceQuotaCategoryAssignment({
  clearEquipmentSelection,
  onReconciled,
}: UseDeviceQuotaCategoryAssignmentOptions) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (variables: CategoryAssignmentVariables) =>
      linkDeviceQuotaEquipment(variables, variables.donViId),
    onSuccess: async (result, variables) => {
      const requestedCount = variables.thiet_bi_ids.length
      const affectedCount = normalizeAffectedCount(result, requestedCount)

      if (affectedCount === 0) {
        await queryClient.invalidateQueries({
          queryKey: ["dinh_muc_thiet_bi_unassigned"],
        })
        toast({
          variant: "destructive",
          title: "Chưa gán được thiết bị",
          description: "Không có thiết bị nào được gán. Vui lòng kiểm tra và thử lại.",
        })
        return
      }

      clearEquipmentSelection()
      await invalidateDeviceQuotaLinkQueries(queryClient)
      const assignedEquipmentQueryKey = deviceQuotaCategoryAssignedEquipmentQueryKey(
        variables.nhom_id,
        variables.donViId
      )
      await queryClient.invalidateQueries({
        queryKey: assignedEquipmentQueryKey,
        exact: true,
        refetchType: "none",
      })

      let refreshedEquipment
      try {
        refreshedEquipment = await queryClient.fetchQuery(
          deviceQuotaCategoryAssignedEquipmentQueryOptions(variables.nhom_id, variables.donViId)
        )
      } catch {
        toast({
          variant: "destructive",
          title: "Đã gán, chưa tải được kết quả",
          description:
            "Thiết bị đã được gán nhưng chưa thể tải lại chi tiết. Vui lòng thử tải lại.",
        })
        return
      }
      const refreshedIds = new Set((refreshedEquipment ?? []).map((item) => item.id))
      const confirmedIds = variables.thiet_bi_ids.filter((id) => refreshedIds.has(id))

      onReconciled(confirmedIds)

      if (affectedCount < requestedCount) {
        toast({
          title: "Đã gán một phần",
          description: `Đã gán ${affectedCount}/${requestedCount} thiết bị vào nhóm định mức.`,
        })
        return
      }

      toast({
        title: "Thành công",
        description: `Đã gán ${affectedCount} thiết bị vào nhóm định mức.`,
      })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi gán thiết bị",
        description: error.message,
      })
    },
  })
}

/** Unlinks one assigned item and reconciles the captured category workspace caches. */
export function useDeviceQuotaCategoryUnassignment() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (variables: DeviceQuotaCategoryUnassignmentVariables) =>
      unlinkDeviceQuotaEquipment(variables, variables.donViId),
    onSuccess: async (result, variables) => {
      const affectedCount = normalizeAffectedCount(result, variables.thiet_bi_ids.length)
      const queryKeys = await cancelUnassignmentQueries(queryClient, variables)
      const equipmentId = variables.thiet_bi_ids[0]

      removeAssignedEquipment(queryClient, queryKeys.assigned, equipmentId)

      if (affectedCount === 1) {
        decrementDirectCategoryCount(queryClient, queryKeys.categories, variables.nhom_id)
      }

      await invalidateUnassignmentQueries(queryClient, queryKeys, affectedCount)

      if (affectedCount === 0) {
        toast({
          title: "Dữ liệu đã thay đổi",
          description: "Thiết bị không còn thuộc danh mục đã chọn. Dữ liệu sẽ được đồng bộ lại.",
        })
        return
      }

      toast({
        title: "Đã bỏ khỏi danh mục",
        description: "Thiết bị đã được chuyển về danh sách chưa phân loại.",
      })
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Không thể bỏ thiết bị khỏi danh mục",
        description: "Vui lòng thử lại. Nếu lỗi tiếp diễn, hãy tải lại trang.",
      })
    },
  })
}
