import type { EquipmentStatusRow } from "@/lib/equipment-status"
export const activeStatusValues = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng",
  "Thanh lý nội bộ",
]
export const readyStatusCatalog = {
  activeValues: activeStatusValues,
  data: activeStatusValues.map((status_value, index): EquipmentStatusRow => ({
    status_value,
    display_order: index + 1,
    is_active: true,
    is_terminal: index === 6,
    requires_end_date: index === 6,
    blocks_operational_actions: index === 6,
    is_liquidation: index === 6,
  })),
  canWrite: true,
  isSuccess: true,
  fetchStatus: "idle",
  refetch: () => Promise.resolve(),
}
