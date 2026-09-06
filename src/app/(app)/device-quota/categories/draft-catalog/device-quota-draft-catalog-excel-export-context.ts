import type { DeviceQuotaDraftItem } from "@/lib/device-quota-draft-contract"

import { isDeviceQuotaCatalogVersionCoherent } from "./device-quota-draft-catalog-types"
import type {
  DeviceQuotaDraftEditorMode,
  DeviceQuotaDraftSnapshot,
  DeviceQuotaMergedRow,
  DeviceQuotaRegulatoryCatalog,
} from "./device-quota-draft-catalog-types"
import { mergeDeviceQuotaDraftCatalog } from "./device-quota-draft-catalog-mappers"
import type { DeviceQuotaDraftCatalogExportContext } from "./device-quota-draft-catalog-excel-export"

/** Creates the internal export context from one accepted server draft/catalog pair. */
export function createDeviceQuotaDraftCatalogExportContext(input: {
  draft: DeviceQuotaDraftSnapshot
  catalog: DeviceQuotaRegulatoryCatalog
  rows: readonly DeviceQuotaMergedRow[]
  userId: string
  unitId: number
}): DeviceQuotaDraftCatalogExportContext | null {
  if (
    input.draft.don_vi !== input.unitId ||
    !isDeviceQuotaCatalogVersionCoherent(
      input.draft.catalog_version_id,
      input.catalog.catalogVersion.id
    )
  ) {
    return null
  }

  return {
    unitId: input.draft.don_vi,
    userId: input.userId,
    draftStatus: input.draft.status,
    revision: input.draft.revision,
    lastSavedAt: input.draft.updated_at,
    documentNumber: input.catalog.document.documentNumber,
    documentVersion: input.catalog.document.documentVersion,
    appendixTitle: input.catalog.document.appendixTitle,
    sourcePdfMarker: input.catalog.document.sourcePdfSha256,
    sourcePdfSha256: input.catalog.document.sourcePdfSha256,
    catalogVersionId: input.draft.catalog_version_id,
    rows: input.rows,
    footnotes: input.catalog.footnotes,
  }
}

/** Derives clean saved rows and their export context without reading staged values. */
export function createDeviceQuotaDraftCatalogSavedExport(
  canAccess: boolean,
  draft: DeviceQuotaDraftSnapshot | null,
  catalog: DeviceQuotaRegulatoryCatalog | null,
  serverItems: DeviceQuotaDraftItem[],
  mode: DeviceQuotaDraftEditorMode,
  userId: string | null,
  unitId: number | null
) {
  const hasCoherentCatalogIdentity = Boolean(
    draft &&
    catalog &&
    isDeviceQuotaCatalogVersionCoherent(draft.catalog_version_id, catalog.catalogVersion.id)
  )
  const lastSavedRows =
    hasCoherentCatalogIdentity && catalog && draft
      ? mergeDeviceQuotaDraftCatalog(catalog, { items: serverItems }, mode)
      : ([] as DeviceQuotaMergedRow[])
  const exportSnapshot =
    mode !== "readonly" &&
    canAccess &&
    userId !== null &&
    unitId !== null &&
    hasCoherentCatalogIdentity &&
    draft &&
    catalog
      ? createDeviceQuotaDraftCatalogExportContext({
          draft,
          catalog,
          rows: lastSavedRows,
          userId,
          unitId,
        })
      : null

  return { lastSavedRows, exportSnapshot }
}
