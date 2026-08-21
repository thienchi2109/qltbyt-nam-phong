import "@testing-library/jest-dom"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import {
  createHierarchyDraft,
  createHierarchyImportFile,
  createHierarchyPreview,
  createV2ParseResult,
  HierarchyImportHarness,
} from "./technical-configuration-baseline-hierarchy-import-fixtures"

const hierarchyImportRpc = vi.hoisted(() => ({
  previewHierarchyImport: vi.fn(),
  applyHierarchyImport: vi.fn(),
}))

const compatibleParser = vi.hoisted(() => ({
  parseFile: vi.fn(),
}))

vi.mock("@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline", () => ({
  useTechnicalConfigurationBaseline: () => hierarchyImportRpc,
}))

vi.mock("@/lib/technical-configuration-baseline-excel-v2-parse", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/technical-configuration-baseline-excel-v2-parse")>()
  return {
    ...actual,
    parseTechnicalConfigurationBaselineWorkbookFile: compatibleParser.parseFile,
  }
})

describe("technical configuration baseline blank-template portability UI", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValue(createHierarchyPreview())
    hierarchyImportRpc.applyHierarchyImport.mockResolvedValue({
      data: createHierarchyDraft({ revision: 1 }),
    })
  })

  it("rebinds content-only V2 rows to the selected empty target draft", async () => {
    const user = userEvent.setup()
    const parsed = createV2ParseResult()
    parsed.metadata = {
      ...parsed.metadata,
      dossier_id: "source-dossier",
      baseline_version_id: "source-draft",
      baseline_revision: 2,
    }
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
        row_type: "CRITERION",
        group_order: 1,
        subgroup_order: null,
        criterion_order: 1,
        criterion_id: null,
        criterion_code: null,
        criterion_title: null,
        requirement_text: "Hoạt động ổn định ở 18-30°C",
      },
    ]
    compatibleParser.parseFile.mockResolvedValueOnce(parsed)

    const target = createHierarchyDraft({
      id: "target-draft",
      dossier_id: "target-dossier",
      revision: 0,
      groups: [],
    })
    render(<HierarchyImportHarness version={target} />)

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile("blank-template-from-source.xlsx")
    )

    await waitFor(() => {
      expect(hierarchyImportRpc.previewHierarchyImport).toHaveBeenCalledWith({
        p_baseline_version_id: "target-draft",
        p_template_metadata: {
          ...parsed.metadata,
          dossier_id: "target-dossier",
          baseline_version_id: "target-draft",
          baseline_revision: 0,
        },
        p_rows: [
          {
            row: 2,
            stt: "I",
            content: "Yêu cầu chung",
            group_id: null,
            subgroup_id: null,
            criterion_id: null,
            criterion_code: null,
          },
          {
            row: 3,
            stt: null,
            content: "Hoạt động ổn định ở 18-30°C",
            group_id: null,
            subgroup_id: null,
            criterion_id: null,
            criterion_code: null,
          },
        ],
        p_expected_revision: 0,
      })
    })
  })
})
