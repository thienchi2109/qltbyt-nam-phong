"use client"

import { Camera } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface QRScannerInstructionsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const INSTRUCTION_STEPS = [
  "Đưa mã QR vào khung quét trên màn hình",
  "Giữ camera ổn định, cách mã QR khoảng 15-20cm",
  "Chờ hệ thống tự động nhận diện mã",
  "Chọn hành động muốn thực hiện với thiết bị",
] as const

export function QRScannerInstructionsDialog({
  open,
  onOpenChange,
}: QRScannerInstructionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5" />
            Hướng dẫn quét mã QR
          </DialogTitle>
          <DialogDescription>
            Làm theo các bước sau để quét mã QR thiết bị
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            {INSTRUCTION_STEPS.map((step, index) => (
              <div key={step} className="flex items-start gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {index + 1}
                </div>
                <p className="text-sm">{step}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Mẹo:</strong> Đảm bảo mã QR không bị nhăn, mờ hoặc che
              khuất. Nếu quét không thành công, thử điều chỉnh khoảng cách hoặc
              góc quét.
            </p>
          </div>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Đã hiểu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
