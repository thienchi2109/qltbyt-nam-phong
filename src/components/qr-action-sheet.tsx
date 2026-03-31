"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Search, X } from "lucide-react"
import { callRpc } from "@/lib/rpc-client"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { useToast } from "@/hooks/use-toast"
import type { Equipment } from "@/lib/data"
import { QRActionSheetActions } from "./qr-action-sheet-actions"
import { QRActionSheetEquipmentDetails } from "./qr-action-sheet-equipment-details"
import { QRActionSheetErrorState } from "./qr-action-sheet-error-state"
import type { QRActionKey, QRErrorType } from "./qr-action-sheet-config"

interface QRActionSheetProps {
  qrCode: string // Mã thiết bị từ QR code
  onClose: () => void
  onAction: (action: QRActionKey, equipment?: Equipment) => void
}

export function QRActionSheet({ qrCode, onClose, onAction }: QRActionSheetProps) {
  const [equipment, setEquipment] = React.useState<Equipment | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [errorType, setErrorType] = React.useState<QRErrorType>(null)
  const { toast } = useToast()

  const searchEquipment = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setErrorType(null)

      // Use dedicated RPC for exact ma_thiet_bi lookup with tenant security
      const normalizedCode = qrCode.trim()
      const result = await callRpc<Equipment | null>({
        fn: 'equipment_get_by_code',
        args: { p_ma_thiet_bi: normalizedCode }
      })

      if (!result) {
        setError(`Không tìm thấy thiết bị với mã "${qrCode}" trong hệ thống`)
        setErrorType("not_found")
        setEquipment(null)
      } else {
        setEquipment(result)
      }
    } catch (err: unknown) {
      const errorMsg = getUnknownErrorMessage(err)

      if (errorMsg.includes("access denied") || errorMsg.includes("42501")) {
        setError(`Thiết bị với mã "${qrCode}" không thuộc quyền quản lý của bạn`)
        setErrorType("access_denied")
      } else if (
        errorMsg.includes("network") ||
        errorMsg.includes("fetch") ||
        errorMsg.includes("Failed to fetch") ||
        errorMsg.includes("Network request failed")
      ) {
        setError("Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.")
        setErrorType("network")
      } else if (errorMsg.includes("not found")) {
        setError(`Không tìm thấy thiết bị với mã "${qrCode}" trong hệ thống`)
        setErrorType("not_found")
      } else {
        setError(`Đã có lỗi xảy ra khi tìm kiếm thiết bị: ${errorMsg}`)
        setErrorType("server_error")
      }
      setEquipment(null)
    } finally {
      setLoading(false)
    }
  }, [qrCode])

  React.useEffect(function loadEquipmentForCode() {
    if (qrCode) {
      searchEquipment()
    }
  }, [qrCode, searchEquipment])

  const handleActionClick = React.useCallback((action: QRActionKey) => {
    if (equipment) {
      onAction(action, equipment)
    } else {
      toast({
        variant: "destructive",
        title: "Không thể thực hiện",
        description: "Không tìm thấy thông tin thiết bị"
      })
    }
  }, [equipment, onAction, toast])

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              <SheetTitle>Kết quả quét QR</SheetTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng bảng hành động QR">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Mã thiết bị đã quét:</p>
            <p className="font-mono font-semibold text-lg">{qrCode}</p>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-sm text-muted-foreground">Đang tìm kiếm thiết bị...</p>
            </div>
          )}

          {error && !loading && errorType && (
            <QRActionSheetErrorState
              error={error}
              errorType={errorType}
              onRetry={searchEquipment}
              onClose={onClose}
            />
          )}

          {equipment && !loading && (
            <>
              <QRActionSheetEquipmentDetails equipment={equipment} />

              <Separator />

              <QRActionSheetActions onAction={handleActionClick} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
} 
