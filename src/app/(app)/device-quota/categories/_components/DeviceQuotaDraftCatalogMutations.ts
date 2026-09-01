import type { DeviceQuotaDraftSaveItem } from "@/lib/device-quota-draft-contract"
import { callRpc } from "@/lib/rpc-client"
import { parseDeviceQuotaDraftSnapshot } from "../_queries/deviceQuotaDraftCatalogQuery"
import type { DeviceQuotaDraftSnapshot } from "../draft-catalog/device-quota-draft-catalog-types"

export type DeviceQuotaDraftErrorKind =
  "conflict" | "unavailable" | "permission" | "validation" | "unknown"

/** Normalized error contract exposed by draft catalog mutations. */
export class DeviceQuotaDraftError extends Error {
  constructor(
    message: string,
    readonly kind: DeviceQuotaDraftErrorKind
  ) {
    super(message)
    this.name = "DeviceQuotaDraftError"
  }
}

/** Converts RPC failures into stable user-facing draft mutation errors. */
export function normalizeDeviceQuotaDraftError(error: unknown): DeviceQuotaDraftError {
  const message = error instanceof Error ? error.message : ""
  if (/stale_revision|PT409|conflict/i.test(message)) {
    return new DeviceQuotaDraftError(
      "Bản nháp đã thay đổi ở nơi khác. Vui lòng tải lại dữ liệu trước khi tiếp tục.",
      "conflict"
    )
  }
  if (/canonical|snapshot|unavailable|invalid.*catalog/i.test(message)) {
    return new DeviceQuotaDraftError(
      "Danh mục Thông tư hiện chưa sẵn sàng. Vui lòng thử lại sau.",
      "unavailable"
    )
  }
  if (/permission|forbidden|unauthorized|42501|denied/i.test(message)) {
    return new DeviceQuotaDraftError("Bạn không có quyền thao tác với bản nháp này.", "permission")
  }
  if (/invalid|quantity|payload|22023/i.test(message)) {
    return new DeviceQuotaDraftError(
      "Dữ liệu bản nháp không hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.",
      "validation"
    )
  }
  return new DeviceQuotaDraftError("Không thể cập nhật bản nháp. Vui lòng thử lại.", "unknown")
}

/** Saves editable draft item values using optimistic-concurrency protection. */
export async function saveDeviceQuotaDraft(input: {
  draftId: string
  expectedRevision: number
  items: DeviceQuotaDraftSaveItem[]
}): Promise<DeviceQuotaDraftSnapshot> {
  try {
    const response = await callRpc<unknown>({
      fn: "device_quota_unit_catalog_draft_save",
      args: {
        p_draft_id: input.draftId,
        p_expected_revision: input.expectedRevision,
        p_items: input.items,
      },
    })
    return parseDeviceQuotaDraftSnapshot(response)
  } catch (error) {
    throw normalizeDeviceQuotaDraftError(error)
  }
}

async function mutateDeviceQuotaDraftItem(input: {
  fn: "device_quota_unit_catalog_draft_exclude" | "device_quota_unit_catalog_draft_restore"
  draftId: string
  regulatoryItemId: string
  expectedRevision: number
}): Promise<DeviceQuotaDraftSnapshot> {
  try {
    const response = await callRpc<unknown>({
      fn: input.fn,
      args: {
        p_draft_id: input.draftId,
        p_regulatory_item_id: input.regulatoryItemId,
        p_expected_revision: input.expectedRevision,
      },
    })
    return parseDeviceQuotaDraftSnapshot(response)
  } catch (error) {
    throw normalizeDeviceQuotaDraftError(error)
  }
}

/** Excludes one draft item using the current expected revision. */
export function excludeDeviceQuotaDraftItem(
  input: Omit<Parameters<typeof mutateDeviceQuotaDraftItem>[0], "fn">
) {
  return mutateDeviceQuotaDraftItem({ ...input, fn: "device_quota_unit_catalog_draft_exclude" })
}

/** Restores one draft item using the current expected revision. */
export function restoreDeviceQuotaDraftItem(
  input: Omit<Parameters<typeof mutateDeviceQuotaDraftItem>[0], "fn">
) {
  return mutateDeviceQuotaDraftItem({ ...input, fn: "device_quota_unit_catalog_draft_restore" })
}
