import type { DeviceQuotaDraftCatalogExportSnapshot } from "./device-quota-draft-catalog-excel-export"

/** Validates the immutable saved snapshot before the workbook is rendered. */
export function validateDeviceQuotaDraftCatalogExportSnapshot(
  snapshot: DeviceQuotaDraftCatalogExportSnapshot
): void {
  if (!Number.isInteger(snapshot.unitId) || snapshot.unitId <= 0) throw new Error("Invalid unitId")
  if (!snapshot.unitName.trim() || !snapshot.userId.trim())
    throw new Error("Missing export identity")
  if (snapshot.draftStatus !== "draft") throw new Error("Only draft snapshots can be exported")
  if (!Number.isInteger(snapshot.revision) || snapshot.revision < 0)
    throw new Error("Invalid revision")
  if (Number.isNaN(Date.parse(snapshot.lastSavedAt))) throw new Error("Invalid lastSavedAt")
  if (
    !snapshot.documentNumber.trim() ||
    !snapshot.documentVersion.trim() ||
    !snapshot.appendixTitle.trim() ||
    !snapshot.sourcePdfMarker.trim() ||
    !snapshot.sourcePdfSha256.trim() ||
    !snapshot.catalogVersionId.trim()
  ) {
    throw new Error("Incomplete catalog metadata")
  }
  if (snapshot.rows.length !== 42) throw new Error("Draft snapshot must contain 42 catalog rows")
  const sectionCount = snapshot.rows.filter((row) => row.type === "section").length
  const itemCount = snapshot.rows.filter((row) => row.type === "item").length
  if (sectionCount !== 5 || itemCount !== 37) {
    throw new Error("Draft snapshot must contain 5 sections and 37 items")
  }
  const sourceIdentifiers = new Set(snapshot.rows.map((row) => row.sourceIdentifier))
  if (
    snapshot.rows.some(
      (row) =>
        row.parentSourceIdentifier !== null && !sourceIdentifiers.has(row.parentSourceIdentifier)
    )
  ) {
    throw new Error("Invalid source hierarchy")
  }
  if (
    snapshot.rows.some(
      (row) =>
        row.type === "item" &&
        row.appliedQuantity !== null &&
        (!Number.isInteger(row.appliedQuantity) || row.appliedQuantity < 0)
    )
  ) {
    throw new Error("Invalid applied quantity")
  }
  if (snapshot.footnotes.length !== 3) throw new Error("Draft snapshot must contain 3 footnotes")
  if (snapshot.footnotes.some((footnote) => !footnote.trim()))
    throw new Error("Footnotes cannot be blank")

  for (let index = 1; index < snapshot.rows.length; index += 1) {
    if (snapshot.rows[index - 1].sourceOrder >= snapshot.rows[index].sourceOrder) {
      throw new Error("Draft rows must preserve source order")
    }
  }
}
