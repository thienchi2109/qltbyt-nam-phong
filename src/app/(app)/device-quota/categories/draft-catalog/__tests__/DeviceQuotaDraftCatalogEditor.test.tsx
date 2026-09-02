import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useDeviceQuotaDraftCatalog } from "../../_hooks/useDeviceQuotaDraftCatalog"
import { DeviceQuotaDraftCatalogEditor } from "../_components/DeviceQuotaDraftCatalogEditor"
import { DeviceQuotaDraftCatalogPageClient } from "../_components/DeviceQuotaDraftCatalogPageClient"
import type {
  DeviceQuotaMergedItemRow,
  DeviceQuotaMergedRow,
  DeviceQuotaMergedSectionRow,
} from "../device-quota-draft-catalog-types"

vi.mock("../../_hooks/useDeviceQuotaDraftCatalog", () => ({
  useDeviceQuotaDraftCatalog: vi.fn(),
}))

const mockUseDraftCatalog = vi.mocked(useDeviceQuotaDraftCatalog)

function makeSection(index: number): DeviceQuotaMergedSectionRow {
  return {
    id: `section-${index}`,
    sourceLabel: `${index}.`,
    type: "section",
    level: 0,
    parentSourceIdentifier: null,
    name: `Nhóm ${index}`,
    regulatoryUnit: null,
    quotaLines: null,
    sourcePages: [10 + index],
    sourceReference: `Phụ lục, mục ${index}`,
    sourceOrder: index,
    sourceIdentifier: `section-${index}`,
    completeness: "structural",
    displayName: `Nhóm ${index}`,
    displayNameOverride: null,
    regulatoryFieldsReadOnly: true,
    editableFields: {
      displayName: false,
      appliedUnit: false,
      appliedQuantity: false,
      notes: false,
    },
  }
}

function makeItem(index: number, sectionIndex: number): DeviceQuotaMergedItemRow {
  const sourceIdentifier = `item-${index}`
  return {
    id: sourceIdentifier,
    sourceLabel: `${sectionIndex}.${index}`,
    type: "item",
    level: index === 1 ? 1 : 0,
    parentSourceIdentifier: `section-${sectionIndex}`,
    name: `Thiết bị ${index}`,
    regulatoryUnit: "Máy",
    quotaLines: index === 1 ? ["Tối thiểu 01 máy", "Tối đa 02 máy"] : ["01 máy"],
    sourcePages: index === 1 ? [12, 13] : [12],
    sourceReference: `Phụ lục, dòng ${index}`,
    sourceOrder: index + 5,
    sourceIdentifier,
    completeness: index === 1 ? "incomplete" : "complete",
    displayName: `Thiết bị ${index}`,
    displayNameOverride: null,
    appliedUnit: index === 1 ? null : "Máy",
    appliedQuantity: index === 1 ? null : 1,
    notes: null,
    isExcluded: false,
    displayOrder: index + 5,
    regulatoryItemId: `reg-${index}`,
    regulatoryName: `Thiết bị ${index}`,
    regulatoryQuotaLines: index === 1 ? ["Tối thiểu 01 máy", "Tối đa 02 máy"] : ["01 máy"],
    regulatoryRules:
      index === 1
        ? [
            { lineOrder: 1, sourceText: "Tối thiểu 01 máy" },
            { lineOrder: 2, sourceText: "Tối đa 02 máy" },
          ]
        : [{ lineOrder: 1, sourceText: "01 máy" }],
    regulatoryFieldsReadOnly: true,
    editableFields: {
      displayName: true,
      appliedUnit: true,
      appliedQuantity: true,
      notes: true,
    },
  }
}

function makeRows(): DeviceQuotaMergedRow[] {
  const rows: DeviceQuotaMergedRow[] = []
  let itemIndex = 1
  for (let sectionIndex = 1; sectionIndex <= 5; sectionIndex += 1) {
    rows.push(makeSection(sectionIndex))
    const itemCount = sectionIndex === 5 ? 5 : 8
    for (let index = 0; index < itemCount; index += 1) {
      rows.push(makeItem(itemIndex, sectionIndex))
      itemIndex += 1
    }
  }
  return rows
}

const metadata = {
  unitId: 23,
  draftStatus: "draft" as const,
  documentNumber: "10/2026/TT-BYT",
  documentVersion: "2026-06-19",
  snapshotMarker: "abc123def456",
  lastSavedAt: "2026-09-01T08:30:00.000Z",
  revision: 4,
  mode: "editable" as const,
}

function renderEditor(
  overrides: Partial<React.ComponentProps<typeof DeviceQuotaDraftCatalogEditor>> = {}
) {
  const props: React.ComponentProps<typeof DeviceQuotaDraftCatalogEditor> = {
    rows: makeRows(),
    metadata,
    validationErrors: {},
    isDirty: false,
    isIncomplete: true,
    isSaving: false,
    isExcluding: false,
    isRestoring: false,
    isReadOnly: false,
    onUpdateItem: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onExclude: vi.fn().mockResolvedValue(undefined),
    onRestore: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return { ...render(<DeviceQuotaDraftCatalogEditor {...props} />), props }
}

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
    updateItem: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    exclude: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    getDeviceQuotaDraftCompleteness: vi.fn(),
    isDirty: false,
    isIncomplete: true,
    ...overrides,
  } as unknown as ReturnType<typeof useDeviceQuotaDraftCatalog>
}

describe("DeviceQuotaDraftCatalogEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
  })

  it("renders source metadata and all 42 rows in five navigable sections", () => {
    renderEditor()

    expect(screen.getByText(/10\/2026\/TT-BYT/)).toBeInTheDocument()
    expect(screen.getByText(/abc123def456/)).toBeInTheDocument()
    expect(screen.getByText(/Đơn vị 23 ·/)).toBeInTheDocument()
    expect(screen.getAllByTestId(/^device-quota-catalog-row-/)).toHaveLength(37)
    expect(screen.getAllByTestId(/^device-quota-catalog-section-/)).toHaveLength(5)
    expect(screen.getAllByTestId(/^device-quota-catalog-(row|section)-/).length).toBe(42)

    const firstRow = screen.getByTestId("device-quota-catalog-row-item-1")
    expect(within(firstRow).getByText(/Phụ lục, dòng 1/)).toBeInTheDocument()
    expect(within(firstRow).getByText(/Trang 12, 13/)).toBeInTheDocument()
    expect(within(firstRow).getByText(/Thứ tự nguồn: 6/)).toBeInTheDocument()
    expect(within(firstRow).getByText(/Cấp: 1/)).toBeInTheDocument()
    expect(within(firstRow).getByText(/Thuộc: section-1/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Nhóm 3" }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Thu gọn Nhóm 1" }))
    expect(screen.queryByTestId("device-quota-catalog-row-item-1")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mở rộng Nhóm 1" })).toBeInTheDocument()
  })

  it("keeps regulatory values read-only and stages ordinary edits until Save", () => {
    const { props } = renderEditor({ isDirty: true })
    const firstRow = screen.getByTestId("device-quota-catalog-row-item-1")

    expect(screen.queryByRole("textbox", { name: "Tên theo Thông tư" })).not.toBeInTheDocument()
    expect(within(firstRow).getByPlaceholderText("Mặc định theo tên Thông tư")).toHaveValue("")

    fireEvent.click(screen.getByRole("button", { name: "Xem quy tắc Thiết bị 1" }))
    expect(screen.getByText("Tối thiểu 01 máy")).toBeInTheDocument()
    expect(screen.getByText("Tối đa 02 máy")).toBeInTheDocument()

    fireEvent.change(
      within(firstRow).getByRole("textbox", { name: "Tên hiển thị tại đơn vị - Thiết bị 1" }),
      { target: { value: "Máy theo nhu cầu đơn vị" } }
    )
    fireEvent.change(
      within(firstRow).getByRole("spinbutton", {
        name: "Số lượng đề xuất trong bản nháp - Thiết bị 1",
      }),
      { target: { value: "3" } }
    )

    expect(props.onUpdateItem).toHaveBeenCalledWith("item-1", {
      displayNameOverride: "Máy theo nhu cầu đơn vị",
    })
    fireEvent.change(
      within(firstRow).getByRole("textbox", { name: "Đơn vị áp dụng tại đơn vị - Thiết bị 1" }),
      { target: { value: "Bộ" } }
    )
    expect(props.onUpdateItem).toHaveBeenCalledWith("item-1", { appliedUnit: "Bộ" })
    expect(props.onUpdateItem).toHaveBeenCalledWith("item-1", { appliedQuantity: 3 })
    expect(props.onSave).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))
    expect(props.onSave).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Chưa hoàn thiện")).toBeInTheDocument()
  })

  it("shows quantity feedback and blocks Save for negative or fractional values", () => {
    renderEditor({
      isDirty: true,
      validationErrors: {
        "item-1": "Số lượng phải là số nguyên không âm.",
      },
    })

    expect(screen.getByText("Số lượng phải là số nguyên không âm.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
  })

  it("persists exclude and restore immediately while keeping excluded rows visible", () => {
    const onExclude = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderEditor({ onExclude })

    fireEvent.click(screen.getByRole("button", { name: "Loại khỏi bản nháp Thiết bị 1" }))
    expect(onExclude).toHaveBeenCalledWith("item-1")

    const excludedRows = makeRows().map((row) =>
      row.type === "item" && row.sourceIdentifier === "item-1"
        ? { ...row, isExcluded: true, completeness: "excluded" as const }
        : row
    )
    const onRestore = vi.fn().mockResolvedValue(undefined)
    rerender(
      <DeviceQuotaDraftCatalogEditor
        rows={excludedRows}
        metadata={metadata}
        validationErrors={{}}
        isDirty={false}
        isIncomplete={false}
        isSaving={false}
        isExcluding={false}
        isRestoring={false}
        isReadOnly={false}
        onUpdateItem={vi.fn()}
        onSave={vi.fn()}
        onExclude={onExclude}
        onRestore={onRestore}
      />
    )

    expect(screen.getByTestId("device-quota-catalog-row-item-1")).toHaveAttribute(
      "data-excluded",
      "true"
    )
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục Thiết bị 1" }))
    expect(onRestore).toHaveBeenCalledWith("item-1")
  })

  it("renders view mode read-only and hides mutation controls", () => {
    renderEditor({
      metadata: { ...metadata, mode: "readonly" },
      isReadOnly: true,
    })

    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText("Mặc định theo tên Thông tư")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Loại khỏi bản nháp Thiết bị 1" })
    ).not.toBeInTheDocument()
  })
})

describe("DeviceQuotaDraftCatalogPageClient", () => {
  it.each([
    ["loading", "Đang tải danh mục dự thảo"],
    ["unavailable", "Chưa có snapshot pháp quy khả dụng"],
    ["conflict", "Bản nháp đã được cập nhật ở nơi khác"],
    ["error", "Không thể tải danh mục dự thảo"],
  ] as const)("renders the %s state clearly", (status, message) => {
    mockUseDraftCatalog.mockReturnValue(
      makeHookResult({
        status,
        errorMessage: status === "error" ? "Lỗi thử nghiệm" : null,
      })
    )

    render(<DeviceQuotaDraftCatalogPageClient />)

    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it("fails closed for missing session unit or unsupported access", () => {
    mockUseDraftCatalog.mockReturnValue(
      makeHookResult({
        status: "blocked",
        canAccess: false,
        donViId: null,
      })
    )
    const { rerender } = render(<DeviceQuotaDraftCatalogPageClient />)
    expect(screen.getByText("Chưa xác định đơn vị làm việc")).toBeInTheDocument()

    mockUseDraftCatalog.mockReturnValue(
      makeHookResult({
        status: "blocked",
        canAccess: false,
        donViId: 23,
      })
    )
    rerender(<DeviceQuotaDraftCatalogPageClient />)
    expect(screen.getByText("Bạn không có quyền mở danh mục dự thảo")).toBeInTheDocument()
  })

  it("exposes retry for a failed Save without dropping staged edits", () => {
    const save = vi.fn().mockResolvedValue(undefined)
    mockUseDraftCatalog.mockReturnValue(
      makeHookResult({
        status: "error",
        canRetry: true,
        isDirty: true,
        save,
        errorMessage: "Không thể cập nhật bản nháp.",
      })
    )

    render(<DeviceQuotaDraftCatalogPageClient />)

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(save).toHaveBeenCalledTimes(1)
  })
})
