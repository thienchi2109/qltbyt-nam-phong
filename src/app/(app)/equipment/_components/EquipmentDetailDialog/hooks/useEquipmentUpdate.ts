/**
 * Custom hook for updating equipment details
 * @module equipment/_components/EquipmentDetailDialog/hooks/useEquipmentUpdate
 */

import { useMutation } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import type { EquipmentFormValues } from "../EquipmentDetailTypes"

interface UseEquipmentUpdateOptions {
  /** Called after successful update with the saved patch values */
  onSuccess?: (savedPatch: Partial<EquipmentFormValues>) => void
  /** Called after update failure */
  onError?: (error: Error) => void
}

interface UpdateEquipmentParams {
  id: number
  patch: Partial<EquipmentFormValues>
}

interface UseEquipmentUpdateReturn {
  updateEquipment: (params: UpdateEquipmentParams) => Promise<Partial<EquipmentFormValues>>
  isPending: boolean
  error: Error | null
}

/**
 * Handles equipment update mutations with toast notifications
 *
 * @param options.onSuccess - Callback after successful update
 * @param options.onError - Callback after update failure
 * @returns Update function and pending state
 */
export function useEquipmentUpdate({
  onSuccess,
  onError,
}: UseEquipmentUpdateOptions = {}): UseEquipmentUpdateReturn {
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: async (vars: UpdateEquipmentParams) => {
      await callRpc<void>({
        fn: "equipment_update",
        args: { p_id: vars.id, p_patch: vars.patch },
      })
      return vars.patch // Return patch for use in onSuccess
    },
    onSuccess: (savedPatch) => {
      toast({ title: "Thành công", description: "Đã cập nhật thiết bị." })
      onSuccess?.(savedPatch)
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể cập nhật thiết bị. " + (error?.message || ""),
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
