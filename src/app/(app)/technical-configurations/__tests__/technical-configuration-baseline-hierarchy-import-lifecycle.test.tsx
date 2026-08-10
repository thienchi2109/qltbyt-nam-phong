import "@testing-library/jest-dom"

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import {
  createAuthoritativeHierarchyPreview,
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

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

async function prepareConfirmedPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
  await user.upload(
    screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
    createHierarchyImportFile()
  )
  await screen.findByRole("group", { name: "Xác nhận thay thế toàn bộ cấu hình" })
  await user.click(
    screen.getByRole("checkbox", {
      name: "Tôi hiểu các mục bị thiếu trong workbook sẽ bị xóa",
    })
  )
}

describe("technical configuration baseline hierarchy import lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    compatibleParser.parseFile.mockResolvedValue(createV2ParseResult())
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValue(createHierarchyPreview())
    hierarchyImportRpc.applyHierarchyImport.mockResolvedValue({
      data: createHierarchyDraft({ revision: 12 }),
    })
  })

  it("does not persist before confirmation and applies only the previewed replacement", async () => {
    const user = userEvent.setup()
    render(<HierarchyImportHarness />)

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile()
    )
    await screen.findByRole("group", { name: "Xác nhận thay thế toàn bộ cấu hình" })

    expect(hierarchyImportRpc.applyHierarchyImport).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole("checkbox", {
        name: "Tôi hiểu các mục bị thiếu trong workbook sẽ bị xóa",
      })
    )
    expect(hierarchyImportRpc.applyHierarchyImport).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" }))

    await waitFor(() => {
      expect(hierarchyImportRpc.applyHierarchyImport).toHaveBeenCalledWith({
        p_baseline_version_id: "draft-1",
        p_template_metadata: createV2ParseResult().metadata,
        p_rows: expect.any(Array),
        p_expected_revision: 11,
      })
    })
    expect(hierarchyImportRpc.applyHierarchyImport.mock.calls[0]?.[0]).toBe(
      hierarchyImportRpc.previewHierarchyImport.mock.calls[0]?.[0]
    )
  })

  it("adopts the mocked post-activation snapshot and resets after success", async () => {
    const user = userEvent.setup()
    const applied = createHierarchyDraft({ revision: 12 })
    const onApplied = vi.fn().mockResolvedValue(undefined)
    hierarchyImportRpc.applyHierarchyImport.mockResolvedValueOnce({ data: applied })
    render(<HierarchyImportHarness onApplied={onApplied} />)

    await prepareConfirmedPreview(user)
    await user.click(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" }))

    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(applied))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("prevents duplicate apply when cache adoption fails after server success", async () => {
    const user = userEvent.setup()
    const onApplied = vi.fn().mockRejectedValue(new Error("cache refresh failed"))
    render(<HierarchyImportHarness onApplied={onApplied} />)

    await prepareConfirmedPreview(user)
    await user.click(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" }))

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("alert", { name: "Lỗi nhập cấu hình phân cấp" })).toHaveTextContent(
      "Đã nhập cấu hình phân cấp nhưng không thể tải lại trạng thái hồ sơ."
    )
    expect(hierarchyImportRpc.applyHierarchyImport).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("baseline-v2.xlsx")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" }))
    expect(hierarchyImportRpc.applyHierarchyImport).toHaveBeenCalledTimes(1)
  })

  it("invalidates a preserved preview when the selected revision changes", async () => {
    const user = userEvent.setup()
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValueOnce(
      createAuthoritativeHierarchyPreview()
    )
    const { rerender } = render(<HierarchyImportHarness version={createHierarchyDraft()} />)

    await prepareConfirmedPreview(user)
    rerender(<HierarchyImportHarness version={createHierarchyDraft({ revision: 12 })} />)

    expect(screen.getByText("baseline-v2.xlsx")).toBeInTheDocument()
    expect(screen.getByText("Mục chính từ máy chủ")).toBeInTheDocument()
    expect(screen.getByRole("alert", { name: "Lỗi nhập cấu hình phân cấp" })).toHaveTextContent(
      "Phiên bản đã thay đổi trên máy chủ. File và bản xem trước vẫn được giữ để đối chiếu."
    )
    expect(
      screen.getByRole("checkbox", {
        name: "Tôi hiểu các mục bị thiếu trong workbook sẽ bị xóa",
      })
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })).toBeDisabled()
    expect(hierarchyImportRpc.applyHierarchyImport).not.toHaveBeenCalled()
  })

  it("preserves file and preview when server apply remains not activated", async () => {
    const user = userEvent.setup()
    const onApplied = vi.fn().mockResolvedValue(undefined)
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValueOnce(
      createAuthoritativeHierarchyPreview()
    )
    hierarchyImportRpc.applyHierarchyImport.mockRejectedValueOnce(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "hierarchical_import_apply_not_activated",
      })
    )
    render(<HierarchyImportHarness onApplied={onApplied} />)

    await prepareConfirmedPreview(user)
    await user.click(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" }))

    const alert = await screen.findByRole("alert", { name: "Lỗi nhập cấu hình phân cấp" })
    expect(alert).toHaveTextContent("hierarchical_import_apply_not_activated")
    expect(screen.getByText("baseline-v2.xlsx")).toBeInTheDocument()
    expect(screen.getByText("Mục chính từ máy chủ")).toBeInTheDocument()
    expect(onApplied).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("keeps the hierarchy import workflow closed for a locked target", async () => {
    const user = userEvent.setup()
    render(
      <HierarchyImportHarness
        version={createHierarchyDraft({
          status: "locked",
          locked_at: "2026-08-10T00:00:00.000Z",
          locked_by: 42,
        })}
      />
    )

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(compatibleParser.parseFile).not.toHaveBeenCalled()
    expect(hierarchyImportRpc.previewHierarchyImport).not.toHaveBeenCalled()
    expect(hierarchyImportRpc.applyHierarchyImport).not.toHaveBeenCalled()
  })

  it("preserves file and normalized preview while disabling apply after a stale conflict", async () => {
    const user = userEvent.setup()
    const onConflict = vi.fn().mockResolvedValue(undefined)
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValueOnce(
      createAuthoritativeHierarchyPreview()
    )
    hierarchyImportRpc.applyHierarchyImport.mockRejectedValueOnce(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )
    render(<HierarchyImportHarness onConflict={onConflict} />)

    await prepareConfirmedPreview(user)
    await user.click(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" }))

    await waitFor(() => expect(onConflict).toHaveBeenCalledWith("draft-1"))
    expect(screen.getByText("baseline-v2.xlsx")).toBeInTheDocument()
    expect(screen.getByText("Mục chính từ máy chủ")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })).toBeDisabled()
    expect(hierarchyImportRpc.applyHierarchyImport).toHaveBeenCalledTimes(1)
  })

  it("clears preserved stale evidence when the workflow is reset", async () => {
    const user = userEvent.setup()
    hierarchyImportRpc.applyHierarchyImport.mockRejectedValueOnce(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )
    render(<HierarchyImportHarness onConflict={vi.fn().mockResolvedValue(undefined)} />)

    await prepareConfirmedPreview(user)
    await user.click(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })).toBeDisabled()
    )

    await user.click(screen.getByRole("button", { name: "Đặt lại" }))

    expect(screen.queryByText("baseline-v2.xlsx")).not.toBeInTheDocument()
    expect(screen.queryByText("Mục chính từ máy chủ")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("checkbox", {
        name: "Tôi hiểu các mục bị thiếu trong workbook sẽ bị xóa",
      })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })).toBeDisabled()
  })

  it("keeps conflicted evidence until a replacement workbook previews successfully", async () => {
    const user = userEvent.setup()
    const onConflict = vi.fn().mockResolvedValue(undefined)
    const oldPreview = createAuthoritativeHierarchyPreview()
    const refreshedParsed = createV2ParseResult()
    refreshedParsed.metadata.baseline_revision = 12
    const refreshedPreview = createAuthoritativeHierarchyPreview()
    refreshedPreview.data.metadata = refreshedParsed.metadata
    const refreshedGroup = refreshedPreview.data.rows[0]
    if (refreshedGroup?.row_type === "GROUP") {
      refreshedGroup.group_name = "Mục chính revision 12"
    }
    const pendingPreview = deferred<typeof refreshedPreview>()
    hierarchyImportRpc.previewHierarchyImport
      .mockResolvedValueOnce(oldPreview)
      .mockReturnValueOnce(pendingPreview.promise)
    hierarchyImportRpc.applyHierarchyImport.mockRejectedValueOnce(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )
    const { rerender } = render(
      <HierarchyImportHarness version={createHierarchyDraft()} onConflict={onConflict} />
    )

    await prepareConfirmedPreview(user)
    await user.click(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" }))
    await waitFor(() => expect(onConflict).toHaveBeenCalledWith("draft-1"))
    rerender(
      <HierarchyImportHarness
        version={createHierarchyDraft({ revision: 12 })}
        onConflict={onConflict}
      />
    )
    compatibleParser.parseFile.mockResolvedValueOnce(refreshedParsed)

    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile("baseline-revision-12.xlsx")
    )
    await waitFor(() => expect(hierarchyImportRpc.previewHierarchyImport).toHaveBeenCalledTimes(2))

    expect(screen.getByText("baseline-v2.xlsx")).toBeInTheDocument()
    expect(screen.getByText("Mục chính từ máy chủ")).toBeInTheDocument()

    await act(async () => {
      pendingPreview.resolve(refreshedPreview)
      await pendingPreview.promise
    })

    expect(await screen.findByText("baseline-revision-12.xlsx")).toBeInTheDocument()
    expect(screen.getByText("Mục chính revision 12")).toBeInTheDocument()
    expect(screen.queryByText("Mục chính từ máy chủ")).not.toBeInTheDocument()
    expect(
      screen.getByRole("checkbox", {
        name: "Tôi hiểu các mục bị thiếu trong workbook sẽ bị xóa",
      })
    ).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })).toBeDisabled()
    expect(hierarchyImportRpc.previewHierarchyImport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        p_template_metadata: expect.objectContaining({ baseline_revision: 12 }),
        p_expected_revision: 12,
      })
    )
  })
})
