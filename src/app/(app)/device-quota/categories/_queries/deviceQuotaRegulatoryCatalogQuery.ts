import { callRpc } from "@/lib/rpc-client"
import { isRecord, toNullableNumber, toNullableString } from "@/lib/rpc-normalize"
import type {
  DeviceQuotaRegulatoryCatalog,
  DeviceQuotaRegulatoryCatalogCompleteness,
  DeviceQuotaRegulatoryCatalogDocument,
  DeviceQuotaRegulatoryCatalogRow,
  DeviceQuotaRegulatoryCatalogVersion,
} from "../draft-catalog/device-quota-draft-catalog-types"

/** Builds the unit, user, and catalog-version scoped catalog query key. */
export const deviceQuotaRegulatoryCatalogQueryKey = (
  donViId: number | null,
  userId: string | null,
  catalogVersionId: string | null = null
) => ["device-quota-regulatory-catalog", donViId, userId, catalogVersionId] as const

function stringValue(value: unknown, fallback = ""): string {
  return toNullableString(value) ?? fallback
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value
        .map((entry) => toNullableNumber(entry))
        .filter((entry): entry is number => entry != null)
    : []
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : []
}

function parseCatalogRow(value: unknown, sourceOrder: number): DeviceQuotaRegulatoryCatalogRow {
  if (!isRecord(value)) throw new Error("Invalid regulatory catalog row")

  const type = value.type === "section" || value.type === "item" ? value.type : null
  const id = toNullableString(value.id)
  if (!type || !id) throw new Error("Invalid regulatory catalog row")

  return {
    id,
    sourceLabel: stringValue(value.tt),
    type,
    level: value.level === 1 ? 1 : 0,
    parentSourceIdentifier: toNullableString(value.parent),
    name: stringValue(value.name),
    regulatoryUnit: toNullableString(value.unit),
    quotaLines: Array.isArray(value.quota) ? stringArray(value.quota) : null,
    sourcePages: numberArray(value.source_pages),
    sourceReference: toNullableString(value.source_ref),
    sourceOrder,
  }
}

/** Parses the immutable regulatory catalog response from the RPC proxy. */
export function parseDeviceQuotaRegulatoryCatalog(value: unknown): DeviceQuotaRegulatoryCatalog {
  const envelope = isRecord(value) && "data" in value ? value.data : value
  if (!isRecord(envelope)) throw new Error("Invalid regulatory catalog response")

  const documentValue = isRecord(envelope.document) ? envelope.document : {}
  const versionValue = isRecord(envelope.catalog_version) ? envelope.catalog_version : {}
  const completenessValue = isRecord(envelope.completeness) ? envelope.completeness : {}
  const rowsValue = Array.isArray(envelope.rows) ? envelope.rows : []

  const document: DeviceQuotaRegulatoryCatalogDocument = {
    documentNumber: stringValue(documentValue.document_number),
    documentTitle: stringValue(documentValue.document_title),
    appendixTitle: stringValue(documentValue.appendix_title),
    documentVersion: stringValue(documentValue.document_version),
    issuedDate: stringValue(documentValue.issued_date),
    effectiveDate: stringValue(documentValue.effective_date),
    sourcePdfPath: stringValue(documentValue.source_pdf_path),
    sourcePdfSha256: stringValue(documentValue.source_pdf_sha256),
  }
  const catalogVersion: DeviceQuotaRegulatoryCatalogVersion = {
    artifactId: stringValue(versionValue.artifact_id),
    appendixJsonPath: stringValue(versionValue.appendix_json_path),
    appendixJsonSha256: stringValue(versionValue.appendix_json_sha256),
    appendixMarkdownPath: stringValue(versionValue.appendix_markdown_path),
    appendixMarkdownSha256: stringValue(versionValue.appendix_markdown_sha256),
    extractionRevision: stringValue(versionValue.extraction_revision),
    importStatus: stringValue(versionValue.import_status),
    isCanonical: versionValue.is_canonical === true,
    sourcePages: stringValue(versionValue.source_pages),
    sourceNote: stringValue(versionValue.source_note),
  }
  const completeness: DeviceQuotaRegulatoryCatalogCompleteness = {
    structuralRows: toNullableNumber(completenessValue.structural_rows) ?? 0,
    sectionRows: toNullableNumber(completenessValue.section_rows) ?? 0,
    equipmentItemRows: toNullableNumber(completenessValue.equipment_item_rows) ?? 0,
    sourceDeclaredChildRows: toNullableNumber(completenessValue.source_declared_child_rows) ?? 0,
    topLevelItemRows: toNullableNumber(completenessValue.top_level_item_rows) ?? 0,
    ruleLines: toNullableNumber(completenessValue.rule_lines) ?? 0,
    footnotes: toNullableNumber(completenessValue.footnotes) ?? 0,
    itemsWithSourcePages: toNullableNumber(completenessValue.items_with_source_pages) ?? 0,
    itemsWithSourceReferences:
      toNullableNumber(completenessValue.items_with_source_references) ?? 0,
    multilineQuotaItems: toNullableNumber(completenessValue.multiline_quota_items) ?? 0,
  }

  return {
    document,
    catalogVersion,
    completeness,
    rows: rowsValue.map((row, index) => parseCatalogRow(row, index + 1)),
    footnotes: stringArray(envelope.footnotes),
  }
}

/** Reads the immutable regulatory catalog snapshot for the current session unit. */
export async function getDeviceQuotaRegulatoryCatalog(): Promise<DeviceQuotaRegulatoryCatalog> {
  const response = await callRpc<unknown>({
    fn: "device_quota_regulatory_catalog_get",
    args: {},
  })
  return parseDeviceQuotaRegulatoryCatalog(response)
}
