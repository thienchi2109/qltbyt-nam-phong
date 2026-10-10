import { z } from "zod"

/** Badge classes used for terminal liquidation statuses. */
export const LIQUIDATION_STATUS_BADGE_CLASS =
  "border-transparent bg-gray-800 text-white hover:bg-gray-800"

// Legacy report wire keys only; admission always uses catalog status_value.
/** Maps legacy report labels to their wire keys. */
export const EQUIPMENT_STATUS_LEGACY_KEYS: Readonly<Record<string, string>> = {
  "Hoạt động": "hoat_dong",
  "Chờ sửa chữa": "cho_sua_chua",
  "Chờ bảo trì": "cho_bao_tri",
  "Chờ hiệu chuẩn/kiểm định": "cho_hieu_chuan",
  "Ngưng sử dụng": "ngung_su_dung",
  "Chưa có nhu cầu sử dụng": "chua_co_nhu_cau",
}

const equipmentStatusRowSchema = z
  .object({
    status_value: z.string().refine((value) => value.trim().length > 0),
    display_order: z.number().int(),
    is_active: z.boolean(),
    is_terminal: z.boolean(),
    requires_end_date: z.boolean(),
    blocks_operational_actions: z.boolean(),
    is_liquidation: z.boolean(),
  })
  .refine((row) => !row.requires_end_date || row.is_terminal)

/** Validates the RPC response shape for the equipment status catalog. */
export const equipmentStatusCatalogSchema = z
  .array(equipmentStatusRowSchema)
  .refine(
    (rows) =>
      new Set(rows.map((row) => row.status_value)).size === rows.length &&
      new Set(rows.map((row) => row.display_order)).size === rows.length,
    "Equipment status labels and display order must be unique"
  )

export type EquipmentStatusRow = z.infer<typeof equipmentStatusRowSchema>

/** Returns active status labels ordered for form controls. */
export function getActiveEquipmentStatusValues(rows: readonly EquipmentStatusRow[]): string[] {
  return rows
    .filter((row) => row.is_active)
    .sort((left, right) => left.display_order - right.display_order)
    .map((row) => row.status_value)
}

/** Finds catalog metadata for one persisted status value. */
export function getEquipmentStatusMetadata(
  rows: readonly EquipmentStatusRow[],
  statusValue: string
): EquipmentStatusRow | undefined {
  return rows.find((row) => row.status_value === statusValue)
}
