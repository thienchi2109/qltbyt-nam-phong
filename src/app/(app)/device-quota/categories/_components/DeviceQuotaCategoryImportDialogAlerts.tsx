import * as React from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ImportResult, ImportStatus } from "@/lib/category-import-validation"
import { toKeyedTexts } from "@/lib/list-key-utils"

interface DeviceQuotaCategoryImportDialogAlertsProps {
  status: ImportStatus
  parsedRowsCount: number
  parseError: string | null
  validationErrors: string[]
  validationWarnings: string[]
  importResult: ImportResult | null
  isSubmitting: boolean
}

/** Renders status, validation, and result feedback for the category import dialog. */
export function DeviceQuotaCategoryImportDialogAlerts({
  status,
  parsedRowsCount,
  parseError,
  validationErrors,
  validationWarnings,
  importResult,
  isSubmitting,
}: DeviceQuotaCategoryImportDialogAlertsProps) {
  return (
    <>
      {status === "parsing" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Đang đọc file…
        </div>
      )}

      {parseError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Lỗi đọc file</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Lỗi dữ liệu - {validationErrors.length} dòng bị bỏ qua</AlertTitle>
          <AlertDescription>
            <ScrollArea className="h-32 mt-2">
              <ul className="list-disc list-inside space-y-1 text-sm">
                {toKeyedTexts(validationErrors.slice(0, 20)).map(({ key, text }) => (
                  <li key={key}>{text}</li>
                ))}
                {validationErrors.length > 20 && (
                  <li className="text-muted-foreground">
                    … và {validationErrors.length - 20} lỗi khác
                  </li>
                )}
              </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      {validationWarnings.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="size-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">
            Cảnh báo ({validationWarnings.length})
          </AlertTitle>
          <AlertDescription className="text-yellow-700">
            <ScrollArea className="h-24 mt-2">
              <ul className="list-disc list-inside space-y-1 text-sm">
                {toKeyedTexts(validationWarnings.slice(0, 10)).map(({ key, text }) => (
                  <li key={key}>{text}</li>
                ))}
                {validationWarnings.length > 10 && (
                  <li className="text-yellow-600">
                    … và {validationWarnings.length - 10} cảnh báo khác
                  </li>
                )}
              </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      {status === "parsed" && parsedRowsCount > 0 && (
        <Alert className={validationErrors.length > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
          <CheckCircle2
            className={`size-4 ${validationErrors.length > 0 ? "text-yellow-600" : "text-green-600"}`}
          />
          <AlertTitle className={validationErrors.length > 0 ? "text-yellow-800" : ""}>
            {validationErrors.length > 0 ? "Sẵn sàng nhập (một phần)" : "Sẵn sàng nhập"}
          </AlertTitle>
          <AlertDescription className={validationErrors.length > 0 ? "text-yellow-700" : ""}>
            Đã đọc được {parsedRowsCount} danh mục hợp lệ từ file Excel.
            {validationErrors.length > 0 && (
              <span className="text-red-600">
                {" "}
                ({validationErrors.length} dòng bị bỏ qua do lỗi.)
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {status === "parsed" && parsedRowsCount === 0 && validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Không có dữ liệu hợp lệ</AlertTitle>
          <AlertDescription>
            Tất cả các dòng trong file đều có lỗi. Vui lòng sửa file và thử lại.
          </AlertDescription>
        </Alert>
      )}

      {status === "success" && importResult && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="size-4 text-green-600" />
          <AlertTitle className="text-green-800">Nhập thành công</AlertTitle>
          <AlertDescription className="text-green-700">
            Đã thêm {importResult.inserted} danh mục vào hệ thống.
            {importResult.failed > 0 && (
              <span className="text-red-600"> {importResult.failed} danh mục thất bại.</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {status === "partial_success" && importResult && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="size-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Nhập thành công một phần</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Đã thêm {importResult.inserted} danh mục nhưng nhập định mức thất bại. Vui lòng thử
            nhập định mức riêng.
          </AlertDescription>
        </Alert>
      )}

      {isSubmitting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Đang nhập dữ liệu…
        </div>
      )}
    </>
  )
}
