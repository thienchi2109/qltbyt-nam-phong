import { describe, expect, it } from "vitest"

import {
  createHierarchyDraft,
  createV2ParseResult,
} from "./technical-configuration-baseline-hierarchy-import-fixtures"
import { toTechnicalConfigurationBaselineHierarchyImportRpcArgs } from "@/app/(app)/technical-configurations/technical-configuration-baseline-hierarchy-import"
import {
  BASELINE_WORKBOOK_V2_CONFIGURATION_SHEET_NAME,
  BASELINE_WORKBOOK_V2_TEMPLATE_KIND,
  BASELINE_WORKBOOK_V2_TEMPLATE_VERSION,
  createTechnicalConfigurationBaselineWorkbookV2Model,
} from "@/lib/technical-configuration-baseline-excel-v2-contract"
import { createTechnicalConfigurationBaselineWorkbookV2 } from "@/lib/technical-configuration-baseline-excel-v2-export"
import {
  parseTechnicalConfigurationBaselineWorkbookFile,
  type TechnicalConfigurationBaselineWorkbookV2ParseResult,
} from "@/lib/technical-configuration-baseline-excel-v2-parse"

const SOURCE_METADATA_INPUT = {
  dossier_id: "source-dossier",
  baseline_version_id: "source-draft",
  baseline_revision: 2,
  generated_at: "2026-08-21T08:30:00.000Z",
} as const

const SOURCE_PARSED_METADATA = {
  template_kind: BASELINE_WORKBOOK_V2_TEMPLATE_KIND,
  template_version: BASELINE_WORKBOOK_V2_TEMPLATE_VERSION,
  ...SOURCE_METADATA_INPUT,
} as const

const TARGET_DRAFT = createHierarchyDraft({
  id: "target-draft",
  dossier_id: "target-dossier",
  revision: 0,
  groups: [],
})

type SupportedIdentityField = "group_id" | "subgroup_id" | "criterion_id" | "criterion_code"

function createContentOnlyV2ParseResult(): TechnicalConfigurationBaselineWorkbookV2ParseResult {
  const parsed = createV2ParseResult()
  parsed.metadata = SOURCE_PARSED_METADATA
  parsed.rows = [
    {
      row: 2,
      row_type: "GROUP",
      group_order: 1,
      group_id: null,
      group_name: "Yêu cầu chung",
    },
    {
      row: 3,
      row_type: "SUBGROUP",
      group_order: 1,
      subgroup_order: 1,
      subgroup_id: null,
      subgroup_name: "Điều kiện vận hành",
    },
    {
      row: 4,
      row_type: "CRITERION",
      group_order: 1,
      subgroup_order: 1,
      criterion_order: 1,
      criterion_id: null,
      criterion_code: null,
      criterion_title: null,
      requirement_text: "Hoạt động ổn định ở 18-30°C",
    },
  ]
  return parsed
}

function createV2ParseResultWithIdentity(
  identity: SupportedIdentityField
): TechnicalConfigurationBaselineWorkbookV2ParseResult {
  const parsed = createContentOnlyV2ParseResult()
  parsed.rows = parsed.rows.map((row) => {
    if (identity === "group_id" && row.row_type === "GROUP") {
      return { ...row, group_id: "source-group" }
    }
    if (identity === "subgroup_id" && row.row_type === "SUBGROUP") {
      return { ...row, subgroup_id: "source-subgroup" }
    }
    if (identity === "criterion_id" && row.row_type === "CRITERION") {
      return { ...row, criterion_id: "source-criterion" }
    }
    if (identity === "criterion_code" && row.row_type === "CRITERION") {
      return { ...row, criterion_code: "TC-SOURCE" }
    }
    return row
  })
  return parsed
}

function toUploadedFile(bytes: ArrayBuffer | Uint8Array): File {
  const copy = new Uint8Array(bytes)
  return {
    name: "blank-template-from-source.xlsx",
    size: copy.byteLength,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    arrayBuffer: async () => copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
  } as File
}

describe("technical configuration baseline blank-template portability", () => {
  it("rebinds a real content-only V2 blank template to the selected target draft", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "blank-template",
        metadata: SOURCE_METADATA_INPUT,
      })
    )
    const configuration = workbook.getWorksheet(BASELINE_WORKBOOK_V2_CONFIGURATION_SHEET_NAME)
    expect(configuration).toBeDefined()
    if (!configuration) {
      throw new Error("Expected the V2 configuration worksheet")
    }

    configuration.getCell("A2").value = "I"
    configuration.getCell("B2").value = "Yêu cầu chung"
    configuration.getCell("B3").value = "Hoạt động ổn định ở 18-30°C"

    const bytes = await workbook.xlsx.writeBuffer()
    const parsed = await parseTechnicalConfigurationBaselineWorkbookFile(toUploadedFile(bytes), {
      existingHierarchy: {
        groups: [],
        subgroups: [],
        criteria: [],
      },
    })
    expect(parsed.format).toBe("v2")
    if (parsed.format !== "v2") {
      throw new Error(`Expected XLSX v2 parse result, received ${parsed.format}`)
    }

    expect(parsed.metadata).toEqual(SOURCE_PARSED_METADATA)
    expect(parsed.rows).toEqual([
      {
        row: 2,
        row_type: "GROUP",
        group_order: 1,
        group_id: null,
        group_name: "Yêu cầu chung",
      },
      {
        row: 3,
        row_type: "CRITERION",
        group_order: 1,
        subgroup_order: null,
        criterion_order: 1,
        criterion_id: null,
        criterion_code: null,
        criterion_title: null,
        requirement_text: "Hoạt động ổn định ở 18-30°C",
      },
    ])

    const args = toTechnicalConfigurationBaselineHierarchyImportRpcArgs(parsed, TARGET_DRAFT)

    expect(args.p_template_metadata).toEqual({
      template_kind: BASELINE_WORKBOOK_V2_TEMPLATE_KIND,
      template_version: BASELINE_WORKBOOK_V2_TEMPLATE_VERSION,
      dossier_id: "target-dossier",
      baseline_version_id: "target-draft",
      baseline_revision: 0,
      generated_at: SOURCE_METADATA_INPUT.generated_at,
    })
  })

  it.each([
    { identity: "group_id" },
    { identity: "subgroup_id" },
    { identity: "criterion_id" },
    { identity: "criterion_code" },
  ] as const)("keeps source metadata when any row contains $identity", ({ identity }) => {
    const parsed = createV2ParseResultWithIdentity(identity)

    const args = toTechnicalConfigurationBaselineHierarchyImportRpcArgs(parsed, TARGET_DRAFT)

    expect(args.p_template_metadata).toEqual(SOURCE_PARSED_METADATA)
  })
})
