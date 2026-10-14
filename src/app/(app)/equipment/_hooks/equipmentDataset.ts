/** Supported equipment datasets exposed by the equipment page. */
export const EQUIPMENT_DATASETS = ["regular", "placed"] as const

export type EquipmentDataset = (typeof EQUIPMENT_DATASETS)[number]

/** Dataset selected when a URL or caller does not provide a valid value. */
export const DEFAULT_EQUIPMENT_DATASET: EquipmentDataset = "regular"

/** User-facing labels for each equipment dataset. */
export const EQUIPMENT_DATASET_LABELS: Record<EquipmentDataset, string> = {
  regular: "Thiết bị thường",
  placed: "Thiết bị đặt",
}

/** Normalizes a tab/query value to one of the supported equipment datasets. */
export function normalizeEquipmentDataset(value?: string | null): EquipmentDataset {
  return value?.trim() === "placed" ? "placed" : DEFAULT_EQUIPMENT_DATASET
}

/** Returns whether a funding value classifies a row as placed equipment. */
export function isPlacedEquipment(fundingSource?: string | null): boolean {
  return fundingSource?.trim() === "Mượn"
}
