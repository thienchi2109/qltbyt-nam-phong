import * as React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  EquipmentAggregateSearchData,
  EquipmentAggregateSearchGroupBy,
} from "../../hooks/use-equipment-aggregate-search.types"

const mocks = vi.hoisted(() => ({
  useEquipmentAggregateSearch: vi.fn(),
  onQueryCommit: vi.fn(),
}))

vi.mock("../../hooks/use-equipment-aggregate-search", () => ({
  canUseEquipmentAggregateSearch: (role: string | null | undefined) =>
    role === "admin" || role === "global" || role === "regional_leader",
  normalizeEquipmentAggregateSearchError: () => "Không thể tải kết quả tìm kiếm thiết bị",
  useEquipmentAggregateSearch: mocks.useEquipmentAggregateSearch,
}))

import { EquipmentSearchReportTab } from "../equipment-search-report-tab"

interface HookParams {
  query: string
  groupBy: EquipmentAggregateSearchGroupBy
  regionId?: number | null
  role: string | null | undefined
}

function createRegionData(): EquipmentAggregateSearchData {
  return {
    rows: [
      {
        groupType: "region",
        groupId: 10,
        groupName: "Miền Bắc",
        parentRegionId: null,
        parentRegionName: null,
        equipmentCount: 27,
        facilityCount: 4,
        quotaCurrentCount: null,
        quotaMinCount: null,
        quotaMaxCount: null,
        quotaStatus: null,
      },
      {
        groupType: "region",
        groupId: 20,
        groupName: "Miền Nam",
        parentRegionId: null,
        parentRegionName: null,
        equipmentCount: 9,
        facilityCount: 2,
        quotaCurrentCount: null,
        quotaMinCount: null,
        quotaMaxCount: null,
        quotaStatus: null,
      },
    ],
    summary: {
      totalEquipmentCount: 36,
      regionCount: 2,
      facilityCount: 6,
      query: "monitor",
      scopeLabel: "Toàn hệ thống",
    },
  }
}

function createFacilityData(): EquipmentAggregateSearchData {
  return {
    rows: [
      {
        groupType: "facility",
        groupId: 101,
        groupName: "Bệnh viện A",
        parentRegionId: 10,
        parentRegionName: "Miền Bắc",
        equipmentCount: 12,
        facilityCount: null,
        quotaCurrentCount: 12,
        quotaMinCount: 4,
        quotaMaxCount: 20,
        quotaStatus: "within_limit",
      },
      {
        groupType: "facility",
        groupId: 102,
        groupName: "Trung tâm Y tế B",
        parentRegionId: 10,
        parentRegionName: "Miền Bắc",
        equipmentCount: 5,
        facilityCount: null,
        quotaCurrentCount: 5,
        quotaMinCount: null,
        quotaMaxCount: null,
        quotaStatus: "no_active_quota",
      },
    ],
    summary: {
      totalEquipmentCount: 17,
      regionCount: 1,
      facilityCount: 2,
      query: "monitor",
      scopeLabel: "Miền Bắc",
    },
  }
}

function mockAggregateData() {
  mocks.useEquipmentAggregateSearch.mockImplementation((params: HookParams) => ({
    data: params.groupBy === "facility" ? createFacilityData() : createRegionData(),
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  }))
}

describe("EquipmentSearchReportTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAggregateData()
  })

  it("renders admin region-first chart and table from the same count-first aggregate rows", () => {
    render(
      <EquipmentSearchReportTab
        userRole="admin"
        userRegionId={null}
        initialQuery="monitor"
        onQueryCommit={mocks.onQueryCommit}
      />
    )

    expect(screen.getByRole("searchbox", { name: "Từ khóa thiết bị" })).toHaveValue("monitor")
    expect(screen.getByText("Toàn hệ thống")).toBeInTheDocument()
    expect(screen.getByText("36 thiết bị phù hợp")).toBeInTheDocument()

    const chart = screen.getByTestId("equipment-search-chart")
    const table = screen.getByRole("table", { name: "Bảng kết quả tìm kiếm thiết bị" })

    expect(within(chart).getByText("Miền Bắc")).toBeInTheDocument()
    expect(within(chart).getByText("27")).toBeInTheDocument()
    expect(
      within(table).getByRole("row", { name: /Miền Bắc.*27 thiết bị.*4 cơ sở/ })
    ).toBeInTheDocument()
  })

  it("drills from a region row into facility grouping", () => {
    render(
      <EquipmentSearchReportTab
        userRole="global"
        userRegionId={null}
        initialQuery="monitor"
        onQueryCommit={mocks.onQueryCommit}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Xem cơ sở Miền Bắc" }))

    expect(mocks.useEquipmentAggregateSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: "monitor",
        groupBy: "facility",
        regionId: 10,
        role: "global",
      })
    )
    expect(screen.getAllByText("Miền Bắc").length).toBeGreaterThan(0)
    expect(screen.getByRole("row", { name: /Bệnh viện A.*12 thiết bị/ })).toBeInTheDocument()
  })

  it("starts a single-region regional leader at facility grouping", () => {
    render(
      <EquipmentSearchReportTab
        userRole="regional_leader"
        userRegionId={10}
        initialQuery="monitor"
        onQueryCommit={mocks.onQueryCommit}
      />
    )

    expect(mocks.useEquipmentAggregateSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: "monitor",
        groupBy: "facility",
        regionId: 10,
        role: "regional_leader",
      })
    )
    expect(screen.getAllByText("Cơ sở trong vùng phụ trách").length).toBeGreaterThan(0)
    expect(screen.getByRole("row", { name: /Bệnh viện A.*12 thiết bị/ })).toBeInTheDocument()
  })

  it("submits repeated searches through the Reports-owned query callback", () => {
    render(
      <EquipmentSearchReportTab
        userRole="admin"
        userRegionId={null}
        initialQuery="monitor"
        onQueryCommit={mocks.onQueryCommit}
      />
    )

    fireEvent.change(screen.getByRole("searchbox", { name: "Từ khóa thiết bị" }), {
      target: { value: "máy thở" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }))

    expect(mocks.onQueryCommit).toHaveBeenCalledWith("máy thở")
  })

  it("resets the submitted query and drill-down scope when the URL-backed query changes", () => {
    const { rerender } = render(
      <EquipmentSearchReportTab
        userRole="admin"
        userRegionId={null}
        initialQuery="monitor"
        onQueryCommit={mocks.onQueryCommit}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Xem cơ sở Miền Bắc" }))

    rerender(
      <EquipmentSearchReportTab
        userRole="admin"
        userRegionId={null}
        initialQuery="máy thở"
        onQueryCommit={mocks.onQueryCommit}
      />
    )

    expect(screen.getByRole("searchbox", { name: "Từ khóa thiết bị" })).toHaveValue("máy thở")
    expect(mocks.useEquipmentAggregateSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: "máy thở",
        groupBy: "region",
        regionId: null,
        role: "admin",
      })
    )
  })

  it("keeps the search input mounted when the URL-backed query changes", () => {
    const { rerender } = render(
      <EquipmentSearchReportTab
        userRole="admin"
        userRegionId={null}
        initialQuery="monitor"
        onQueryCommit={mocks.onQueryCommit}
      />
    )
    const searchbox = screen.getByRole("searchbox", { name: "Từ khóa thiết bị" })
    searchbox.focus()

    rerender(
      <EquipmentSearchReportTab
        userRole="admin"
        userRegionId={null}
        initialQuery="máy thở"
        onQueryCommit={mocks.onQueryCommit}
      />
    )

    const updatedSearchbox = screen.getByRole("searchbox", { name: "Từ khóa thiết bị" })
    expect(updatedSearchbox).toHaveValue("máy thở")
    expect(document.activeElement).toBe(updatedSearchbox)
  })

  it("does not clobber in-progress draft input when the URL catches up after submit", () => {
    const { rerender } = render(
      <EquipmentSearchReportTab
        userRole="admin"
        userRegionId={null}
        initialQuery="monitor"
        onQueryCommit={mocks.onQueryCommit}
      />
    )
    const searchbox = screen.getByRole("searchbox", { name: "Từ khóa thiết bị" })

    fireEvent.change(searchbox, { target: { value: "máy thở" } })
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }))
    fireEvent.change(searchbox, { target: { value: "máy thở ICU" } })

    rerender(
      <EquipmentSearchReportTab
        userRole="admin"
        userRegionId={null}
        initialQuery="máy thở"
        onQueryCommit={mocks.onQueryCommit}
      />
    )

    expect(screen.getByRole("searchbox", { name: "Từ khóa thiết bị" })).toHaveValue("máy thở ICU")
    expect(mocks.useEquipmentAggregateSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: "máy thở",
        groupBy: "region",
        regionId: null,
        role: "admin",
      })
    )
  })

  it("shows the loading state instead of stale placeholder rows during a new fetch", () => {
    mocks.useEquipmentAggregateSearch.mockReturnValue({
      data: createRegionData(),
      isLoading: false,
      isFetching: true,
      isPlaceholderData: true,
      isError: false,
      error: null,
    })

    render(
      <EquipmentSearchReportTab
        userRole="admin"
        userRegionId={null}
        initialQuery="monitor"
        onQueryCommit={mocks.onQueryCommit}
      />
    )

    expect(screen.queryByText("36 thiết bị phù hợp")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("table", { name: "Bảng kết quả tìm kiếm thiết bị" })
    ).not.toBeInTheDocument()
  })

  it("suppresses the empty state while the current search is still fetching", () => {
    mocks.useEquipmentAggregateSearch.mockReturnValue({
      data: {
        rows: [],
        summary: {
          totalEquipmentCount: 0,
          regionCount: 0,
          facilityCount: 0,
          query: "monitor",
          scopeLabel: "Toàn hệ thống",
        },
      },
      isLoading: false,
      isFetching: true,
      isPlaceholderData: true,
      isError: false,
      error: null,
    })

    render(
      <EquipmentSearchReportTab
        userRole="admin"
        userRegionId={null}
        initialQuery="monitor"
        onQueryCommit={mocks.onQueryCommit}
      />
    )

    expect(
      screen.queryByText("Không tìm thấy thiết bị phù hợp trong phạm vi hiện tại.")
    ).not.toBeInTheDocument()
  })
})
