"use client"

import * as React from "react"
import { Edit3, Eye, FileText, Printer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { getUnknownErrorMessage } from "@/lib/error-utils"

import {
  buildHandoverData,
  updateHandoverField,
  validateHandoverData,
  type HandoverData,
  type HandoverField,
} from "./handover-preview-dialog.data"
import { generateHandoverHTML } from "./handover-preview-dialog.document"
import { HandoverPreviewForm } from "./handover-preview-dialog.form"
import type { HandoverPreviewDialogProps } from "./handover-preview-dialog.types"

function writeHandoverWindow(htmlContent: string): Window | null {
  const newWindow = window.open("", "_blank")

  if (!newWindow) return null

  newWindow.document.open()
  newWindow.document.write(htmlContent)
  newWindow.document.close()

  return newWindow
}

export function HandoverPreviewDialog({
  open,
  onOpenChange,
  transfer,
}: HandoverPreviewDialogProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = React.useState(false)
  const [handoverData, setHandoverData] = React.useState<HandoverData | null>(null)
  const [isPrinting, setIsPrinting] = React.useState(false)
  const [isPreviewing, setIsPreviewing] = React.useState(false)

  React.useEffect(() => {
    if (open && transfer?.thiet_bi) {
      setHandoverData(buildHandoverData(transfer))
    }
  }, [open, transfer])

  React.useEffect(() => {
    if (!open || !isEditing) return

    toast({
      title: "💡 Mẹo sử dụng",
      description: "Sử dụng Ctrl+E để chuyển đổi chế độ, Ctrl+P để in nhanh",
      duration: 3000,
    })
  }, [open, isEditing, toast])

  const handleInputChange = (field: HandoverField, value: string) => {
    setHandoverData((current) => (current ? updateHandoverField(current, field, value) : current))
  }

  const showMissingFieldsToast = React.useCallback((missingFields: string[]) => {
    toast({
      variant: "destructive",
      title: "⚠️ Thiếu thông tin bắt buộc",
      description: `Vui lòng điền đầy đủ: ${missingFields.join(", ")}`,
    })
    setIsEditing(true)
  }, [toast])

  const handlePrint = React.useCallback(async () => {
    if (!handoverData) return

    const validation = validateHandoverData(handoverData)
    if (!validation.isValid) {
      showMissingFieldsToast(validation.missingFields)
      return
    }

    setIsPrinting(true)
    try {
      const newWindow = writeHandoverWindow(generateHandoverHTML(handoverData))

      if (newWindow) {
        newWindow.onload = () => {
          setTimeout(() => {
            newWindow.print()

            setTimeout(() => {
              onOpenChange(false)
            }, 1000)
          }, 500)
        }

        toast({
          title: "✅ Thành công",
          description: "Đã mở cửa sổ in phiếu bàn giao. Dialog sẽ tự động đóng sau khi in.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "🚫 Bị chặn popup",
          description: "Vui lòng cho phép popup để sử dụng tính năng in. Kiểm tra thanh địa chỉ trình duyệt.",
        })
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi in phiếu",
        description: getUnknownErrorMessage(error, "Có lỗi không xác định xảy ra khi in phiếu."),
      })
    } finally {
      setIsPrinting(false)
    }
  }, [handoverData, onOpenChange, showMissingFieldsToast, toast])

  const handlePreview = React.useCallback(async () => {
    if (!handoverData) return

    setIsPreviewing(true)
    try {
      const newWindow = writeHandoverWindow(generateHandoverHTML(handoverData))

      if (newWindow) {
        toast({
          title: "👁️ Xem trước",
          description: "Đã mở cửa sổ xem trước phiếu bàn giao.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "🚫 Bị chặn popup",
          description: "Vui lòng cho phép popup để xem trước. Kiểm tra cài đặt trình duyệt.",
        })
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi xem trước",
        description: getUnknownErrorMessage(error, "Có lỗi không xác định xảy ra khi xem trước phiếu."),
      })
    } finally {
      setIsPreviewing(false)
    }
  }, [handoverData, toast])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return

      const key = event.key.toLowerCase()

      if (event.ctrlKey && event.shiftKey && key === "p") {
        event.preventDefault()
        handlePreview()
        return
      }
      if (event.ctrlKey && key === "p") {
        event.preventDefault()
        handlePrint()
        return
      }
      if (event.ctrlKey && key === "e") {
        event.preventDefault()
        setIsEditing((current) => !current)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, handlePrint, handlePreview])

  if (!transfer || !handoverData) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Xem trước phiếu bàn giao - {transfer.ma_yeu_cau}
          </DialogTitle>
          <DialogDescription>
            Xem trước và chỉnh sửa thông tin trước khi xuất phiếu bàn giao thiết bị
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{transfer.loai_hinh === "noi_bo" ? "Nội bộ" : "Bên ngoài"}</Badge>
              <Badge variant="secondary">{transfer.thiet_bi?.ma_thiet_bi}</Badge>
            </div>
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setIsEditing((current) => !current)}>
                      <Edit3 className="size-4 mr-1" />
                      {isEditing ? "Xem" : "Sửa"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Chuyển đổi chế độ chỉnh sửa (Ctrl+E)</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreview}
                      disabled={isPreviewing || isPrinting}
                    >
                      <Eye className="size-4 mr-1" />
                      {isPreviewing ? "Đang xử lý..." : "Xem trước"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Xem trước phiếu bàn giao (Ctrl+Shift+P)</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handlePrint}
                      disabled={isPrinting || isPreviewing}
                    >
                      <Printer className="size-4 mr-1" />
                      {isPrinting ? "Đang in..." : "In phiếu"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>In phiếu bàn giao (Ctrl+P)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          <Separator />

          {isEditing ? (
            <HandoverPreviewForm data={handoverData} onFieldChange={handleInputChange} />
          ) : (
            <div className="space-y-6">
              <div className="bg-zinc-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Thông tin bàn giao</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Khoa/Phòng:</span> {handoverData.department}</div>
                  <div><span className="font-medium">Ngày:</span> {handoverData.handoverDate}</div>
                  <div className="md:col-span-2"><span className="font-medium">Lý do:</span> {handoverData.reason}</div>
                  <div><span className="font-medium">Bên giao:</span> {handoverData.giverName}</div>
                  <div><span className="font-medium">Ban Giám đốc:</span> {handoverData.directorName || "Chưa nhập"}</div>
                  <div><span className="font-medium">Bên nhận:</span> {handoverData.receiverName}</div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Thông tin thiết bị</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Mã TB:</span> {handoverData.device.code}</div>
                  <div><span className="font-medium">Tên TB:</span> {handoverData.device.name}</div>
                  <div><span className="font-medium">Model:</span> {handoverData.device.model}</div>
                  <div><span className="font-medium">Serial:</span> {handoverData.device.serial}</div>
                  <div><span className="font-medium">Tình trạng:</span> {handoverData.device.condition}</div>
                  <div className="md:col-span-2">
                    <span className="font-medium">Phụ kiện:</span> {handoverData.device.accessories || "Chưa nhập"}
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-medium">Ghi chú:</span> {handoverData.device.note || "Chưa có"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t text-xs text-muted-foreground">
          <p className="flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl+E</kbd> Chỉnh sửa</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl+P</kbd> In phiếu</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl+Shift+P</kbd> Xem trước</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd> Đóng</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
