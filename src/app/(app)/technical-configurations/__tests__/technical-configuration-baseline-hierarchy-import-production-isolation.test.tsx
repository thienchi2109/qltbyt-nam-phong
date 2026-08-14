import "@testing-library/jest-dom"

import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  baselineVersionsResponse,
  createDraft,
  createLockedVersion,
  createPersistentQueryClient,
  deferred,
  dossier,
  getBaselineRpcMock,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"
import {
  createHierarchyImportFile,
  createHierarchyPreview,
  createV2ParseResult,
} from "./technical-configuration-baseline-hierarchy-import-fixtures"

const compatibleParser = vi.hoisted(() => ({
  parseFile: vi.fn(),
}))

vi.mock("@/lib/technical-configuration-baseline-excel-v2-parse", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/technical-configuration-baseline-excel-v2-parse")>()
  return {
    ...actual,
    parseTechnicalConfigurationBaselineWorkbookFile: compatibleParser.parseFile,
  }
})

const rpc = getBaselineRpcMock()

describe("technical configuration hierarchy production activation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([createDraft()]))
    compatibleParser.parseFile.mockResolvedValue(createV2ParseResult())
    rpc.previewHierarchyImport.mockResolvedValue(createHierarchyPreview())
  })

  it("replaces legacy Excel actions with XLSX v2 controls in the version bar", async () => {
    const user = userEvent.setup()
    renderTab()

    const versionBar = await screen.findByRole("region", {
      name: "Lịch sử phiên bản cấu hình cơ sở",
    })
    expect(screen.queryByRole("button", { name: "Tải template Excel" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Nhập từ Excel" })).not.toBeInTheDocument()
    expect(within(versionBar).getByRole("button", { name: "Tải cấu hình hiện tại" })).toBeEnabled()
    expect(within(versionBar).getByRole("button", { name: "Tải mẫu trống" })).toBeEnabled()
    expect(within(versionBar).getByRole("button", { name: "Nhập cấu hình phân cấp" })).toBeEnabled()
    expect(screen.getAllByRole("button", { name: /Thêm nhóm con/i })).not.toHaveLength(0)
    expect(
      screen.queryByRole("dialog", { name: "Nhập cấu hình phân cấp từ Excel" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))

    expect(
      screen.getByRole("dialog", { name: "Nhập cấu hình phân cấp từ Excel" })
    ).toBeInTheDocument()
    expect(rpc.previewHierarchyImport).not.toHaveBeenCalled()
    expect(rpc.applyHierarchyImport).not.toHaveBeenCalled()
  })

  it("keeps destructive replacement explicit and blocks navigation while apply is pending", async () => {
    const user = userEvent.setup()
    const pendingApply = deferred<{ data: ReturnType<typeof createDraft> }>()
    const onNavigationBlockedChange = vi.fn()
    rpc.applyHierarchyImport.mockReturnValue(pendingApply.promise)

    renderTab(vi.fn(), createPersistentQueryClient(), onNavigationBlockedChange)
    await user.click(await screen.findByRole("button", { name: "Nhập cấu hình phân cấp" }))
    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile()
    )

    const confirmation = await screen.findByRole("group", {
      name: "Xác nhận thay thế toàn bộ cấu hình",
    })
    const applyButton = screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })
    expect(confirmation).toHaveTextContent("Xóa 0 mục chính, 0 nhóm con và 1 tiêu chí.")
    expect(applyButton).toBeDisabled()
    expect(screen.getByRole("button", { name: "Khóa phiên bản", hidden: true })).toBeDisabled()
    expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(false)

    await user.click(
      screen.getByRole("checkbox", {
        name: "Tôi hiểu các mục bị thiếu trong workbook sẽ bị xóa",
      })
    )
    expect(applyButton).toBeEnabled()
    expect(rpc.applyHierarchyImport).not.toHaveBeenCalled()

    await user.click(applyButton)
    await waitFor(() => expect(rpc.applyHierarchyImport).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(true))
    expect(screen.queryByRole("button", { name: "Đóng" })).not.toBeInTheDocument()

    await act(async () => {
      pendingApply.resolve({ data: createDraft({ revision: 5 }) })
      await pendingApply.promise
    })
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Nhập cấu hình phân cấp từ Excel" })
      ).not.toBeInTheDocument()
    )
    expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(false)
  })

  it("keeps XLSX v2 and hierarchy authoring controls draft-only", async () => {
    rpc.listVersions.mockResolvedValueOnce(baselineVersionsResponse([createLockedVersion()]))
    renderTab()

    expect(await screen.findByText("Nội dung chỉ đọc")).toBeInTheDocument()
    expect(
      screen.queryByRole("group", { name: "Công cụ cấu hình phân cấp" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Thêm nhóm con/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Nhập cấu hình phân cấp" })).not.toBeInTheDocument()
  })
})
