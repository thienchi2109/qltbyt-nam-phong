import "@testing-library/jest-dom"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import {
  createAuthoritativeHierarchyPreview,
  createHierarchyDraft,
  createHierarchyImportFile,
  createHierarchyPreview,
  createLegacyParseResult,
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

describe("technical configuration baseline hierarchy import UX", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    compatibleParser.parseFile.mockResolvedValue(createV2ParseResult())
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValue(createHierarchyPreview())
    hierarchyImportRpc.applyHierarchyImport.mockResolvedValue({
      data: createHierarchyDraft({ revision: 12 }),
    })
  })

  it("accepts only .xlsx and routes v2 workbooks through the compatible parser boundary", async () => {
    const user = userEvent.setup()
    const version = createHierarchyDraft()
    render(<HierarchyImportHarness version={version} />)

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
    const input = screen.getByLabelText("Chọn workbook cấu hình phân cấp")
    expect(input).toHaveAttribute("accept", ".xlsx")

    const file = createHierarchyImportFile()
    await user.upload(input, file)

    await waitFor(() => {
      expect(compatibleParser.parseFile).toHaveBeenCalledWith(file, {
        existingHierarchy: {
          groups: [{ id: "group-1" }],
          subgroups: [{ id: "subgroup-1", group_id: "group-1" }],
          criteria: [
            {
              id: "criterion-1",
              criterion_code: "TC-0001",
              title: "Nguồn điện",
              group_id: "group-1",
              subgroup_id: null,
            },
            {
              id: "criterion-2",
              criterion_code: "TC-0002",
              title: "Nhiệt độ",
              group_id: "group-1",
              subgroup_id: "subgroup-1",
            },
          ],
        },
      })
    })
    expect(hierarchyImportRpc.previewHierarchyImport).toHaveBeenCalledWith({
      p_baseline_version_id: "draft-1",
      p_template_metadata: createV2ParseResult().metadata,
      p_rows: [
        {
          row: 2,
          stt: "I",
          content: "Yêu cầu chung",
          group_id: "group-1",
          subgroup_id: null,
          criterion_id: null,
          criterion_code: null,
        },
        {
          row: 3,
          stt: "1",
          content: "Điều kiện vận hành",
          group_id: null,
          subgroup_id: "subgroup-1",
          criterion_id: null,
          criterion_code: null,
        },
        {
          row: 4,
          stt: null,
          content: "Hoạt động ổn định ở 18-30°C",
          group_id: null,
          subgroup_id: null,
          criterion_id: "criterion-2",
          criterion_code: "TC-0002",
        },
      ],
      p_expected_revision: 11,
    })
  })

  it("maps legacy groups to main sections and legacy criteria to direct children", async () => {
    const user = userEvent.setup()
    compatibleParser.parseFile.mockResolvedValueOnce(createLegacyParseResult())
    render(<HierarchyImportHarness />)

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile("baseline-legacy.xlsx")
    )

    await waitFor(() => {
      expect(hierarchyImportRpc.previewHierarchyImport).toHaveBeenCalledWith({
        p_baseline_version_id: "draft-1",
        p_template_metadata: {
          template_kind: "technical_configuration_baseline",
          template_version: 2,
          dossier_id: "dossier-1",
          baseline_version_id: "draft-1",
          baseline_revision: 11,
          generated_at: "2026-08-10T00:00:00.000Z",
        },
        p_rows: [
          {
            row: 2,
            stt: "I",
            content: "Yêu cầu chung",
            group_id: "group-1",
            subgroup_id: null,
            criterion_id: null,
            criterion_code: null,
          },
          {
            row: 4,
            stt: null,
            content: "Chuyển thành tiêu chí trực tiếp",
            group_id: null,
            subgroup_id: null,
            criterion_id: "criterion-2",
            criterion_code: "TC-0002",
          },
        ],
        p_expected_revision: 11,
      })
    })
  })

  it.each([
    {
      file: createHierarchyImportFile("baseline.xls"),
      message: "Chỉ chấp nhận file .xlsx do hệ thống phát hành.",
    },
    {
      file: createHierarchyImportFile("baseline.csv"),
      message: "Chỉ chấp nhận file .xlsx do hệ thống phát hành.",
    },
    {
      file: createHierarchyImportFile("oversized.xlsx", 5 * 1024 * 1024 + 1),
      message: "File XLSX có 5242881 byte, vượt giới hạn 5242880 byte (5 MiB).",
    },
  ])(
    "shows compatible-parser rejection for $file.name without calling RPCs",
    async ({ file, message }) => {
      const user = userEvent.setup()
      compatibleParser.parseFile.mockRejectedValueOnce(new Error(message))
      render(<HierarchyImportHarness />)

      await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
      fireEvent.change(screen.getByLabelText("Chọn workbook cấu hình phân cấp"), {
        target: { files: [file] },
      })

      const alert = await screen.findByRole("alert", { name: "Lỗi nhập cấu hình phân cấp" })
      await waitFor(() => expect(alert).toHaveTextContent(message))
      expect(compatibleParser.parseFile).toHaveBeenCalledWith(file, expect.any(Object))
      expect(hierarchyImportRpc.previewHierarchyImport).not.toHaveBeenCalled()
      expect(hierarchyImportRpc.applyHierarchyImport).not.toHaveBeenCalled()
    }
  )

  it("blocks applying the previous preview when a replacement upload fails", async () => {
    const user = userEvent.setup()
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValueOnce(
      createAuthoritativeHierarchyPreview()
    )
    render(<HierarchyImportHarness />)

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile()
    )
    await screen.findByRole("group", { name: "Xác nhận thay thế toàn bộ cấu hình" })
    compatibleParser.parseFile.mockRejectedValueOnce(new Error("replacement parse failed"))

    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile("replacement-invalid.xlsx")
    )

    await screen.findByText("replacement parse failed")
    expect(screen.getByText("baseline-v2.xlsx")).toBeInTheDocument()
    expect(screen.getByText("Mục chính từ máy chủ")).toBeInTheDocument()
    expect(
      screen.getByRole("checkbox", {
        name: "Tôi hiểu các mục bị thiếu trong workbook sẽ bị xóa",
      })
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })).toBeDisabled()
    expect(hierarchyImportRpc.applyHierarchyImport).not.toHaveBeenCalled()
  })

  it("renders only the authoritative server hierarchy, counts, and entity effects", async () => {
    const user = userEvent.setup()
    const parsed = createV2ParseResult()
    parsed.rows[0] = {
      ...parsed.rows[0],
      group_name: "Mục chính chỉ có ở parser",
    }
    compatibleParser.parseFile.mockResolvedValueOnce(parsed)
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValueOnce(
      createAuthoritativeHierarchyPreview()
    )
    render(<HierarchyImportHarness />)

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile()
    )

    expect(await screen.findByText("Mục chính từ máy chủ")).toBeInTheDocument()
    expect(screen.getByText("Nhóm con từ máy chủ")).toBeInTheDocument()
    expect(screen.getByText("Nội dung chuẩn hóa từ máy chủ")).toBeInTheDocument()
    expect(screen.queryByText("Mục chính chỉ có ở parser")).not.toBeInTheDocument()

    const counts = screen.getByRole("region", { name: "Số lượng cấu hình phân cấp" })
    expect(counts).toHaveTextContent(/Mục chính\s*1/)
    expect(counts).toHaveTextContent(/Nhóm con\s*1/)
    expect(counts).toHaveTextContent(/Tiêu chí\s*1/)

    const effects = screen.getByRole("region", { name: "Tác động thay thế cấu hình" })
    expect(effects).toHaveTextContent(/Mục chính\s*1\s*2\s*3\s*4/)
    expect(effects).toHaveTextContent(/Nhóm con\s*5\s*6\s*7\s*8/)
    expect(effects).toHaveTextContent(/Tiêu chí\s*9\s*10\s*11\s*12/)
  })

  it("requires explicit full-replacement confirmation with authoritative deletion counts", async () => {
    const user = userEvent.setup()
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValueOnce(
      createAuthoritativeHierarchyPreview()
    )
    render(<HierarchyImportHarness />)

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile()
    )

    const confirmation = await screen.findByRole("group", {
      name: "Xác nhận thay thế toàn bộ cấu hình",
    })
    expect(confirmation).toHaveTextContent(
      "Import sẽ thay thế toàn bộ cấu hình của baseline draft hiện tại."
    )
    expect(confirmation).toHaveTextContent("Xóa 4 mục chính, 8 nhóm con và 12 tiêu chí.")

    const checkbox = screen.getByRole("checkbox", {
      name: "Tôi hiểu các mục bị thiếu trong workbook sẽ bị xóa",
    })
    const applyButton = screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })
    expect(checkbox).not.toBeChecked()
    expect(applyButton).toBeDisabled()

    await user.click(checkbox)
    expect(applyButton).toBeEnabled()
  })

  it("renders actionable physical-row errors and prevents apply", async () => {
    const user = userEvent.setup()
    const preview = createAuthoritativeHierarchyPreview()
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValueOnce({
      ...preview,
      data: {
        ...preview.data,
        effects: null,
      },
      errors: [
        {
          row: 27,
          code: "empty_content",
          column: "content",
          message: "Nội dung bắt buộc không được để trống.",
        },
      ],
    })
    render(<HierarchyImportHarness />)

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile()
    )

    const alert = await screen.findByRole("alert", {
      name: "Lỗi bản xem trước cấu hình phân cấp",
    })
    expect(alert).toHaveTextContent("Dòng 27 · content: Nội dung bắt buộc không được để trống.")
    expect(
      screen.queryByRole("group", { name: "Xác nhận thay thế toàn bộ cấu hình" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })).toBeDisabled()
    expect(hierarchyImportRpc.applyHierarchyImport).not.toHaveBeenCalled()
  })
})
