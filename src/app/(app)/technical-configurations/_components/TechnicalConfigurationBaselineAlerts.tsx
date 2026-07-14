import { AlertCircle, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type TechnicalConfigurationBaselineAlertsProps = Readonly<{
  isConflict: boolean
  isReloading: boolean
  hasPendingBulkInput: boolean
  saveError: string | null
  onReload: () => void
}>

/** Renders conflict and persistence errors outside the editor composition. */
export function TechnicalConfigurationBaselineAlerts({
  isConflict,
  isReloading,
  hasPendingBulkInput,
  saveError,
  onReload,
}: TechnicalConfigurationBaselineAlertsProps) {
  return (
    <>
      {isConflict ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Xung đột dữ liệu</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Dữ liệu trên máy chủ đã thay đổi. Nội dung chưa lưu vẫn được giữ trong form.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isReloading}
              aria-disabled={hasPendingBulkInput}
              aria-describedby={
                hasPendingBulkInput ? "technical-configuration-pending-bulk-status" : undefined
              }
              onClick={onReload}
            >
              <RefreshCw className={isReloading ? "size-4 animate-spin" : "size-4"} />
              {isReloading ? "Đang tải lại..." : "Tải lại từ máy chủ"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {saveError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Thao tác không thành công</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}
