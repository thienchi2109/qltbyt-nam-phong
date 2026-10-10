import { useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { callRpc } from "@/lib/rpc-client"
import { useEquipmentStatusCatalog } from "@/hooks/use-equipment-status-catalog"
import { getEquipmentStatusMetadata } from "@/lib/equipment-status"

import type { EquipmentFormValues } from "./EquipmentEditTypes"

interface UseEquipmentEditUpdateOptions {
  onSuccess?: (savedPatch: Partial<EquipmentFormValues>) => void
  onError?: (error: Error) => void
  successMessage?: string
  errorMessage?: string
  currentStatus?: string | null
}

interface UpdateEquipmentParams {
  id: number
  patch: Partial<EquipmentFormValues>
  successToast?: {
    title: string
    description: string
  }
}

interface UseEquipmentEditUpdateReturn {
  updateEquipment: (params: UpdateEquipmentParams) => Promise<Partial<EquipmentFormValues>>
  isPending: boolean
  error: Error | null
}

/** Updates equipment data and reports the mutation result through toast callbacks. */
export function useEquipmentEditUpdate({
  onSuccess,
  onError,
  successMessage = "Đã cập nhật thiết bị.",
  errorMessage = "Không thể cập nhật thiết bị.",
  currentStatus,
}: UseEquipmentEditUpdateOptions = {}): UseEquipmentEditUpdateReturn {
  const { toast } = useToast()
  const catalog = useEquipmentStatusCatalog()

  const mutation = useMutation({
    mutationFn: async (vars: UpdateEquipmentParams) => {
      if (!catalog.isSuccess || catalog.fetchStatus !== "idle" || !catalog.data) {
        throw new Error("Chưa tải được danh mục tình trạng. Vui lòng thử lại.")
      }
      if ("tinh_trang_hien_tai" in vars.patch) {
        const status = vars.patch.tinh_trang_hien_tai
        const metadata =
          typeof status === "string" ? getEquipmentStatusMetadata(catalog.data, status) : undefined
        if (!metadata || (!metadata.is_active && status !== currentStatus))
          throw new Error("Tình trạng không hợp lệ")
      }
      await callRpc<void>({
        fn: "equipment_update",
        args: { p_id: vars.id, p_patch: vars.patch },
      })
      return vars.patch
    },
    onSuccess: (savedPatch, variables) => {
      const selectedToast = variables.successToast ?? {
        title: "Thành công",
        description: successMessage,
      }

      toast(selectedToast)
      onSuccess?.(savedPatch)
    },
    onError: (error: Error) => {
      const message = getUnknownErrorMessage(error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: message ? `${errorMessage} ${message}` : errorMessage,
      })
      onError?.(error)
    },
  })

  return {
    updateEquipment: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}
