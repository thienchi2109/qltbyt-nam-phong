/**
 * Custom hook for equipment attachments query and mutations
 * @module equipment/_components/EquipmentDetailDialog/hooks/useEquipmentAttachments
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import type { Attachment } from "@/app/(app)/equipment/types"
import { equipmentDetailQueryKeys } from "@/app/(app)/equipment/types"

interface UseEquipmentAttachmentsOptions {
  equipmentId: number | undefined
  enabled?: boolean
}

interface AddAttachmentParams {
  name: string
  url: string
}

/** Internal mutation variables that include captured equipmentId */
interface AddAttachmentMutationVars extends AddAttachmentParams {
  _equipmentId: number
}

/** Internal mutation variables for delete */
interface DeleteAttachmentMutationVars {
  attachmentId: string
  _equipmentId: number
}

interface UseEquipmentAttachmentsReturn {
  attachments: Attachment[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
  addAttachment: (params: AddAttachmentParams) => Promise<void>
  deleteAttachment: (attachmentId: string) => Promise<void>
  isAdding: boolean
  isDeleting: boolean
}

/**
 * Manages equipment attachments - fetching, adding, and deleting
 *
 * @param options.equipmentId - The equipment ID to manage attachments for
 * @param options.enabled - Whether the query should be enabled
 * @returns Attachments data, loading states, and mutation functions
 */
export function useEquipmentAttachments({
  equipmentId,
  enabled = true,
}: UseEquipmentAttachmentsOptions): UseEquipmentAttachmentsReturn {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: equipmentDetailQueryKeys.attachments(equipmentId),
    queryFn: async () => {
      const data = await callRpc<Attachment[]>({
        fn: "equipment_attachments_list",
        args: { p_thiet_bi_id: equipmentId! },
      })
      return data || []
    },
    enabled: !!equipmentId && enabled,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  })

  const addMutation = useMutation({
    mutationFn: async (vars: AddAttachmentMutationVars) => {
      await callRpc<string>({
        fn: "equipment_attachment_create",
        args: {
          p_thiet_bi_id: vars._equipmentId,
          p_ten_file: vars.name,
          p_duong_dan: vars.url
        },
      })
    },
    onSuccess: (_, variables) => {
      toast({ title: "Thành công", description: "Đã thêm liên kết mới." })
      // Use captured equipmentId from variables to invalidate correct cache
      queryClient.invalidateQueries({
        queryKey: equipmentDetailQueryKeys.attachments(variables._equipmentId)
      })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi thêm liên kết",
        description: error?.message
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (vars: DeleteAttachmentMutationVars) => {
      await callRpc<void>({
        fn: "equipment_attachment_delete",
        args: { p_id: String(vars.attachmentId) },
      })
    },
    onSuccess: (_, variables) => {
      toast({ title: "Đã xóa", description: "Đã xóa liên kết thành công." })
      // Use captured equipmentId from variables to invalidate correct cache
      queryClient.invalidateQueries({
        queryKey: equipmentDetailQueryKeys.attachments(variables._equipmentId)
      })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi xóa liên kết",
        description: error?.message
      })
    },
  })

  // Wrapper functions that capture equipmentId at call time (not at success time)
  // This prevents race conditions if dialog switches to different equipment before mutation completes
  const addAttachment = async (params: AddAttachmentParams): Promise<void> => {
    if (!equipmentId) throw new Error("Equipment ID is required")
    await addMutation.mutateAsync({ ...params, _equipmentId: equipmentId })
  }

  const deleteAttachment = async (attachmentId: string): Promise<void> => {
    if (!equipmentId) throw new Error("Equipment ID is required")
    await deleteMutation.mutateAsync({ attachmentId, _equipmentId: equipmentId })
  }

  return {
    attachments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addAttachment,
    deleteAttachment,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
