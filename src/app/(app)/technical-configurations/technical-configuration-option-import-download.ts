import type { TechnicalConfigurationBaselineDraftWire } from "./baseline-types"
import {
  OPTION_WORKBOOK_MIME_TYPE,
  toTechnicalConfigurationOptionWorkbookRows,
} from "./technical-configuration-option-import-state"
import type {
  TechnicalConfigurationComparisonSetWire,
  TechnicalConfigurationOptionWire,
} from "./supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "./types"
import { downloadBlob } from "@/lib/excel-workbook"
import {
  OPTION_WORKBOOK_TEMPLATE_KIND,
  OPTION_WORKBOOK_TEMPLATE_VERSION,
} from "@/lib/technical-configuration-option-excel-contract"
import { createTechnicalConfigurationOptionWorkbook } from "@/lib/technical-configuration-option-excel-export"

/** Downloads one exact-baseline supplier-option response snapshot through the P9A1 codec. */
export async function downloadTechnicalConfigurationOptionTemplate({
  dossier,
  option,
  baselineVersion,
  comparisonSet,
  revision,
}: {
  dossier: TechnicalConfigurationDossierWire
  option: TechnicalConfigurationOptionWire
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  comparisonSet: TechnicalConfigurationComparisonSetWire | null
  revision: number
}) {
  const workbook = await createTechnicalConfigurationOptionWorkbook({
    metadata: {
      template_kind: OPTION_WORKBOOK_TEMPLATE_KIND,
      template_version: OPTION_WORKBOOK_TEMPLATE_VERSION,
      dossier_id: dossier.id,
      option_id: option.id,
      baseline_version_id: baselineVersion.id,
      dossier_revision: revision,
      generated_at: new Date().toISOString(),
    },
    rows: toTechnicalConfigurationOptionWorkbookRows(baselineVersion, comparisonSet),
  })
  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: OPTION_WORKBOOK_MIME_TYPE }),
    `Mau_Phan_Hoi_Phuong_An_Phien_Ban_${baselineVersion.version_number}.xlsx`
  )
}
