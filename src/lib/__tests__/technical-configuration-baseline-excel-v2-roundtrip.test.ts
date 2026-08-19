import { describe, expect, it } from "vitest"

import {
  CURRENT_DATA_GROUPS,
  METADATA,
  toUploadedFile,
} from "@/lib/__tests__/technical-configuration-baseline-excel-v2-parse-fixtures"
import { createTechnicalConfigurationBaselineWorkbookV2Model } from "@/lib/technical-configuration-baseline-excel-v2-contract"
import {
  createTechnicalConfigurationBaselineWorkbookV2,
  serializeTechnicalConfigurationBaselineWorkbookV2,
} from "@/lib/technical-configuration-baseline-excel-v2-export"
import {
  parseTechnicalConfigurationBaselineWorkbookFile,
  parseTechnicalConfigurationBaselineWorkbookV2,
  TechnicalConfigurationBaselineWorkbookV2Error,
} from "@/lib/technical-configuration-baseline-excel-v2-parse"

const emptyHierarchy = {
  groups: [],
  subgroups: [],
  criteria: [],
} as const

describe("technical configuration baseline XLSX v2 round-trip", () => {
  it("accepts real serialized current-workbook bytes without client membership authority", async () => {
    const model = createTechnicalConfigurationBaselineWorkbookV2Model({
      intent: "current-data",
      metadata: METADATA,
      groups: CURRENT_DATA_GROUPS,
    })
    const bytes = await serializeTechnicalConfigurationBaselineWorkbookV2(model)

    const result = await parseTechnicalConfigurationBaselineWorkbookFile(
      toUploadedFile(bytes, "current-baseline.xlsx"),
      { existingHierarchy: emptyHierarchy }
    )

    expect(result.format).toBe("v2")
    expect(result.rows).toHaveLength(5)
  })

  it("reports the structural root error without dependent missing-parent cascades", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    const configuration = workbook.getWorksheet("Nhập cấu hình")!
    configuration.getCell("E2").value = "criterion-on-section"

    try {
      await parseTechnicalConfigurationBaselineWorkbookV2(workbook, {
        existingHierarchy: emptyHierarchy,
      })
      throw new Error("Expected workbook validation to fail")
    } catch (error: unknown) {
      if (!(error instanceof TechnicalConfigurationBaselineWorkbookV2Error)) throw error
      expect(error.issues).toEqual([
        expect.objectContaining({
          code: "wrong_identity_kind",
          row: 2,
        }),
      ])
    }
  })
})
