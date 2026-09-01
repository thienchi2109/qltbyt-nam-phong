import { callRpc } from "@/lib/rpc-client"
import type { DeviceQuotaDraft, DeviceQuotaDraftItem } from "@/lib/device-quota-draft-contract"
import { isRecord, toNullableNumber, toNullableString } from "@/lib/rpc-normalize"
import type { DeviceQuotaDraftSnapshot } from "../draft-catalog/device-quota-draft-catalog-types"

/** Builds the tenant and user scoped query key for draft snapshots. */
export const deviceQuotaDraftCatalogQueryKey = (donViId: number | null, userId: string | null) =>
  ["device-quota-draft", donViId, userId] as const

function parseDraftItem(value: unknown): DeviceQuotaDraftItem {
  if (!isRecord(value)) throw new Error("Invalid device quota draft item")

  const requiredString = (key: string) => {
    const result = toNullableString(value[key])
    if (!result) throw new Error("Invalid device quota draft item")
    return result
  }
  const rules = Array.isArray(value.regulatory_rules)
    ? value.regulatory_rules.flatMap((rule) => {
        if (!isRecord(rule)) return []
        const lineOrder = toNullableNumber(rule.line_order)
        const sourceText = toNullableString(rule.source_text)
        return lineOrder != null && sourceText
          ? [{ line_order: lineOrder, source_text: sourceText }]
          : []
      })
    : []

  return {
    id: requiredString("id"),
    regulatory_item_id: requiredString("regulatory_item_id"),
    display_name_override: toNullableString(value.display_name_override),
    applied_unit: toNullableString(value.applied_unit),
    applied_quantity: toNullableNumber(value.applied_quantity),
    notes: toNullableString(value.notes),
    is_excluded: value.is_excluded === true,
    display_order: toNullableNumber(value.display_order) ?? 0,
    source_identifier: requiredString("source_identifier"),
    source_label: toNullableString(value.source_label) ?? "",
    regulatory_name: toNullableString(value.regulatory_name) ?? "",
    regulatory_unit: toNullableString(value.regulatory_unit) ?? "",
    regulatory_quota_lines: Array.isArray(value.regulatory_quota_lines)
      ? value.regulatory_quota_lines.filter((entry): entry is string => typeof entry === "string")
      : [],
    regulatory_rules: rules,
  }
}

/** Parses and validates the draft snapshot returned by the RPC proxy. */
export function parseDeviceQuotaDraftSnapshot(value: unknown): DeviceQuotaDraftSnapshot {
  const envelope = isRecord(value) && "data" in value ? value.data : value
  if (!isRecord(envelope) || !isRecord(envelope.draft)) {
    throw new Error("Invalid device quota draft response")
  }

  const draftValue = envelope.draft
  const id = toNullableString(draftValue.id)
  const donVi = toNullableNumber(draftValue.don_vi)
  const catalogVersionId = toNullableString(draftValue.catalog_version_id)
  const revision = toNullableNumber(draftValue.revision)
  const createdBy = toNullableNumber(draftValue.created_by)
  const updatedBy = toNullableNumber(draftValue.updated_by)
  const createdAt = toNullableString(draftValue.created_at)
  const updatedAt = toNullableString(draftValue.updated_at)

  if (
    !id ||
    donVi == null ||
    !catalogVersionId ||
    draftValue.status !== "draft" ||
    revision == null ||
    createdBy == null ||
    updatedBy == null ||
    !createdAt ||
    !updatedAt
  ) {
    throw new Error("Invalid device quota draft response")
  }

  const draft: DeviceQuotaDraft = {
    id,
    don_vi: donVi,
    catalog_version_id: catalogVersionId,
    status: "draft",
    revision,
    created_by: createdBy,
    updated_by: updatedBy,
    created_at: createdAt,
    updated_at: updatedAt,
    items: Array.isArray(envelope.items) ? envelope.items.map(parseDraftItem) : [],
  }

  return { ...draft, items: draft.items }
}

/** Creates or opens the session-scoped draft and returns its snapshot. */
export async function createOrOpenDeviceQuotaDraft(): Promise<DeviceQuotaDraftSnapshot> {
  const response = await callRpc<unknown>({
    fn: "device_quota_unit_catalog_draft_create_or_open",
    args: {},
  })
  return parseDeviceQuotaDraftSnapshot(response)
}

/** Reads a draft snapshot by identifier after create-or-open. */
export async function getDeviceQuotaDraft(
  draftId: string | null = null
): Promise<DeviceQuotaDraftSnapshot | null> {
  const response = await callRpc<unknown>({
    fn: "device_quota_unit_catalog_draft_get",
    args: { p_draft_id: draftId },
  })
  const envelope = isRecord(response) && "data" in response ? response.data : response
  return envelope == null ? null : parseDeviceQuotaDraftSnapshot(response)
}
