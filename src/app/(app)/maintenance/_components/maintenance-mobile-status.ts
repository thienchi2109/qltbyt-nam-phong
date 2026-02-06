import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"

export function getPlanStatusTone(status: MaintenancePlan["trang_thai"]) {
  switch (status) {
    case "Bản nháp":
      return { header: "bg-amber-50 border-b border-amber-100" }
    case "Đã duyệt":
      return { header: "bg-emerald-50 border-b border-emerald-100" }
    case "Không duyệt":
      return { header: "bg-red-50 border-b border-red-100" }
    default:
      return { header: "bg-muted border-b border-border/60" }
  }
}

export function resolveStatusBadgeVariant(status: MaintenancePlan["trang_thai"]) {
  switch (status) {
    case "Bản nháp":
      return "secondary" as const
    case "Đã duyệt":
      return "default" as const
    case "Không duyệt":
      return "destructive" as const
    default:
      return "outline" as const
  }
}
