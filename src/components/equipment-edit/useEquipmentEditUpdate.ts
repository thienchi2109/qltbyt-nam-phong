import { useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { callRpc } from "@/lib/rpc-client"

import type { EquipmentFormValues } from "./EquipmentEditTypes"

interface UseEquipmentEditUpdateOptions {
  onSuccess?: (savedPatch: Partial<EquipmentFormValues>) => void
  onError?: (error: Error) => void
  successMessage?: string
  errorMessage?: string
}

interface UpdateEquipmentParams {
  id: number
  patch: Partial<EquipmentFormValues>
}

interface UseEquipmentEditUpdateReturn {
  updateEquipment: (params: UpdateEquipmentParams) => Promise<Partial<EquipmentFormValues>>
  isPending: boolean
  error: Error | null
}

export function useEquipmentEditUpdate({
  onSuccess,
  onError,
  successMessage = "Đã cập nhật thiết bị.",
  errorMessage = "Không thể cập nhật thiết bị.",
}: UseEquipmentEditUpdateOptions = {}): UseEquipmentEditUpdateReturn {
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: async (vars: UpdateEquipmentParams) => {
      await callRpc<void>({
        fn: "equipment_update",
        args: { p_id: vars.id, p_patch: vars.patch },
      })
      return vars.patch
    },
    onSuccess: (savedPatch) => {
      toast({ title: "Thành công", description: successMessage })
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
