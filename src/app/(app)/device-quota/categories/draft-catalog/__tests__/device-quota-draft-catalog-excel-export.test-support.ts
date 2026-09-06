import { readFileSync } from "node:fs"
import { join } from "node:path"

import JSZip from "jszip"

import { createExcelWorkbook } from "@/lib/excel-workbook"
import { mergeDeviceQuotaDraftCatalog } from "../device-quota-draft-catalog-mappers"
import type {
  DeviceQuotaDraftItem,
  DeviceQuotaRegulatoryCatalog,
  DeviceQuotaRegulatoryCatalogRow,
} from "../device-quota-draft-catalog-types"
import type { DeviceQuotaDraftCatalogExportSnapshot } from "../device-quota-draft-catalog-excel-export"
import {
  DEVICE_QUOTA_DRAFT_EXPORT_MARKER,
  serializeDeviceQuotaDraftCatalogWorkbook,
} from "../device-quota-draft-catalog-excel-export"

type SourceRow = {
  id: string
  tt: string
  type: "section" | "item"
  level: 0 | 1
  parent: string | null
  name: string
  unit: string | null
  quota: string[] | null
  source_pages: number[]
  source_ref: string
}

type SourceAppendix = {
  source_file: string
  document_title: string
  rows: SourceRow[]
  footnotes: string[]
}

type SourceManifest = {
  artifact_id: string
  document_number: string
  extraction_revision: string
  source_artifact: {
    pdf: { path: string; sha256: string }
    appendix_json: { path: string; sha256: string }
    appendix_markdown: { path: string; sha256: string }
  }
  completeness: {
    structural_rows: number
    section_rows: number
    equipment_item_rows: number
    source_declared_child_rows: number
    top_level_item_rows: number
    footnotes: number
    multiline_quota_items: number
  }
}

const artifactDirectory = join(process.cwd(), "docs/device-quota/source-artifacts/thong-tu-10-2026")

/** Repository-owned source manifest fixture for the export tests. */
export const sourceManifest = JSON.parse(
  readFileSync(join(artifactDirectory, "manifest.json"), "utf8")
) as SourceManifest

/** Repository-owned appendix fixture for the export tests. */
export const sourceAppendix = JSON.parse(
  readFileSync(join(artifactDirectory, "thong-tu-10-2026-appendix.json"), "utf8")
) as SourceAppendix

function makeCatalog(): DeviceQuotaRegulatoryCatalog {
  const rows: DeviceQuotaRegulatoryCatalogRow[] = sourceAppendix.rows.map((row, index) => ({
    id: row.id,
    sourceLabel: row.tt,
    type: row.type,
    level: row.level,
    parentSourceIdentifier: row.parent,
    name: row.name,
    regulatoryUnit: row.unit,
    quotaLines: row.quota,
    sourcePages: row.source_pages,
    sourceReference: row.source_ref,
    sourceOrder: index + 1,
  }))

  return {
    document: {
      documentNumber: sourceManifest.document_number,
      documentTitle: "Thông tư 10/2026/TT-BYT",
      appendixTitle: sourceAppendix.document_title,
      documentVersion: sourceManifest.extraction_revision,
      issuedDate: "2026-05-14",
      effectiveDate: "2026-07-01",
      sourcePdfPath: sourceManifest.source_artifact.pdf.path,
      sourcePdfSha256: sourceManifest.source_artifact.pdf.sha256,
    },
    catalogVersion: {
      artifactId: sourceManifest.artifact_id,
      appendixJsonPath: sourceManifest.source_artifact.appendix_json.path,
      appendixJsonSha256: sourceManifest.source_artifact.appendix_json.sha256,
      appendixMarkdownPath: sourceManifest.source_artifact.appendix_markdown.path,
      appendixMarkdownSha256: sourceManifest.source_artifact.appendix_markdown.sha256,
      extractionRevision: sourceManifest.extraction_revision,
      importStatus: "ready",
      isCanonical: true,
      sourcePages: "6-12",
      sourceNote: "Repository-owned source freeze",
    },
    completeness: {
      structuralRows: sourceManifest.completeness.structural_rows,
      sectionRows: sourceManifest.completeness.section_rows,
      equipmentItemRows: sourceManifest.completeness.equipment_item_rows,
      sourceDeclaredChildRows: sourceManifest.completeness.source_declared_child_rows,
      topLevelItemRows: sourceManifest.completeness.top_level_item_rows,
      ruleLines: sourceAppendix.rows.reduce((total, row) => total + (row.quota?.length ?? 0), 0),
      footnotes: sourceManifest.completeness.footnotes,
      itemsWithSourcePages: sourceAppendix.rows.filter((row) => row.type === "item").length,
      itemsWithSourceReferences: sourceAppendix.rows.filter((row) => row.type === "item").length,
      multilineQuotaItems: sourceManifest.completeness.multiline_quota_items,
    },
    rows,
    footnotes: sourceAppendix.footnotes,
  }
}

function makeDraftItems(): DeviceQuotaDraftItem[] {
  return sourceAppendix.rows
    .filter((row): row is SourceRow & { type: "item" } => row.type === "item")
    .map((row) => ({
      id: `draft-${row.id}`,
      regulatory_item_id: row.id,
      display_name_override: row.id === "1a" ? "Tên đề xuất khác" : null,
      applied_unit: row.id === "1a" ? null : row.unit,
      applied_quantity: row.id === "1a" ? null : row.id === "1b" ? 0 : 1,
      notes: row.id === "5a" ? `Ghi chú cũ ${DEVICE_QUOTA_DRAFT_EXPORT_MARKER}` : null,
      is_excluded: row.id === "5a",
      display_order: sourceAppendix.rows.findIndex((source) => source.id === row.id) + 1,
      source_identifier: row.id,
      source_label: row.tt,
      regulatory_name: row.name,
      regulatory_unit: row.unit ?? "",
      regulatory_quota_lines: row.quota ?? [],
      regulatory_rules: (row.quota ?? []).map((sourceText, index) => ({
        line_order: index + 1,
        source_text: sourceText,
      })),
    }))
}

/** Creates the complete repository fixture snapshot used by export tests. */
export function makeSnapshot(): DeviceQuotaDraftCatalogExportSnapshot {
  const catalog = makeCatalog()
  const rows = mergeDeviceQuotaDraftCatalog(catalog, { items: makeDraftItems() }, "editable")

  return {
    unitId: 23,
    unitName: "Bệnh viện Đa khoa Nam Phương",
    userId: "user-phase-2",
    draftStatus: "draft",
    revision: 4,
    lastSavedAt: "2026-09-01T08:30:00.000Z",
    documentNumber: sourceManifest.document_number,
    documentVersion: sourceManifest.extraction_revision,
    appendixTitle: sourceAppendix.document_title,
    sourcePdfMarker: sourceManifest.source_artifact.pdf.path,
    sourcePdfSha256: sourceManifest.source_artifact.pdf.sha256,
    catalogVersionId: sourceManifest.artifact_id,
    rows,
    footnotes: sourceAppendix.footnotes,
  }
}

/** Maps a source row id to its worksheet data-row number. */
export function rowNumberForSourceId(sourceId: string): number {
  const index = sourceAppendix.rows.findIndex((row) => row.id === sourceId)
  if (index < 0) throw new Error(`Missing fixture row ${sourceId}`)
  return 10 + index
}

/** Serializes and reloads a snapshot through the real ExcelJS workbook helper. */
export async function loadWorkbook(snapshot: DeviceQuotaDraftCatalogExportSnapshot) {
  const buffer = await serializeDeviceQuotaDraftCatalogWorkbook(snapshot)
  const workbook = await createExcelWorkbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

/** Normalizes XLSX archive entry dates so the committed sample is byte-stable. */
export async function normalizeDraftExportArchive(buffer: Uint8Array): Promise<Uint8Array> {
  const archive = await JSZip.loadAsync(buffer)
  const fixedArchiveDate = new Date("2000-01-01T00:00:00.000Z")
  Object.values(archive.files).forEach((entry) => {
    entry.date = fixedArchiveDate
  })
  return archive.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    platform: "DOS",
  })
}
