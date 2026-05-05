import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { useEquipmentPage } from "../use-equipment-page"

type EquipmentPageState = ReturnType<typeof useEquipmentPage>

interface TestTable {
  selectedCount: number
  selectOne: () => void
  getFilteredRowModel: () => { rows: unknown[] }
}

const state = vi.hoisted(() => ({
  pageState: null as EquipmentPageState | null,
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
  EquipmentContent: ({ table }: { table: TestTable }) => (
    <section aria-label="equipment content">
      <output aria-label="selected count">{table.selectedCount}</output>
      <button type="button" onClick={table.selectOne}>
        Chọn dòng
      </button>
    </section>
  ),
}))

vi.mock("../equipment-dialogs", () => ({
  EquipmentDialogs: () => null,
}))

vi.mock("../_components/EquipmentColumnsDialog", () => ({
  EquipmentColumnsDialog: () => null,
}))

vi.mock("../_components/EquipmentBulkDeleteBar", () => ({
  EquipmentBulkDeleteBar: () => null,
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

function createTable(): TestTable {
  const table: TestTable = {
    selectedCount: 0,
    selectOne() {
      table.selectedCount = 1
    },
    getFilteredRowModel: () => ({ rows: [{ id: 202 }] }),
  }
  return table
}

function createPageState(table: TestTable): EquipmentPageState {
  return {
    status: "authenticated",
    router: { push: mocks.push, replace: vi.fn() },
    effectiveTenantKey: "5",
    user: { id: 1, role: "admin" },
    pendingAction: null,
    clearPendingAction: mocks.clearPendingAction,
    isGlobal: true,
    isRegionalLeader: false,
    total: 1,
    isLoading: false,
    isFetching: false,
    shouldFetchEquipment: true,
    table,
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
    locations: [],
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
    showFacilityFilter: true,
    facilities: [],
    selectedFacilityId: 5,
    setSelectedFacilityId: vi.fn(),
    activeFacility: null,
    hasFacilityFilter: true,
    isFacilitiesLoading: false,
    handleFacilityClear: vi.fn(),
    isFilterSheetOpen: false,
    setIsFilterSheetOpen: vi.fn(),
    handleExportData: vi.fn(),
    handleDownloadTemplate: vi.fn(),
    handleGenerateProfileSheet: vi.fn(),
    handleGenerateDeviceLabel: vi.fn(),
    onDataMutationSuccess: vi.fn(),
    onDataMutationSuccessWithStatePreservation: vi.fn(),
    isMobile: false,
    isCardView: false,
    useTabletFilters: false,
    canBulkSelect: true,
    isExporting: false,
    tenantBranding: undefined,
  } as unknown as EquipmentPageState
}

describe("EquipmentPageClient selection render boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.pageState = null
  })

  it("re-renders equipment content when stable table state changes row selection", async () => {
    const user = userEvent.setup()
    const table = createTable()
    state.pageState = createPageState(table)

    const { rerender } = render(<EquipmentPageClient />)

    expect(screen.getByLabelText("selected count")).toHaveTextContent("0")

    await user.click(screen.getByRole("button", { name: "Chọn dòng" }))
    rerender(<EquipmentPageClient />)

    expect(screen.getByLabelText("selected count")).toHaveTextContent("1")
  })
})
