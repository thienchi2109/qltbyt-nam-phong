import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, waitFor } from "@testing-library/react"
import {
  getTestMocks,
  getTestState,
  createAuthState,
  createFiltersState,
  createDataState,
  createTableState,
  createExportState,
  renderEquipmentPageHook,
} from "./useEquipmentPage.test-support"

const mocks = getTestMocks()
const state = getTestState()

describe("useEquipmentPage tenant switching", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.auth = createAuthState()
    state.filters = createFiltersState()
    state.data = createDataState()
    state.table = createTableState()
    state.exports = createExportState()
  })

  it("does not reset filters when tenant changes because provider handles tenant-scoped state", async () => {
    const { rerender } = renderEquipmentPageHook()

    act(() => {
      if (!state.auth || !state.data) {
        throw new Error("Mock state not initialized")
      }

      state.auth.effectiveTenantKey = "99"
      state.auth.selectedDonVi = 99
      state.auth.selectedFacilityId = 99
      state.data.selectedFacilityId = 99
    })

    rerender()

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Đã áp dụng bộ lọc đơn vị",
          description: "Hiển thị thiết bị thuộc Đơn vị 99",
        })
      )
    })

    expect(mocks.resetFilters).not.toHaveBeenCalled()
  })

  it("does not mark route sync data as ready when the equipment query is disabled", () => {
    state.data = createDataState({
      isLoading: false,
      shouldFetchData: false,
    })

    renderEquipmentPageHook()

    expect(mocks.useEquipmentRouteSync).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [],
        isDataReady: false,
      })
    )
  })

  it("resets pagination in the same action when filters change", () => {
    const { result } = renderEquipmentPageHook()

    act(() => {
      result.current.setColumnFilters([{ id: "tinh_trang_hien_tai", value: ["Chờ sửa chữa"] }])
    })

    expect(mocks.setPagination).toHaveBeenCalledWith(expect.any(Function))

    const resetUpdater = mocks.setPagination.mock.calls[0][0] as (value: {
      pageIndex: number
      pageSize: number
    }) => { pageIndex: number; pageSize: number }
    expect(resetUpdater({ pageIndex: 3, pageSize: 20 })).toEqual({
      pageIndex: 0,
      pageSize: 20,
    })
    expect(mocks.setColumnFilters).toHaveBeenCalledWith([
      { id: "tinh_trang_hien_tai", value: ["Chờ sửa chữa"] },
    ])
  })

  it("switches to the placed dataset after an import containing borrowed equipment", () => {
    const { result } = renderEquipmentPageHook()

    act(() => {
      result.current.onImportSuccess("placed")
    })

    expect(mocks.setDataset).toHaveBeenCalledWith("placed")
    expect(mocks.invalidateEquipmentForCurrentTenant).toHaveBeenCalledWith("placed")
  })

  it("invalidates mixed imports without losing either dataset and leaves regular imports in place", () => {
    const { result } = renderEquipmentPageHook()
    act(() => result.current.onImportSuccess(["regular", "placed"]))
    expect(mocks.setDataset).toHaveBeenCalledWith("placed")
    expect(mocks.invalidateEquipmentForCurrentTenant).toHaveBeenCalledWith(["regular", "placed"])

    mocks.setDataset.mockClear()
    act(() => result.current.onImportSuccess("regular"))
    expect(mocks.setDataset).not.toHaveBeenCalled()
  })

  it("invalidates report, dashboard, and active usage families after import", () => {
    const { result, queryClient } = renderEquipmentPageHook()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    act(() => result.current.onImportSuccess(["regular", "placed"]))

    for (const queryKey of [
      ["reports"],
      ["reports-facilities-list"],
      ["usage-analytics"],
      ["dashboard-stats"],
      ["usage-logs", "active"],
    ]) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey })
    }
  })

  it("does not switch tabs for an edit that moves equipment from placed to regular", () => {
    const { result } = renderEquipmentPageHook()
    act(() => result.current.onDataMutationSuccess(["placed", "regular"]))
    expect(mocks.setDataset).not.toHaveBeenCalled()
  })

  it("resets pagination when route search params hydrate the search filter", () => {
    renderEquipmentPageHook()

    const routeSyncArgs = mocks.useEquipmentRouteSync.mock.calls[0][0] as {
      onSearchParamHydrated: (value: string) => void
    }

    act(() => {
      routeSyncArgs.onSearchParamHydrated("monitor")
    })

    expect(mocks.setPagination).toHaveBeenCalledWith(expect.any(Function))

    const resetUpdater = mocks.setPagination.mock.calls[0][0] as (value: {
      pageIndex: number
      pageSize: number
    }) => { pageIndex: number; pageSize: number }
    expect(resetUpdater({ pageIndex: 3, pageSize: 20 })).toEqual({
      pageIndex: 0,
      pageSize: 20,
    })
    expect(mocks.setSearchTerm).toHaveBeenCalledWith("monitor")
  })

  it("exposes department distribution from equipment data", () => {
    const departmentDistribution = [
      { department: "Khoa Ngoai", label: "Khoa Ngoai", count: 7 },
      { department: null, label: "Chưa cập nhật", count: 2 },
    ]
    state.data = createDataState({ departmentDistribution })

    const { result } = renderEquipmentPageHook()

    expect(result.current.departmentDistribution).toEqual(departmentDistribution)
  })
})
