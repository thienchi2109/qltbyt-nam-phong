import type { EquipmentSelectItem } from "../types"

export function formatEquipmentLabel(
  equipment: Pick<EquipmentSelectItem, "ten_thiet_bi" | "ma_thiet_bi">
) {
  return `${equipment.ten_thiet_bi} (${equipment.ma_thiet_bi})`
}

export function parseDraftDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(value)
}
