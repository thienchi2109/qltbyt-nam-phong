import { describe, expect, it } from "vitest"

import {
  buildTechnicalConfigurationBaselineWorkbookFilename,
  normalizeTechnicalConfigurationBaselineFilenameSegment,
} from "../technical-configuration-baseline-filename"

describe("technical configuration baseline workbook filename", () => {
  it("normalizes Vietnamese text and forbidden separators to ASCII-safe segments", () => {
    expect(normalizeTechnicalConfigurationBaselineFilenameSegment("Đầu dò / siêu âm")).toBe(
      "Dau_do_sieu_am"
    )
  })

  it("uses the contract fallbacks and caps each dynamic segment at 60 ASCII characters", () => {
    const filename = buildTechnicalConfigurationBaselineWorkbookFilename({
      intent: "current-data",
      deviceTypeName: "***",
      dossierName: "Hồ sơ ".repeat(30),
      versionNumber: 12,
    })

    expect(filename).toMatch(/^Thiet_Bi_/)
    expect(filename.endsWith("_Phien_Ban_12.xlsx")).toBe(true)
    expect(filename.length).toBeLessThanOrEqual(160)
    expect(filename.split("_Phien_Ban_")[0]?.split("_").join("_").length).toBeLessThanOrEqual(130)
  })

  it("generates identifiable current and blank-template names", () => {
    const input = {
      deviceTypeName: "Máy lọc thận",
      dossierName: "Hồ sơ khu A",
      versionNumber: 3,
    }

    expect(
      buildTechnicalConfigurationBaselineWorkbookFilename({ ...input, intent: "current-data" })
    ).toBe("May_loc_than_Ho_so_khu_A_Phien_Ban_3.xlsx")
    expect(
      buildTechnicalConfigurationBaselineWorkbookFilename({ ...input, intent: "blank-template" })
    ).toBe("Mau_May_loc_than_Ho_so_khu_A_Phien_Ban_3.xlsx")
  })
})
