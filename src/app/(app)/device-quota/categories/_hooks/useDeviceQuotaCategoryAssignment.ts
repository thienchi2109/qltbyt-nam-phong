"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useToast } from "@/hooks/use-toast"
import {
  invalidateDeviceQuotaLinkQueries,
  linkDeviceQuotaEquipment,
  type LinkEquipmentVariables,
} from "../../mapping/_components/DeviceQuotaMappingMutations"
import {
  deviceQuotaCategoryAssignedEquipmentQueryKey,
  deviceQuotaCategoryAssignedEquipmentQueryOptions,
} from "../_queries/deviceQuotaCategoryAssignedEquipmentQuery"

type UseDeviceQuotaCategoryAssignmentOptions = {
  clearEquipmentSelection: () => void
  onReconciled: (confirmedIds: number[]) => void
}

type CategoryAssignmentVariables = LinkEquipmentVariables & {
  donViId: number | null
}

function normalizeAffectedCount(result: number, requestedCount: number) {
  if (!Number.isFinite(result)) return 0
  return Math.min(Math.max(Math.trunc(result), 0), requestedCount)
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
