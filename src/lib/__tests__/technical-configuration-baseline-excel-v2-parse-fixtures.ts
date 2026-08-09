import { expect } from "vitest"

import {
  createTechnicalConfigurationBaselineWorkbookV2,
  serializeTechnicalConfigurationBaselineWorkbookV2,
} from "@/lib/technical-configuration-baseline-excel-v2-export"
import {
  parseTechnicalConfigurationBaselineWorkbookFile,
  TechnicalConfigurationBaselineWorkbookV2Error,
  type TechnicalConfigurationBaselineWorkbookCompatibleParseResult,
  type TechnicalConfigurationBaselineWorkbookV2ExistingHierarchy,
  type TechnicalConfigurationBaselineWorkbookV2ParseResult,
} from "@/lib/technical-configuration-baseline-excel-v2-parse"
import {
  createTechnicalConfigurationBaselineWorkbookV2Model,
  type TechnicalConfigurationBaselineWorkbookV2GroupSource,
} from "@/lib/technical-configuration-baseline-excel-v2-contract"

export const METADATA = {
  dossier_id: "dossier-1",
  baseline_version_id: "baseline-version-1",
  baseline_revision: 7,
  generated_at: "2026-08-09T10:15:00.000Z",
} as const

export const CURRENT_DATA_GROUPS: readonly TechnicalConfigurationBaselineWorkbookV2GroupSource[] = [
  {
    id: "section-1",
    name: "Yêu cầu chung",
    criteria: [
      {
        id: "criterion-direct",
        criterion_code: "TC-001",
        title: "Tiêu đề trực tiếp",
        requirement_text: "Tiêu chí trực tiếp",
      },
    ],
    subgroups: [
      {
        id: "subgroup-1",
        name: "Điều kiện vận hành",
        criteria: [
          {
            id: "criterion-subgroup",
            criterion_code: "TC-002",
            title: "Tiêu đề nhóm con",
            requirement_text: "Hoạt động ổn định ở 40 °C",
          },
        ],
      },
    ],
  },
  {
    id: "section-2",
    name: "Yêu cầu khác",
    criteria: [],
    subgroups: [],
  },
]

export const EXISTING_HIERARCHY: TechnicalConfigurationBaselineWorkbookV2ExistingHierarchy = {
  groups: CURRENT_DATA_GROUPS.map((group) => ({ id: group.id })),
  subgroups: CURRENT_DATA_GROUPS.flatMap((group) =>
    group.subgroups.map((subgroup) => ({
      id: subgroup.id,
      group_id: group.id,
    }))
  ),
  criteria: CURRENT_DATA_GROUPS.flatMap((group) => [
    ...group.criteria.map((criterion) => ({
      id: criterion.id,
      criterion_code: criterion.criterion_code,
      title: criterion.title,
      group_id: group.id,
      subgroup_id: null,
    })),
    ...group.subgroups.flatMap((subgroup) =>
      subgroup.criteria.map((criterion) => ({
        id: criterion.id,
        criterion_code: criterion.criterion_code,
        title: criterion.title,
        group_id: group.id,
        subgroup_id: subgroup.id,
      }))
    ),
  ]),
}

export function expectWorkbookV2Result(
  result: TechnicalConfigurationBaselineWorkbookCompatibleParseResult
): asserts result is TechnicalConfigurationBaselineWorkbookV2ParseResult {
  expect(result.format).toBe("v2")
  if (result.format !== "v2") {
    throw new Error(`Expected XLSX v2 parse result, received ${result.format}`)
  }
}

export function toUploadedFile(bytes: ArrayBuffer | Uint8Array, name: string): File {
  const copy = new Uint8Array(bytes)
  return {
    name,
    size: copy.byteLength,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    arrayBuffer: async () => copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
  } as File
}

export async function toXlsxFile(
  model: ReturnType<typeof createTechnicalConfigurationBaselineWorkbookV2Model>,
  name = "baseline.xlsx"
): Promise<File> {
  const bytes = await serializeTechnicalConfigurationBaselineWorkbookV2(model)
  return toUploadedFile(bytes, name)
}

export async function parseWorkbook(
  workbook: Awaited<ReturnType<typeof createTechnicalConfigurationBaselineWorkbookV2>>
) {
  const bytes = await workbook.xlsx.writeBuffer()
  return parseTechnicalConfigurationBaselineWorkbookFile(toUploadedFile(bytes, "baseline.xlsx"), {
    existingHierarchy: EXISTING_HIERARCHY,
  })
}

export async function expectWorkbookIssue(
  workbook: Awaited<ReturnType<typeof createTechnicalConfigurationBaselineWorkbookV2>>,
  expected: { code: string; row: number; column?: string }
) {
  try {
    await parseWorkbook(workbook)
    throw new Error("Expected workbook parsing to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(TechnicalConfigurationBaselineWorkbookV2Error)
    expect((error as TechnicalConfigurationBaselineWorkbookV2Error).issues).toEqual(
      expect.arrayContaining([expect.objectContaining(expected)])
    )
  }
}

export function createWorkbookSheet(
  workbook: Awaited<ReturnType<typeof createTechnicalConfigurationBaselineWorkbookV2>>
) {
  return workbook.getWorksheet("Nhập cấu hình")!
}
