import type { TechnicalConfigurationBaselineDecodedDraft } from "./baseline-types"
import { BASELINE_WORKBOOK_MIME_TYPE } from "./technical-configuration-baseline-import-utils"
import { downloadBlob } from "@/lib/excel-workbook"
import {
  createTechnicalConfigurationBaselineWorkbookV2Model,
  type TechnicalConfigurationBaselineWorkbookV2CriterionSource,
  type TechnicalConfigurationBaselineWorkbookV2GroupSource,
} from "@/lib/technical-configuration-baseline-excel-v2-contract"
import { serializeTechnicalConfigurationBaselineWorkbookV2 } from "@/lib/technical-configuration-baseline-excel-v2-export"

export type TechnicalConfigurationBaselineDownloadIntent = "current-data" | "blank-template"

function toWorkbookCriterion(
  criterion: TechnicalConfigurationBaselineDecodedDraft["groups"][number]["criteria"][number]
): TechnicalConfigurationBaselineWorkbookV2CriterionSource {
  return {
    id: criterion.id,
    criterion_code: criterion.criterion_code,
    title: criterion.title,
    requirement_text: criterion.requirement_text,
  }
}

function toWorkbookGroups(
  version: TechnicalConfigurationBaselineDecodedDraft
): TechnicalConfigurationBaselineWorkbookV2GroupSource[] {
  return version.groups.map((group) => ({
    id: group.id,
    name: group.name,
    criteria: group.criteria.map(toWorkbookCriterion),
    subgroups: group.subgroups.map((subgroup) => ({
      id: subgroup.id,
      name: subgroup.name,
      criteria: subgroup.criteria.map(toWorkbookCriterion),
    })),
  }))
}

function getFilename(
  intent: TechnicalConfigurationBaselineDownloadIntent,
  versionNumber: number
): string {
  return intent === "current-data"
    ? `Cau_Hinh_Co_So_Hien_Tai_Phien_Ban_${versionNumber}.xlsx`
    : `Mau_Cau_Hinh_Co_So_Trong_Phien_Ban_${versionNumber}.xlsx`
}

/** Generates and downloads one XLSX v2 workbook bound to the selected draft revision. */
export async function downloadTechnicalConfigurationBaselineWorkbookV2({
  version,
  intent,
}: {
  version: TechnicalConfigurationBaselineDecodedDraft
  intent: TechnicalConfigurationBaselineDownloadIntent
}): Promise<void> {
  const metadata = {
    dossier_id: version.dossier_id,
    baseline_version_id: version.id,
    baseline_revision: version.revision,
    generated_at: new Date().toISOString(),
  }
  const model = createTechnicalConfigurationBaselineWorkbookV2Model(
    intent === "current-data"
      ? {
          intent,
          metadata,
          groups: toWorkbookGroups(version),
        }
      : {
          intent,
          metadata,
        }
  )
  const buffer = await serializeTechnicalConfigurationBaselineWorkbookV2(model)

  downloadBlob(
    new Blob([buffer], { type: BASELINE_WORKBOOK_MIME_TYPE }),
    getFilename(intent, version.version_number)
  )
}
