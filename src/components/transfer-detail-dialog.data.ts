import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { useToast } from "@/hooks/use-toast"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { callRpc } from "@/lib/rpc-client"
import type { TransferHistory, TransferRequest } from "@/types/database"

interface UseTransferDetailDialogDataParams {
  open: boolean
  transfer: TransferRequest | null
}

export const transferDetailDialogQueryKeys = {
  detailRoot: ["transfer_request_get"] as const,
  detail: (transferId: number | null) =>
    [...transferDetailDialogQueryKeys.detailRoot, { id: transferId }] as const,
  historyRoot: ["transfer_history_list"] as const,
  history: (transferId: number | null) =>
    [...transferDetailDialogQueryKeys.historyRoot, { yeu_cau_id: transferId }] as const,
}

export function useTransferDetailDialogData({
  open,
  transfer,
}: UseTransferDetailDialogDataParams) {
  const { toast } = useToast()
  const transferId = transfer?.id ?? null
  const isEnabled = open && transferId !== null

  const transferDetailQuery = useQuery({
    queryKey: transferDetailDialogQueryKeys.detail(transferId),
    queryFn: ({ signal }) =>
      callRpc<TransferRequest | null>({
        fn: "transfer_request_get",
        args: { p_id: transferId! },
        signal,
      }),
    enabled: isEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const historyQuery = useQuery({
    queryKey: transferDetailDialogQueryKeys.history(transferId),
    queryFn: async ({ signal }) => {
      const data = await callRpc<TransferHistory[]>({
        fn: "transfer_history_list",
        args: { p_yeu_cau_id: transferId! },
        signal,
      })

      return data || []
    },
    enabled: isEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  React.useEffect(() => {
    if (!transferDetailQuery.error) {
      return
    }

    toast({
      variant: "destructive",
      title: "Lỗi tải chi tiết",
      description: getUnknownErrorMessage(
        transferDetailQuery.error,
        "Không thể tải chi tiết yêu cầu.",
      ),
    })
  }, [toast, transferDetailQuery.error, transferDetailQuery.errorUpdatedAt])

  React.useEffect(() => {
    if (!historyQuery.error) {
      return
    }

    toast({
      variant: "destructive",
      title: "Lỗi tải lịch sử",
      description: getUnknownErrorMessage(
        historyQuery.error,
        "Không thể tải lịch sử thay đổi.",
      ),
    })
  }, [toast, historyQuery.error, historyQuery.errorUpdatedAt])

  return {
    history: historyQuery.data ?? [],
    isLoadingHistory: historyQuery.isLoading,
    resolvedTransfer: transferDetailQuery.data ?? null,
    transferId,
  }
}
