import type { DeviceQuotaDraftItem } from "@/lib/device-quota-draft-contract"
import type {
  DeviceQuotaDraftCompleteness,
  DeviceQuotaDraftEditorMode,
  DeviceQuotaMergedItemRow,
  DeviceQuotaMergedRow,
  DeviceQuotaRegulatoryCatalog,
  DeviceQuotaRegulatoryCatalogRow,
} from "./device-quota-draft-catalog-types"

function isFilled(value: string | null): boolean {
  return value != null && value.trim() !== ""
}

/** Derives the editable completeness state for one draft item. */
export function getDeviceQuotaDraftCompleteness(
  item: Pick<DeviceQuotaDraftItem, "applied_unit" | "applied_quantity" | "is_excluded">
): Exclude<DeviceQuotaDraftCompleteness, "structural"> {
  if (item.is_excluded) return "excluded"
  return isFilled(item.applied_unit) && item.applied_quantity != null ? "complete" : "incomplete"
}

function getDraftItemBySourceIdentifier(
  items: DeviceQuotaDraftItem[],
  sourceIdentifier: string
): DeviceQuotaDraftItem | undefined {
  return items.find((item) => item.source_identifier === sourceIdentifier)
}

function editableFields(mode: DeviceQuotaDraftEditorMode) {
  const editable = mode === "editable"
  return {
    displayName: editable,
    appliedUnit: editable,
    appliedQuantity: editable,
    notes: editable,
  }
}

function mergeItemRow(
  source: DeviceQuotaRegulatoryCatalogRow,
  draftItem: DeviceQuotaDraftItem | undefined,
  mode: DeviceQuotaDraftEditorMode
): DeviceQuotaMergedItemRow {
  const displayNameOverride = draftItem?.display_name_override ?? null
  const isExcluded = draftItem?.is_excluded ?? false

  return {
    ...source,
    type: "item",
    sourceIdentifier: source.id,
    completeness: getDeviceQuotaDraftCompleteness({
      applied_unit: draftItem?.applied_unit ?? null,
      applied_quantity: draftItem?.applied_quantity ?? null,
      is_excluded: isExcluded,
    }),
    displayName: isFilled(displayNameOverride) ? displayNameOverride! : source.name,
    displayNameOverride,
    appliedUnit: draftItem?.applied_unit ?? null,
    appliedQuantity: draftItem?.applied_quantity ?? null,
    notes: draftItem?.notes ?? null,
    isExcluded,
    displayOrder: draftItem?.display_order ?? source.sourceOrder,
    regulatoryItemId: draftItem?.regulatory_item_id ?? source.id,
    regulatoryName: source.name,
    regulatoryUnit: source.regulatoryUnit ?? "",
    regulatoryQuotaLines: source.quotaLines ?? [],
    regulatoryRules:
      draftItem?.regulatory_rules.map((rule) => ({
        lineOrder: rule.line_order,
        sourceText: rule.source_text,
      })) ?? [],
    regulatoryFieldsReadOnly: true,
    editableFields: editableFields(mode),
  }
}

/** Combines immutable catalog rows with editable draft values without mutation. */
export function mergeDeviceQuotaDraftCatalog(
  catalog: DeviceQuotaRegulatoryCatalog,
  draft: { items: DeviceQuotaDraftItem[] },
  mode: DeviceQuotaDraftEditorMode
): DeviceQuotaMergedRow[] {
  return catalog.rows
    .slice()
    .sort((left, right) => left.sourceOrder - right.sourceOrder)
    .map((source) => {
      if (source.type === "section") {
        return {
          ...source,
          type: "section" as const,
          completeness: "structural" as const,
          sourceIdentifier: source.id,
          displayName: source.name,
          displayNameOverride: null,
          regulatoryFieldsReadOnly: true as const,
          editableFields: editableFields(mode),
        }
      }

      return mergeItemRow(source, getDraftItemBySourceIdentifier(draft.items, source.id), mode)
    })
}
