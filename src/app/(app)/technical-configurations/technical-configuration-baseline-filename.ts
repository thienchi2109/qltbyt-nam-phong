import type { TechnicalConfigurationBaselineDownloadIntent } from "./technical-configuration-baseline-download"

const MAX_DYNAMIC_SEGMENT_LENGTH = 60
const MAX_FILENAME_LENGTH = 160

/** Normalizes one bounded, filesystem-safe dynamic workbook filename segment. */
export function normalizeTechnicalConfigurationBaselineFilenameSegment(
  value: string,
  fallback = ""
): string {
  const normalized = value
    .replaceAll("Đ", "D")
    .replaceAll("đ", "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_DYNAMIC_SEGMENT_LENGTH)
    .replace(/_+$/g, "")

  return normalized || fallback
}

/** Builds the current-data or blank-template baseline workbook filename. */
export function buildTechnicalConfigurationBaselineWorkbookFilename({
  intent,
  deviceTypeName,
  dossierName,
  versionNumber,
}: {
  intent: TechnicalConfigurationBaselineDownloadIntent
  deviceTypeName: string
  dossierName: string
  versionNumber: number
}): string {
  const deviceType = normalizeTechnicalConfigurationBaselineFilenameSegment(
    deviceTypeName,
    "Thiet_Bi"
  )
  const dossier = normalizeTechnicalConfigurationBaselineFilenameSegment(dossierName, "Ho_So")
  const prefix = intent === "blank-template" ? "Mau_" : ""
  const suffix = `_Phien_Ban_${versionNumber}.xlsx`
  const filename = `${prefix}${deviceType}_${dossier}${suffix}`

  if (filename.length <= MAX_FILENAME_LENGTH) return filename

  const availableDossierLength = Math.max(
    1,
    MAX_FILENAME_LENGTH - prefix.length - deviceType.length - suffix.length - 1
  )
  return `${prefix}${deviceType}_${dossier.slice(0, availableDossierLength).replace(/_+$/g, "")}${suffix}`
}
