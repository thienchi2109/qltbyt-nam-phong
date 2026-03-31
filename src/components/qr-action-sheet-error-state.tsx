"use client"

import * as React from "react"
import { AlertCircle, RotateCcw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { QRErrorType } from "./qr-action-sheet-config"

interface QRActionSheetErrorStateProps {
  error: string
  errorType: NonNullable<QRErrorType>
  onRetry: () => void
  onClose: () => void
}

export function QRActionSheetErrorState({
  error,
  errorType,
  onRetry,
  onClose,
}: QRActionSheetErrorStateProps) {
  const palette =
    errorType === "access_denied"
      ? {
          iconBg: "bg-orange-100",
          iconText: "text-orange-600",
          titleText: "text-orange-900",
          bodyText: "text-orange-600",
          title: "Không có quyền truy cập",
        }
      : errorType === "network"
        ? {
            iconBg: "bg-yellow-100",
            iconText: "text-yellow-600",
            titleText: "text-yellow-900",
            bodyText: "text-yellow-600",
            title: "Lỗi kết nối mạng",
          }
        : errorType === "server_error"
          ? {
              iconBg: "bg-red-100",
              iconText: "text-red-600",
              titleText: "text-red-900",
              bodyText: "text-red-600",
              title: "Lỗi hệ thống",
            }
          : {
              iconBg: "bg-red-100",
              iconText: "text-red-600",
              titleText: "text-red-900",
              bodyText: "text-red-600",
              title: "Không tìm thấy thiết bị",
            }

  return (
    <div className="text-center py-8">
      <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${palette.iconBg}`}>
        {errorType === "not_found" ? (
          <Search className={`h-8 w-8 ${palette.iconText}`} />
        ) : (
          <AlertCircle className={`h-8 w-8 ${palette.iconText}`} />
        )}
      </div>

      <h3 className={`mt-4 text-lg font-semibold ${palette.titleText}`}>{palette.title}</h3>
      <p className={`mt-2 text-sm ${palette.bodyText}`}>{error}</p>

      <div className="mt-4 space-y-3">
        {errorType === "not_found" && (
          <div className="rounded-lg bg-muted/50 p-4 text-left">
            <p className="mb-2 text-sm font-medium text-foreground">Vui lòng kiểm tra:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Mã QR có đúng định dạng không (ví dụ: TB-001)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Thiết bị đã được đăng ký trong hệ thống chưa</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Thử quét lại mã QR để đảm bảo quét chính xác</span>
              </li>
            </ul>
          </div>
        )}

        {errorType === "access_denied" && (
          <div className="rounded-lg bg-orange-50 p-4 text-left">
            <p className="mb-2 text-sm font-medium text-orange-900">Lý do có thể:</p>
            <ul className="space-y-1 text-sm text-orange-700">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Thiết bị thuộc đơn vị khác mà bạn không quản lý</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Tài khoản của bạn chưa được cấp quyền truy cập thiết bị này</span>
              </li>
            </ul>
            <p className="mt-2 text-sm text-orange-700">
              Liên hệ quản trị viên nếu bạn cần truy cập thiết bị này.
            </p>
          </div>
        )}

        {errorType === "network" && (
          <div className="rounded-lg bg-yellow-50 p-4 text-left">
            <p className="text-sm text-yellow-700">
              Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối Internet và thử lại.
            </p>
          </div>
        )}

        {errorType === "server_error" && (
          <div className="rounded-lg bg-red-50 p-4 text-left">
            <p className="text-sm text-red-700">
              Máy chủ gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại sau hoặc liên hệ quản trị viên nếu lỗi tiếp tục xảy ra.
            </p>
          </div>
        )}

        <div className="flex justify-center gap-2 pt-2">
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Thử lại
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  )
}
