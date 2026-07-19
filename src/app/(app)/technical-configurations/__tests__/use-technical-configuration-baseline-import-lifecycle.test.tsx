import "@testing-library/jest-dom"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createBaselineImportFile,
  createBaselineImportPayload,
  createBaselineImportPreview,
  createDraft,
  createPersistentQueryClient,
  deferred,
  dossier,
  getBaselineImportCodecMock,
  getBaselineRpcMock,
  mockVersions,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()
const codec = getBaselineImportCodecMock()

describe("useTechnicalConfigurationBaselineImport lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    codec.readExcelFile.mockResolvedValue({
      SheetNames: ["Baseline", "_meta"],
      Sheets: {},
      _workbook: {},
    })
    codec.parseWorkbook.mockResolvedValue([createBaselineImportPayload()])
    rpc.previewImport.mockResolvedValue(createBaselineImportPreview())
  })

  it("blocks dismissal while the atomic apply request is in flight", async () => {
    const user = userEvent.setup()
    const draft = createDraft()
    const pendingApply = deferred<{ data: ReturnType<typeof createDraft> }>()
    const onNavigationBlockedChange = vi.fn()
    mockVersions([draft])
    rpc.applyImport.mockReturnValue(pendingApply.promise)

    renderTab(vi.fn(), createPersistentQueryClient(), onNavigationBlockedChange)
    await user.click(await screen.findByRole("button", { name: "Nhập từ Excel" }))
    fireEvent.change(screen.getByLabelText("Chọn template cấu hình cơ sở"), {
      target: { files: [createBaselineImportFile("pending-baseline.xlsx")] },
    })
    expect(await screen.findByText("TC-0002")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Đóng" })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Nhập 2 dòng" }))
    await waitFor(() => expect(rpc.applyImport).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(true))

    expect(screen.queryByRole("button", { name: "Đóng" })).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.getByRole("dialog", { name: "Nhập cấu hình cơ sở từ Excel" })).toBeInTheDocument()
    expect(screen.getByText("pending-baseline.xlsx")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Khóa phiên bản", hidden: true })).toBeDisabled()

    await act(async () => {
      pendingApply.resolve({ data: createDraft({ revision: 5 }) })
      await pendingApply.promise
    })

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Nhập cấu hình cơ sở từ Excel" })
      ).not.toBeInTheDocument()
    )
    expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(false)
  })

  it("keeps an in-flight preview alive across parent state rerenders", async () => {
    const user = userEvent.setup()
    const pendingPreview = deferred<ReturnType<typeof createBaselineImportPreview>>()
    mockVersions([createDraft()])
    rpc.previewImport.mockReturnValue(pendingPreview.promise)

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Nhập từ Excel" }))
    fireEvent.change(screen.getByLabelText("Chọn template cấu hình cơ sở"), {
      target: { files: [createBaselineImportFile()] },
    })

    await waitFor(() => expect(rpc.previewImport).toHaveBeenCalledTimes(1))
    expect(screen.getByText("Đang tạo bản xem trước từ máy chủ...")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Đóng" })).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.getByRole("dialog", { name: "Nhập cấu hình cơ sở từ Excel" })).toBeInTheDocument()

    await act(async () => {
      pendingPreview.resolve(createBaselineImportPreview())
      await pendingPreview.promise
    })

    expect(await screen.findByText("TC-0002")).toBeInTheDocument()
    expect(rpc.previewImport).toHaveBeenCalledTimes(1)
  })
})
