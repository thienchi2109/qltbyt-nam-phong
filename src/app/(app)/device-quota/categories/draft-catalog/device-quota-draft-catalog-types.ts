import type { DeviceQuotaDraft, DeviceQuotaDraftItem } from "@/lib/device-quota-draft-contract"

export type DeviceQuotaRegulatoryRowType = "section" | "item"
export type DeviceQuotaDraftEditorMode = "editable" | "readonly"
export type DeviceQuotaDraftCompleteness = "structural" | "complete" | "incomplete" | "excluded"

export type DeviceQuotaRegulatoryCatalogDocument = {
  documentNumber: string
  documentTitle: string
  appendixTitle: string
  documentVersion: string
  issuedDate: string
  effectiveDate: string
  sourcePdfPath: string
  sourcePdfSha256: string
}

export type DeviceQuotaRegulatoryCatalogVersion = {
  id: string
  artifactId: string
  appendixJsonPath: string
  appendixJsonSha256: string
  appendixMarkdownPath: string
  appendixMarkdownSha256: string
  extractionRevision: string
  importStatus: string
  isCanonical: boolean
  sourcePages: string
  sourceNote: string
}

/** User-facing error shown when draft and canonical catalog identities differ. */
export const DEVICE_QUOTA_CATALOG_IDENTITY_ERROR = "Danh mục canonical không khớp với bản nháp."

const DEVICE_QUOTA_CATALOG_VERSION_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Returns whether a catalog version identity is a canonical UUID. */
export function isDeviceQuotaCatalogVersionId(value: unknown): value is string {
  return typeof value === "string" && DEVICE_QUOTA_CATALOG_VERSION_UUID.test(value)
}

/** Returns whether the draft and canonical catalog identify the same UUID. */
export function isDeviceQuotaCatalogVersionCoherent(
  draftCatalogVersionId: unknown,
  catalogVersionId: unknown
): boolean {
  return (
    isDeviceQuotaCatalogVersionId(draftCatalogVersionId) &&
    isDeviceQuotaCatalogVersionId(catalogVersionId) &&
    draftCatalogVersionId === catalogVersionId
  )
}

export type DeviceQuotaRegulatoryCatalogCompleteness = {
  structuralRows: number
  sectionRows: number
  equipmentItemRows: number
  sourceDeclaredChildRows: number
  topLevelItemRows: number
  ruleLines: number
  footnotes: number
  itemsWithSourcePages: number
  itemsWithSourceReferences: number
  multilineQuotaItems: number
}

export type DeviceQuotaRegulatoryCatalogRow = {
  id: string
  sourceLabel: string
  type: DeviceQuotaRegulatoryRowType
  level: 0 | 1
  parentSourceIdentifier: string | null
  name: string
  regulatoryUnit: string | null
  quotaLines: string[] | null
  sourcePages: number[]
  sourceReference: string | null
  sourceOrder: number
}

export type DeviceQuotaRegulatoryCatalog = {
  document: DeviceQuotaRegulatoryCatalogDocument
  catalogVersion: DeviceQuotaRegulatoryCatalogVersion
  completeness: DeviceQuotaRegulatoryCatalogCompleteness
  rows: DeviceQuotaRegulatoryCatalogRow[]
  footnotes: string[]
}

export type DeviceQuotaEditableFields = {
  displayName: boolean
  appliedUnit: boolean
  appliedQuantity: boolean
  notes: boolean
}

export type DeviceQuotaMergedSectionRow = DeviceQuotaRegulatoryCatalogRow & {
  type: "section"
  sourceIdentifier: string
  completeness: "structural"
  displayName: string
  displayNameOverride: null
  regulatoryFieldsReadOnly: true
  editableFields: DeviceQuotaEditableFields
}

export type DeviceQuotaMergedItemRow = DeviceQuotaRegulatoryCatalogRow & {
  type: "item"
  sourceIdentifier: string
  completeness: Exclude<DeviceQuotaDraftCompleteness, "structural">
  displayName: string
  displayNameOverride: string | null
  appliedUnit: string | null
  appliedQuantity: number | null
  notes: string | null
  isExcluded: boolean
  displayOrder: number
  regulatoryItemId: string
  regulatoryName: string
  regulatoryUnit: string
  regulatoryQuotaLines: string[]
  regulatoryRules: Array<{ lineOrder: number; sourceText: string }>
  regulatoryFieldsReadOnly: true
  editableFields: DeviceQuotaEditableFields
}

export type DeviceQuotaMergedRow = DeviceQuotaMergedSectionRow | DeviceQuotaMergedItemRow

export type DeviceQuotaDraftItemPatch = Partial<{
  displayNameOverride: string | null
  appliedUnit: string | null
  appliedQuantity: number | null
  notes: string | null
  isExcluded: boolean
  displayOrder: number
}>

export type DeviceQuotaDraftSnapshot = Omit<DeviceQuotaDraft, "items"> & {
  items: DeviceQuotaDraftItem[]
}
