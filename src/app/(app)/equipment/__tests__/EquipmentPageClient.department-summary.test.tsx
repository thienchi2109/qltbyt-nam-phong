import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { useEquipmentPage } from "../use-equipment-page"

type EquipmentPageState = ReturnType<typeof useEquipmentPage>

const state = vi.hoisted(() => ({
  pageState: null as EquipmentPageState | null,
}))

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  setColumnFilters: vi.fn(),
  setPagination: vi.fn(),
  clearPendingAction: vi.fn(),
  openAddDialog: vi.fn(),
  openImportDialog: vi.fn(),
  openColumnsDialog: vi.fn(),
  openDetailDialog: vi.fn(),
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
    openEditDialog: vi.fn(),
  }),
}))

vi.mock("../_components/EquipmentDialogContext", () => ({
  EquipmentDialogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("../equipment-content", () => ({
  EquipmentContent: () => <section aria-label="equipment table" />,
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
  EquipmentToolbar: () => <section aria-label="equipment toolbar" />,
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

function createPageState(overrides?: Partial<EquipmentPageState>): EquipmentPageState {
  return {
    status: "authenticated",
    router: { push: mocks.push, replace: vi.fn() } as EquipmentPageState["router"],
    effectiveTenantKey: "5",
    user: { id: 1, role: "to_qltb" } as EquipmentPageState["user"],
    pendingAction: null,
    clearPendingAction: mocks.clearPendingAction,
    isFetchingHighlight: false,
    isGlobal: false,
    isRegionalLeader: false,
    data: [],
    total: 9,
    departmentDistribution: [
      { department: "Khoa Ngoại", label: "Khoa Ngoại", count: 7 },
      { department: null, label: "Chưa cập nhật", count: 2 },
    ],
    isLoading: false,
    isFetching: false,
    shouldFetchEquipment: true,
    table: {
      getFilteredRowModel: () => ({ rows: [] }),
    } as EquipmentPageState["table"],
    columns: [],
    pagination: { pageIndex: 0, pageSize: 20 },
    setPagination: mocks.setPagination,
    pageCount: 1,
    columnVisibility: {},
    setColumnVisibility: vi.fn(),
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
    showFacilityFilter: false,
    facilities: [],
    selectedFacilityId: null,
    setSelectedFacilityId: vi.fn(),
    activeFacility: null,
    hasFacilityFilter: false,
    isFacilitiesLoading: false,
    handleFacilityClear: vi.fn(),
    isFilterSheetOpen: false,
    setIsFilterSheetOpen: vi.fn(),
    handleDownloadTemplate: vi.fn(),
    handleExportData: vi.fn(),
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
    ...overrides,
  }
}

describe("EquipmentPageClient department summary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.pageState = createPageState()
  })

  it("renders department distribution counts between the toolbar and table", () => {
    render(<EquipmentPageClient />)

    const summary = screen.getByRole("region", { name: "Phân bố theo khoa/phòng" })

    expect(summary).toHaveTextContent("Phân bố theo khoa/phòng")
    expect(within(summary).getByRole("button", { name: /Khoa Ngoại 7 thiết bị/ })).toBeInTheDocument()
    expect(within(summary).getByText("Chưa cập nhật")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "equipment toolbar" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "equipment table" })).toBeInTheDocument()
  })

  it("clicking a department summary item applies the existing department filter", async () => {
    const user = userEvent.setup()
    render(<EquipmentPageClient />)

    await user.click(screen.getByRole("button", { name: /Khoa Ngoại 7 thiết bị/ }))

    const updater = mocks.setColumnFilters.mock.calls[0][0] as EquipmentPageState["setColumnFilters"]
    expect(typeof updater).toBe("function")
    expect(
      (updater as (current: EquipmentPageState["columnFilters"]) => EquipmentPageState["columnFilters"])([
        { id: "tinh_trang_hien_tai", value: ["Hoạt động"] },
      ])
    ).toEqual([
      { id: "tinh_trang_hien_tai", value: ["Hoạt động"] },
      { id: "khoa_phong_quan_ly", value: ["Khoa Ngoại"] },
    ])
  })
})
