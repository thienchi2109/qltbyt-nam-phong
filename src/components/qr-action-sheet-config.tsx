import type { ComponentType } from "react"
import { ClipboardList, Eye, History, Settings, Wrench } from "lucide-react"

export type QRActionKey =
  | "usage-log"
  | "view-details"
  | "view-history"
  | "create-repair"
  | "update-status"

export type QRErrorType = "not_found" | "access_denied" | "network" | "server_error" | null

export const QR_ACTION_ITEMS = [
  {
    action: "usage-log",
    title: "Ghi nhật ký sử dụng thiết bị",
    description: "Theo dõi và ghi nhận quá trình sử dụng thiết bị",
    variant: "default" as const,
    icon: ClipboardList,
    iconClassName: "text-primary",
    iconContainerClassName: "bg-primary-foreground",
    descriptionClassName: "text-primary-foreground/80",
  },
  {
    action: "view-details",
    title: "Xem thông tin chi tiết",
    description: "Xem đầy đủ thông tin kỹ thuật và cấu hình",
    variant: "outline" as const,
    icon: Eye,
    iconClassName: "text-blue-600",
    iconContainerClassName: "bg-blue-100",
    descriptionClassName: "text-muted-foreground",
  },
  {
    action: "view-history",
    title: "Lịch sử bảo trì & sửa chữa",
    description: "Xem lịch sử hoạt động và bảo trì thiết bị",
    variant: "outline" as const,
    icon: History,
    iconClassName: "text-green-600",
    iconContainerClassName: "bg-green-100",
    descriptionClassName: "text-muted-foreground",
  },
  {
    action: "create-repair",
    title: "Tạo yêu cầu sửa chữa",
    description: "Báo cáo sự cố và yêu cầu sửa chữa",
    variant: "outline" as const,
    icon: Wrench,
    iconClassName: "text-red-600",
    iconContainerClassName: "bg-red-100",
    descriptionClassName: "text-muted-foreground",
  },
  {
    action: "update-status",
    title: "Cập nhật trạng thái",
    description: "Chỉnh sửa thông tin và trạng thái thiết bị",
    variant: "outline" as const,
    icon: Settings,
    iconClassName: "text-orange-600",
    iconContainerClassName: "bg-orange-100",
    descriptionClassName: "text-muted-foreground",
  },
] satisfies ReadonlyArray<{
  action: QRActionKey
  title: string
  description: string
  variant: "default" | "outline"
  icon: ComponentType<{ className?: string }>
  iconClassName: string
  iconContainerClassName: string
  descriptionClassName: string
}>

export function getStatusColor(status: string | null) {
  switch (status) {
    case "Hoạt động":
      return "bg-green-100 text-green-800 border-green-200"
    case "Chờ sửa chữa":
      return "bg-red-100 text-red-800 border-red-200"
    case "Chờ bảo trì":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "Chờ hiệu chuẩn/kiểm định":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "Ngưng sử dụng":
      return "bg-gray-100 text-gray-800 border-gray-200"
    case "Chưa có nhu cầu sử dụng":
      return "bg-purple-100 text-purple-800 border-purple-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount)
}
