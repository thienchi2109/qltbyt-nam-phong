"use client"

import { Button } from "@/components/ui/button"

type DeviceQuotaDraftCatalogStateProps = {
  status: "blocked" | "loading" | "conflict" | "error" | "unavailable"
  hasUnit: boolean
  errorMessage?: string | null
  onRetry?: () => void
}

/** Renders fail-closed loading, access, snapshot, and mutation states. */
export function DeviceQuotaDraftCatalogStates({
  status,
  hasUnit,
  errorMessage,
  onRetry,
}: DeviceQuotaDraftCatalogStateProps): React.JSX.Element {
  if (status === "blocked") {
    return (
      <div className="space-y-2 py-12 text-center" data-testid="device-quota-draft-catalog-blocked">
        <h1 className="text-lg font-semibold">
          {hasUnit ? "Bạn không có quyền mở danh mục dự thảo" : "Chưa xác định đơn vị làm việc"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {hasUnit
            ? "Danh mục dự thảo chỉ dành cho quản trị viên và tổ quản lý thiết bị."
            : "Phiên đăng nhập chưa có đơn vị làm việc hợp lệ."}
        </p>
      </div>
    )
  }

  const stateContent = {
    loading: {
      title: "Đang tải danh mục dự thảo",
      description: "Đang nạp snapshot pháp quy và bản nháp của đơn vị.",
    },
    unavailable: {
      title: "Chưa có snapshot pháp quy khả dụng",
      description: "Không thể mở bản nháp khi nguồn pháp quy chưa sẵn sàng.",
    },
    conflict: {
      title: "Bản nháp đã được cập nhật ở nơi khác",
      description: "Hãy tải lại trang để bắt đầu từ revision mới nhất.",
    },
    error: {
      title: "Không thể tải danh mục dự thảo",
      description: errorMessage ?? "Đã xảy ra lỗi khi nạp dữ liệu.",
    },
  }[status]

  return (
    <div
      className="space-y-2 py-12 text-center"
      data-testid={`device-quota-draft-catalog-${status}`}
    >
      <h1 className="text-lg font-semibold">{stateContent.title}</h1>
      <p className="text-sm text-muted-foreground">{stateContent.description}</p>
      {onRetry && status !== "loading" ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      ) : null}
    </div>
  )
}
