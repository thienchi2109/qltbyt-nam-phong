import "@testing-library/jest-dom"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createBaselineImportFile,
  createBaselineImportPayload,
  createBaselineImportPreview,
  createDraft,
  createLockedVersion,
  dossier,
  getBaselineImportCodecMock,
  getBaselineRpcMock,
  mockVersions,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()
const codec = getBaselineImportCodecMock()

describe("technical configuration baseline import dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    codec.readExcelFile.mockResolvedValue({
      SheetNames: ["Baseline", "_meta"],
      Sheets: {},
      _workbook: {},
    })
    codec.parseWorkbook.mockResolvedValue([createBaselineImportPayload()])
    codec.createWorkbook.mockResolvedValue({
      xlsx: {
        writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      },
    })
    rpc.previewImport.mockResolvedValue(createBaselineImportPreview())
  })

  it("renders import actions only for the selected draft and delegates template download", async () => {
    const user = userEvent.setup()
    const draft = createDraft()
    mockVersions([draft])

    const view = renderTab()

    expect(await screen.findByRole("button", { name: "Tải template Excel" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Nhập từ Excel" })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Tải template Excel" }))

    await waitFor(() =>
      expect(codec.createWorkbook).toHaveBeenCalledWith({
        metadata: {
          template_kind: "technical_configuration_baseline",
          template_version: 1,
          dossier_id: dossier.id,
          baseline_version_id: draft.id,
          baseline_revision: draft.revision,
          generated_at: expect.any(String),
        },
        rows: [
          {
            row_type: "GROUP",
            group_order: 1,
            group_name: "Yêu cầu chung",
            criterion_order: null,
            criterion_code: null,
            criterion_title: null,
            requirement_text: null,
          },
          {
            row_type: "CRITERION",
            group_order: 1,
            group_name: null,
            criterion_order: 1,
            criterion_code: "TC-0001",
            criterion_title: "Nguồn điện",
            requirement_text: "Dòng 1\nDòng 2",
          },
          ...draft.groups.slice(1).map((group, index) => ({
            row_type: "GROUP" as const,
            group_order: index + 2,
            group_name: group.name,
            criterion_order: null,
            criterion_code: null,
            criterion_title: null,
            requirement_text: null,
          })),
        ],
      })
    )
    expect(codec.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "Mau_Cau_Hinh_Co_So_Phien_Ban_1.xlsx"
    )

    view.unmount()
    mockVersions([createLockedVersion()])
    renderTab()

    expect(await screen.findByText("Đã khóa")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tải template Excel" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Nhập từ Excel" })).not.toBeInTheDocument()
  })

  it("renders the authoritative preview and row-level actionable errors", async () => {
    const user = userEvent.setup()
    mockVersions([createDraft()])
    rpc.previewImport.mockResolvedValue(
      createBaselineImportPreview({
        errors: [
          {
            row: 3,
            code: "validation_error",
            column: "requirement_text",
            message: "Nội dung yêu cầu là bắt buộc.",
          },
        ],
      })
    )

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Nhập từ Excel" }))
    fireEvent.change(screen.getByLabelText("Chọn template cấu hình cơ sở"), {
      target: { files: [createBaselineImportFile()] },
    })

    expect(
      await screen.findByRole("region", { name: "Xem trước cấu hình cơ sở" })
    ).toBeInTheDocument()
    expect(screen.getByText("TC-0002")).toBeInTheDocument()
    expect(
      screen.getByText("Dòng 3 · requirement_text: Nội dung yêu cầu là bắt buộc.")
    ).toBeInTheDocument()
    expect(screen.getByRole("alert", { name: "Lỗi xem trước cấu hình cơ sở" })).toHaveTextContent(
      "Dòng 3 · requirement_text: Nội dung yêu cầu là bắt buộc."
    )
    expect(screen.getByRole("button", { name: "Nhập 2 dòng" })).toBeDisabled()
    expect(rpc.applyImport).not.toHaveBeenCalled()
  })

  it("announces parser errors through the labeled import live region", async () => {
    const user = userEvent.setup()
    mockVersions([createDraft()])
    codec.parseWorkbook.mockRejectedValue(new Error("Template không hợp lệ"))

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Nhập từ Excel" }))
    fireEvent.change(screen.getByLabelText("Chọn template cấu hình cơ sở"), {
      target: { files: [createBaselineImportFile("invalid-template.xlsx")] },
    })

    expect(await screen.findByRole("alert", { name: "Lỗi nhập cấu hình cơ sở" })).toHaveTextContent(
      "Template không hợp lệ"
    )
    expect(rpc.previewImport).not.toHaveBeenCalled()
  })

  it("blocks template actions while the manual editor has unsaved changes", async () => {
    const user = userEvent.setup()
    mockVersions([createDraft()])

    renderTab()
    const groupName = await screen.findByDisplayValue("Yêu cầu chung")
    await user.type(groupName, " đã sửa")

    expect(screen.getByRole("button", { name: "Tải template Excel" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Nhập từ Excel" })).toBeDisabled()
  })

  it("blocks template actions while bulk input remains unresolved", async () => {
    const user = userEvent.setup()
    mockVersions([createDraft()])

    renderTab()
    await user.click(await screen.findByRole("tab", { name: "Nhập nhiều dòng" }))
    await user.type(screen.getByLabelText("Nội dung nhập nhanh"), "Buffer chưa xử lý")

    expect(screen.getByRole("button", { name: "Tải template Excel" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Nhập từ Excel" })).toBeDisabled()
  })
})
