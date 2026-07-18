"use client"

import { Button } from "@heroui/react"

interface TechnicalConfigurationDocumentsQueryErrorProps {
  isInitialLoad: boolean
  isRetrying: boolean
  onRetry: () => void
}

/** Renders a blocking retry state when evidence documents cannot be refreshed. */
export function TechnicalConfigurationDocumentsQueryError({
  isInitialLoad,
  isRetrying,
  onRetry,
}: TechnicalConfigurationDocumentsQueryErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">
          {isInitialLoad
            ? "Không thể tải tài liệu và trích dẫn."
            : "Đã lưu thay đổi nhưng không thể làm mới danh sách."}
        </p>
        <p className="text-sm text-muted-foreground">
          {isInitialLoad
            ? "Dữ liệu hiện tại chưa được xác nhận. Hãy tải lại trước khi chỉnh sửa."
            : "Danh sách đang hiển thị có thể đã cũ. Hãy tải lại trước khi tiếp tục chỉnh sửa."}
        </p>
      </div>
      <Button size="sm" variant="secondary" isPending={isRetrying} onPress={onRetry}>
        Thử lại
      </Button>
    </div>
  )
}
