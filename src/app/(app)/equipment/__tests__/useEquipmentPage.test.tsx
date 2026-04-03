import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  resetFilters: vi.fn(),
  setSelectedFacilityId: vi.fn(),
  invalidateEquipmentForCurrentTenant: vi.fn(),
  setPreservePageState: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  clearPendingAction: vi.fn(),
  setPagination: vi.fn(),
  setColumnVisibility: vi.fn(),
  setSearchTerm: vi.fn(),
  setSorting: vi.fn(),
  setColumnFilters: vi.fn(),
  handleDownloadTemplate: vi.fn(),
  handleExportData: vi.fn(),
  handleGenerateProfileSheet: vi.fn(),
  handleGenerateDeviceLabel: vi.fn(),
  useEquipmentRouteSync: vi.fn(),
}))

type AuthState = {
  user: { role?: string; don_vi?: number | null; dia_ban_id?: number | null } | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  isGlobal: boolean
  isRegionalLeader: boolean
  tenantKey: string
  currentTenantId: number | null
  shouldFetchEquipment: boolean
  effectiveTenantKey: string
  selectedDonVi: number | null
  selectedFacilityId: number | null | undefined
  setSelectedFacilityId: (id: number | null) => void
  showSelector: boolean
  facilities: { id: number; name: string; code?: string; count?: number }[]
  isFacilitiesLoading: boolean
  shouldFetchData: boolean
}

type FiltersState = {
  searchTerm: string
  setSearchTerm: (value: string) => void
  debouncedSearch: string
  sorting: { id: string; desc: boolean }[]
  setSorting: (value: { id: string; desc: boolean }[]) => void
  sortParam: string
  columnFilters: { id: string; value: unknown }[]
  setColumnFilters: (value: { id: string; value: unknown }[]) => void
  resetFilters: () => void
  selectedDepartments: string[]
  selectedUsers: string[]
  selectedLocations: string[]
  selectedStatuses: string[]
  selectedClassifications: string[]
  selectedFundingSources: string[]
}

type DataState = {
  data: { id: number }[]
  total: number
  isLoading: boolean
  isFetching: boolean
  shouldFetchData: boolean
  departments: string[]
  users: string[]
  locations: string[]
  statuses: string[]
  classifications: string[]
  fundingSources: string[]
  filterData: {
    status: { id: string; label: string; count: number }[]
    department: { id: string; label: string; count: number }[]
    location: { id: string; label: string; count: number }[]
    user: { id: string; label: string; count: number }[]
    classification: { id: string; label: string; count: number }[]
    fundingSource: { id: string; label: string; count: number }[]
  }
  showFacilityFilter: boolean
  facilities: { id: number; name: string; count?: number }[]
  selectedFacilityId: number | null | undefined
  activeFacility: { id: number; name: string; count?: number } | null
  isFacilitiesLoading: boolean
  tenantOptions: { id: number; name: string; code: string }[]
  isTenantsLoading: boolean
  activeUsageLogs: undefined
  isLoadingActiveUsage: boolean
  invalidateEquipmentForCurrentTenant: () => void
}

type TableState = {
  table: {
    getState: () => { pagination: { pageIndex: number; pageSize: number } }
  }
  pagination: { pageIndex: number; pageSize: number }
  setPagination: () => void
  pageCount: number
  columnVisibility: Record<string, boolean>
  setColumnVisibility: () => void
  isFiltered: boolean
  isMobile: boolean
  isCardView: boolean
  useTabletFilters: boolean
  setPreservePageState: (value: { pageIndex: number; pageSize: number }) => void
}

type ExportState = {
  handleDownloadTemplate: () => Promise<void>
  handleExportData: () => Promise<void>
  handleGenerateProfileSheet: () => Promise<void>
  handleGenerateDeviceLabel: () => Promise<void>
  isExporting: boolean
}

const state = vi.hoisted(() => ({
  auth: null as AuthState | null,
  filters: null as FiltersState | null,
  data: null as DataState | null,
  table: null as TableState | null,
  exports: null as ExportState | null,
}))

vi.mock("@/hooks/use-tenant-branding", () => ({
  useTenantBranding: () => ({ data: undefined }),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("@/components/equipment/equipment-table-columns", () => ({
  createEquipmentColumns: () => [],
}))

vi.mock("@/components/equipment/equipment-actions-menu", () => ({
  EquipmentActionsMenu: () => null,
}))

vi.mock("@/lib/rbac", () => ({
  isEquipmentManagerRole: () => false,
}))

vi.mock("@/app/(app)/equipment/_hooks/useEquipmentAuth", () => ({
  useEquipmentAuth: () => state.auth,
}))

vi.mock("@/app/(app)/equipment/_hooks/useEquipmentFilters", () => ({
  useEquipmentFilters: () => state.filters,
}))

vi.mock("@/app/(app)/equipment/_hooks/useEquipmentData", () => ({
  useEquipmentData: () => state.data,
}))

vi.mock("@/app/(app)/equipment/_hooks/useEquipmentTable", () => ({
  useEquipmentTable: () => state.table,
}))

vi.mock("@/app/(app)/equipment/_hooks/useEquipmentExport", () => ({
  useEquipmentExport: () => state.exports,
}))

vi.mock("@/app/(app)/equipment/_hooks/useEquipmentRouteSync", () => ({
  useEquipmentRouteSync: (args: unknown) => {
    mocks.useEquipmentRouteSync(args)
    return {
      router: { push: mocks.push, replace: mocks.replace },
      pendingAction: null,
      clearPendingAction: mocks.clearPendingAction,
      isFetchingHighlight: false,
    }
  },
}))

import { useEquipmentPage } from "@/app/(app)/equipment/use-equipment-page"

function createAuthState(overrides?: Partial<AuthState>): AuthState {
  return {
    user: { role: 'global', don_vi: 42, dia_ban_id: 1 },
    status: 'authenticated',
    isGlobal: true,
    isRegionalLeader: false,
    tenantKey: '42',
    currentTenantId: 42,
    shouldFetchEquipment: true,
    effectiveTenantKey: '42',
    selectedDonVi: 42,
    selectedFacilityId: 42,
    setSelectedFacilityId: mocks.setSelectedFacilityId,
    showSelector: true,
    facilities: [],
    isFacilitiesLoading: false,
    shouldFetchData: true,
    ...overrides,
  }
}

function createFiltersState(overrides?: Partial<FiltersState>): FiltersState {
  return {
    searchTerm: '',
    setSearchTerm: mocks.setSearchTerm,
    debouncedSearch: '',
    sorting: [],
    setSorting: mocks.setSorting,
    sortParam: 'id.asc',
    columnFilters: [],
    setColumnFilters: mocks.setColumnFilters,
    resetFilters: mocks.resetFilters,
    selectedDepartments: [],
    selectedUsers: [],
    selectedLocations: [],
    selectedStatuses: [],
    selectedClassifications: [],
    selectedFundingSources: [],
    ...overrides,
  }
}

function createDataState(overrides?: Partial<DataState>): DataState {
  return {
    data: [],
    total: 0,
    isLoading: false,
    isFetching: false,
    shouldFetchData: true,
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
    selectedFacilityId: 42,
    activeFacility: null,
    isFacilitiesLoading: false,
    tenantOptions: [
      { id: 42, name: 'Đơn vị 42', code: '42' },
      { id: 99, name: 'Đơn vị 99', code: '99' },
    ],
    isTenantsLoading: false,
    activeUsageLogs: undefined,
    isLoadingActiveUsage: false,
    invalidateEquipmentForCurrentTenant: mocks.invalidateEquipmentForCurrentTenant,
    ...overrides,
  }
}

function createTableState(overrides?: Partial<TableState>): TableState {
  return {
    table: {
      getState: () => ({ pagination: { pageIndex: 0, pageSize: 20 } }),
    },
    pagination: { pageIndex: 0, pageSize: 20 },
    setPagination: mocks.setPagination,
    pageCount: 0,
    columnVisibility: {},
    setColumnVisibility: mocks.setColumnVisibility,
    isFiltered: false,
    isMobile: false,
    isCardView: false,
    useTabletFilters: false,
    setPreservePageState: mocks.setPreservePageState,
    ...overrides,
  }
}

function createExportState(overrides?: Partial<ExportState>): ExportState {
  return {
    handleDownloadTemplate: mocks.handleDownloadTemplate,
    handleExportData: mocks.handleExportData,
    handleGenerateProfileSheet: mocks.handleGenerateProfileSheet,
    handleGenerateDeviceLabel: mocks.handleGenerateDeviceLabel,
    isExporting: false,
    ...overrides,
  }
}

describe('useEquipmentPage tenant switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.auth = createAuthState()
    state.filters = createFiltersState()
    state.data = createDataState()
    state.table = createTableState()
    state.exports = createExportState()
  })

  it('does not reset filters when tenant changes because provider handles tenant-scoped state', async () => {
    const { rerender } = renderHook(() => useEquipmentPage())

    act(() => {
      if (!state.auth || !state.data) {
        throw new Error('Mock state not initialized')
      }

      state.auth.effectiveTenantKey = '99'
      state.auth.selectedDonVi = 99
      state.auth.selectedFacilityId = 99
      state.data.selectedFacilityId = 99
    })

    rerender()

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Đã áp dụng bộ lọc đơn vị',
          description: 'Hiển thị thiết bị thuộc Đơn vị 99',
        })
      )
    })

    expect(mocks.resetFilters).not.toHaveBeenCalled()
  })

  it('does not mark route sync data as ready when the equipment query is disabled', () => {
    state.data = createDataState({
      isLoading: false,
      shouldFetchData: false,
    })

    renderHook(() => useEquipmentPage())

    expect(mocks.useEquipmentRouteSync).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [],
        isDataReady: false,
      })
    )
  })
})
