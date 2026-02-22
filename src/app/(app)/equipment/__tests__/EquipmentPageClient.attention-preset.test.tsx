import * as React from "react"
import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { applyAttentionStatusPresetFilters } from "@/lib/equipment-attention-preset"

const state = vi.hoisted(() => ({
  pageState: null as any,
}))

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  setColumnFilters: vi.fn(),
  clearPendingAction: vi.fn(),
  openAddDialog: vi.fn(),
  openImportDialog: vi.fn(),
  openColumnsDialog: vi.fn(),
  openDetailDialog: vi.fn(),
  openEditDialog: vi.fn(),
  renderBulkDeleteBar: vi.fn(),
}))

vi.mock("../use-equipment-page", () => ({
  useEquipmentPage: () => state.pageState,
}))

vi.mock("../_hooks/useEquipmentContext", () => ({
  useEquipmentContext: () => ({
    openAddDialog: mocks.openAddDialog,
    openImportDialog: mocks.openImportDialog,
    openColumnsDialog: mocks.openColumnsDialog,
    openDetailDialog: mocks.openDetailDialog,
    openEditDialog: mocks.openEditDialog,
  }),
}))

vi.mock("../_components/EquipmentDialogContext", () => ({
  EquipmentDialogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("../equipment-content", () => ({
  EquipmentContent: () => null,
}))

vi.mock("../equipment-dialogs", () => ({
  EquipmentDialogs: () => null,
}))

vi.mock("../_components/EquipmentColumnsDialog", () => ({
  EquipmentColumnsDialog: () => null,
}))

vi.mock("../_components/EquipmentBulkDeleteBar", () => ({
  EquipmentBulkDeleteBar: (props: Record<string, unknown>) => {
    mocks.renderBulkDeleteBar(props)
    return null
  },
}))

vi.mock("@/components/equipment/equipment-toolbar", () => ({
  EquipmentToolbar: () => null,
}))

vi.mock("@/components/equipment/filter-bottom-sheet", () => ({
  FilterBottomSheet: () => null,
}))

vi.mock("@/components/shared/DataTablePagination", () => ({
  DataTablePagination: () => null,
}))

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => null,
}))

import { EquipmentPageClient } from "../_components/EquipmentPageClient"

function createPageState(overrides?: Record<string, unknown>) {
  return {
    status: "authenticated",
    router: { push: mocks.push, replace: vi.fn() },
    effectiveTenantKey: "5",
    user: { id: 1, role: "to_qltb" },
    pendingAction: null,
    clearPendingAction: mocks.clearPendingAction,
    isGlobal: false,
    isRegionalLeader: false,
    total: 0,
    isLoading: false,
    isFetching: false,
    shouldFetchEquipment: true,
    table: {
      getFilteredRowModel: () => ({ rows: [] }),
    },
    columns: [],
    pagination: { pageIndex: 0, pageSize: 20 },
    setPagination: vi.fn(),
    searchTerm: "",
    setSearchTerm: vi.fn(),
    columnFilters: [],
    setColumnFilters: mocks.setColumnFilters,
    isFiltered: false,
    departments: [],
    users: [],
    statuses: [],
    classifications: [],
    fundingSources: [],
    filterData: {
      status: [],
      department: [],
      location: [],
      user: [],
      classification: [],
      fundingSource: [],
    },
    showFacilityFilter: false,
    hasFacilityFilter: false,
    handleFacilityClear: vi.fn(),
    isFilterSheetOpen: false,
    setIsFilterSheetOpen: vi.fn(),
    handleExportData: vi.fn(),
    handleDownloadTemplate: vi.fn(),
    handleGenerateProfileSheet: vi.fn(),
    handleGenerateDeviceLabel: vi.fn(),
    isMobile: false,
    isCardView: false,
    useTabletFilters: false,
    canBulkSelect: false,
    tenantBranding: undefined,
    ...overrides,
  }
}

describe("EquipmentPageClient attention preset action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.pageState = createPageState()
  })

  it("passes table selection flags to EquipmentBulkDeleteBar", () => {
    const table = {
      getFilteredRowModel: () => ({ rows: [] }),
    }

    state.pageState = createPageState({
      table,
      canBulkSelect: true,
      isCardView: false,
    })

    render(<EquipmentPageClient />)

    expect(mocks.renderBulkDeleteBar).toHaveBeenCalledWith(
      expect.objectContaining({
        table,
        canBulkSelect: true,
        isCardView: false,
      })
    )
  })

  it("applies attention status preset filters for non-global users", async () => {
    state.pageState = createPageState({
      isGlobal: false,
      isRegionalLeader: false,
      pendingAction: { type: "applyAttentionStatusPreset" },
    })

    render(<EquipmentPageClient />)

    await waitFor(() => {
      expect(mocks.setColumnFilters).toHaveBeenCalledTimes(1)
    })

    const updater = mocks.setColumnFilters.mock.calls[0][0]
    expect(typeof updater).toBe("function")

    const prevFilters = [
      { id: "khoa_phong_quan_ly", value: ["Khoa A"] },
      { id: "tinh_trang_hien_tai", value: ["Hoạt động"] },
    ]

    expect(updater(prevFilters)).toEqual(applyAttentionStatusPresetFilters(prevFilters))

    expect(mocks.clearPendingAction).toHaveBeenCalledTimes(1)
  })

  it("does not apply preset filters for global users but still clears pending action", async () => {
    state.pageState = createPageState({
      isGlobal: true,
      isRegionalLeader: false,
      pendingAction: { type: "applyAttentionStatusPreset" },
    })

    render(<EquipmentPageClient />)

    await waitFor(() => {
      expect(mocks.clearPendingAction).toHaveBeenCalledTimes(1)
    })

    expect(mocks.setColumnFilters).not.toHaveBeenCalled()
  })

  it("does not apply preset filters for regional leaders but still clears pending action", async () => {
    state.pageState = createPageState({
      isGlobal: false,
      isRegionalLeader: true,
      pendingAction: { type: "applyAttentionStatusPreset" },
    })

    render(<EquipmentPageClient />)

    await waitFor(() => {
      expect(mocks.clearPendingAction).toHaveBeenCalledTimes(1)
    })

    expect(mocks.setColumnFilters).not.toHaveBeenCalled()
  })
})
