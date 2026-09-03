import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import { useDeviceQuotaDraftCatalog } from "../../_hooks/useDeviceQuotaDraftCatalog"
import { DeviceQuotaDraftCatalogEditor } from "../_components/DeviceQuotaDraftCatalogEditor"
import { DeviceQuotaDraftCatalogPageClient } from "../_components/DeviceQuotaDraftCatalogPageClient"
import { defaultEditorState, makeRows, metadata } from "./DeviceQuotaDraftCatalogTestSupport"

vi.mock("../../_hooks/useDeviceQuotaDraftCatalog", () => ({
  useDeviceQuotaDraftCatalog: vi.fn(),
}))

const mockUseDraftCatalog = vi.mocked(useDeviceQuotaDraftCatalog)

function makeHookResult(
  overrides: Partial<ReturnType<typeof useDeviceQuotaDraftCatalog>> = {}
): ReturnType<typeof useDeviceQuotaDraftCatalog> {
  return {
    status: "ready",
    rows: makeRows(),
    lastSavedRows: makeRows(),
    validationErrors: {},
    errorMessage: null,
    canRetry: false,
    canAccess: true,
    isReadOnly: false,
    donViId: 23,
    revision: 4,
    draftId: "draft-1",
    catalogVersionId: "catalog-1",
    metadata,
    isSaving: false,
    isExcluding: false,
    isRestoring: false,
    isRecovering: false,
    updateItem: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    exclude: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn().mockResolvedValue(undefined),
    getDeviceQuotaDraftCompleteness: vi.fn(),
    isDirty: false,
    isIncomplete: true,
    ...overrides,
  } as unknown as ReturnType<typeof useDeviceQuotaDraftCatalog>
}

describe("DeviceQuotaDraftCatalogEditor", () => {
  it("keeps concise header metadata and save feedback without technical metadata", () => {
    render(
      <DeviceQuotaDraftCatalogEditor
        rows={makeRows()}
        metadata={metadata}
        validationErrors={{}}
        state={defaultEditorState}
        onUpdateItem={vi.fn()}
        onSave={vi.fn()}
        onExclude={vi.fn()}
        onRestore={vi.fn()}
      />
    )

    expect(screen.getByText(/10\/2026\/TT-BYT/)).toBeInTheDocument()
    expect(screen.getByText(/Đơn vị 23 ·/)).toBeInTheDocument()
    expect(screen.getByText("Đã lưu")).toBeInTheDocument()
    expect(screen.getByText("Chưa hoàn thiện")).toBeInTheDocument()
    expect(screen.queryByText(/abc123def456/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Revision: 4/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Trạng thái: draft/)).not.toBeInTheDocument()
  })

  it.each([
    { state: defaultEditorState, feedback: "Đã lưu", button: "Lưu" },
    { state: { ...defaultEditorState, isDirty: true }, feedback: "Chưa lưu", button: "Lưu" },
    {
      state: { ...defaultEditorState, isDirty: true, isSaving: true },
      feedback: "Đang lưu...",
      button: "Đang lưu...",
    },
  ])("shows $feedback in the toolbar", ({ state, feedback, button }) => {
    render(
      <DeviceQuotaDraftCatalogEditor
        rows={makeRows()}
        metadata={metadata}
        validationErrors={{}}
        state={state}
        onUpdateItem={vi.fn()}
        onSave={vi.fn()}
        onExclude={vi.fn()}
        onRestore={vi.fn()}
      />
    )

    expect(screen.getByTestId("device-quota-draft-catalog-toolbar")).toHaveTextContent(feedback)
    expect(screen.getByRole("button", { name: button })).toBeInTheDocument()
  })
})

describe("DeviceQuotaDraftCatalogPageClient", () => {
  it.each([
    ["loading", "Đang tải danh mục dự thảo"],
    ["unavailable", "Chưa có snapshot pháp quy khả dụng"],
    ["conflict", "Bản nháp đã được cập nhật ở nơi khác"],
    ["error", "Không thể tải danh mục dự thảo"],
  ] as const)("renders the %s state", (status, message) => {
    mockUseDraftCatalog.mockReturnValue(
      makeHookResult({ status, errorMessage: status === "error" ? "Lỗi thử nghiệm" : null })
    )

    render(<DeviceQuotaDraftCatalogPageClient />)
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it("fails closed for missing unit or unsupported access and preserves retry", async () => {
    const user = userEvent.setup()
    const retry = vi.fn().mockResolvedValue(undefined)
    mockUseDraftCatalog.mockReturnValue(
      makeHookResult({ status: "blocked", canAccess: false, donViId: null })
    )
    const { rerender } = render(<DeviceQuotaDraftCatalogPageClient />)
    expect(screen.getByText("Chưa xác định đơn vị làm việc")).toBeInTheDocument()

    mockUseDraftCatalog.mockReturnValue(
      makeHookResult({ status: "error", canRetry: true, retry, errorMessage: "Lỗi" })
    )
    rerender(<DeviceQuotaDraftCatalogPageClient />)
    await user.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("keeps staged values visible while a stale conflict can be retried", async () => {
    const user = userEvent.setup()
    const retry = vi.fn().mockResolvedValue(undefined)
    const firstItem = makeRows()[1]
    if (firstItem.type !== "item") throw new Error("Expected an item fixture")

    mockUseDraftCatalog.mockReturnValue(
      makeHookResult({
        status: "conflict",
        canRetry: true,
        isDirty: true,
        retry,
        rows: [{ ...firstItem, displayNameOverride: "Tên đã nhập" }],
        lastSavedRows: [firstItem],
        metadata,
      })
    )

    render(<DeviceQuotaDraftCatalogPageClient />)

    expect(screen.getByText("Bản nháp đã được cập nhật ở nơi khác")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Chỉnh tên hiển thị Thiết bị 1" }))
    expect(screen.getByRole("textbox", { name: "Tên hiển thị - Thiết bị 1" })).toHaveValue(
      "Tên đã nhập"
    )
    await user.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
