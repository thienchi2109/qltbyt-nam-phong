import * as React from "react"

import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import type { TransferHistory, TransferRequest } from "@/types/database"

interface UseTransferDetailDialogDataParams {
  open: boolean
  transfer: TransferRequest | null
}

export function useTransferDetailDialogData({
  open,
  transfer,
}: UseTransferDetailDialogDataParams) {
  const { toast } = useToast()
  const [history, setHistory] = React.useState<TransferHistory[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false)
  const [resolvedTransfer, setResolvedTransfer] = React.useState<TransferRequest | null>(null)
  const transferId = transfer?.id ?? null

  React.useEffect(() => {
    if (!open || transferId === null) {
      return
    }

    let cancelled = false

    const fetchTransferDetail = async () => {
      try {
        const data = await callRpc<TransferRequest | null>({
          fn: "transfer_request_get",
          args: { p_id: transferId },
        })

        if (!cancelled && data) {
          setResolvedTransfer(data)
        }
      } catch (error: unknown) {
        if (cancelled) return

        toast({
          variant: "destructive",
          title: "Lỗi tải chi tiết",
          description: error instanceof Error ? error.message : "Không thể tải chi tiết yêu cầu.",
        })
      }
    }

    const fetchHistory = async () => {
      setIsLoadingHistory(true)
      try {
        const data = await callRpc<TransferHistory[]>({
          fn: "transfer_history_list",
          args: { p_yeu_cau_id: transferId },
        })

        if (!cancelled) {
          setHistory(data || [])
        }
      } catch (error: unknown) {
        if (cancelled) return

        toast({
          variant: "destructive",
          title: "Lỗi tải lịch sử",
          description: error instanceof Error ? error.message : "Không thể tải lịch sử thay đổi.",
        })
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false)
        }
      }
    }

    setResolvedTransfer(null)
    setHistory([])
    void fetchTransferDetail()
    void fetchHistory()

    return () => {
      cancelled = true
    }
  }, [open, toast, transfer, transferId])

  return {
    history,
    isLoadingHistory,
    resolvedTransfer,
    transferId,
  }
}
