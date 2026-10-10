import type { EquipmentStatusRow } from "@/lib/equipment-status"
import type {
  EquipmentDistributionData,
  EquipmentDistributionItem,
} from "../use-equipment-distribution"

export const statusCatalog: EquipmentStatusRow[] = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng",
  "Thanh lý nội bộ",
  "Đang đánh giá kỹ thuật",
  "Trạng thái đã ngừng cấp",
].map((status_value, index) => ({
  status_value,
  display_order: index + 1,
  is_active: index !== 8,
  is_terminal: index === 6,
  requires_end_date: index === 6,
  blocks_operational_actions: index === 6,
  is_liquidation: index === 6,
}))
export const statusCounts = {
  hoat_dong: 2,
  cho_sua_chua: 0,
  cho_bao_tri: 0,
  cho_hieu_chuan: 0,
  ngung_su_dung: 0,
  chua_co_nhu_cau: 0,
  "Thanh lý nội bộ": 1,
  "Đang đánh giá kỹ thuật": 2,
  "Trạng thái đã ngừng cấp": 1,
  khac: 1,
  "Giá trị lịch sử": 1,
}
export const departmentRow: EquipmentDistributionItem = {
  name: "Khoa Nội",
  total: 8,
  ...statusCounts,
}
export const rpcDistribution = {
  total_equipment: 8,
  status_counts: statusCounts,
  status_catalog: statusCatalog,
  by_department: [departmentRow],
  by_location: [{ ...departmentRow, name: "101" }],
  departments: ["Khoa Nội"],
  locations: ["101"],
}
export const distribution = {
  totalEquipment: 8,
  statusCounts,
  statusCatalog,
  byDepartment: [departmentRow],
  byLocation: [{ ...departmentRow, name: "101" }],
  departments: ["Khoa Nội"],
  locations: ["101"],
} as EquipmentDistributionData
