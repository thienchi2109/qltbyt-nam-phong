import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const searchMocks = vi.hoisted(() => ({
  clearSearch: vi.fn(),
  setSearchTerm: vi.fn(),
  useTransferSearch: vi.fn(),
}))

vi.mock("@/hooks/useTransferSearch", () => ({
  useTransferSearch: () => searchMocks.useTransferSearch(),
}))

import { useTransfersFilters } from "@/app/(app)/transfers/_components/useTransfersFilters"

describe("useTransfersFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    searchMocks.useTransferSearch.mockReturnValue({
      searchTerm: "",
      setSearchTerm: searchMocks.setSearchTerm,
      debouncedSearch: "",
      clearSearch: searchMocks.clearSearch,
    })
  })

  it("counts status and date filters", () => {
    const { result } = renderHook(
      ({ activeTab }) => useTransfersFilters({ activeTab }),
      {
        initialProps: { activeTab: "noi_bo" as const },
      },
    )

    act(() => {
      result.current.setStatusFilter(["cho_duyet"])
    })

    expect(result.current.activeFilterCount).toBe(1)

    act(() => {
      result.current.setDateRange({
        from: new Date("2026-04-01T00:00:00.000Z"),
        to: null,
      })
    })

    expect(result.current.activeFilterCount).toBe(2)
  })

  it("clears status and date filters while delegating search clear", () => {
    const { result } = renderHook(
      ({ activeTab }) => useTransfersFilters({ activeTab }),
      {
        initialProps: { activeTab: "noi_bo" as const },
      },
    )

    act(() => {
      result.current.setStatusFilter(["cho_duyet"])
      result.current.setDateRange({
        from: new Date("2026-04-01T00:00:00.000Z"),
        to: new Date("2026-04-02T00:00:00.000Z"),
      })
    })

    act(() => {
      result.current.handleClearAllFilters()
    })

    expect(result.current.statusFilter).toEqual([])
    expect(result.current.dateRange).toBeNull()
    expect(searchMocks.clearSearch).toHaveBeenCalledTimes(1)
  })

  it("removes an individual status filter", () => {
    const { result } = renderHook(
      ({ activeTab }) => useTransfersFilters({ activeTab }),
      {
        initialProps: { activeTab: "noi_bo" as const },
      },
    )

    act(() => {
      result.current.setStatusFilter(["cho_duyet", "da_duyet"])
    })

    act(() => {
      result.current.handleRemoveFilter("statuses", "cho_duyet")
    })

    expect(result.current.statusFilter).toEqual(["da_duyet"])
  })

  it("clears the date range when removing dateRange", () => {
    const { result } = renderHook(
      ({ activeTab }) => useTransfersFilters({ activeTab }),
      {
        initialProps: { activeTab: "noi_bo" as const },
      },
    )

    act(() => {
      result.current.setDateRange({
        from: new Date("2026-04-01T00:00:00.000Z"),
        to: new Date("2026-04-02T00:00:00.000Z"),
      })
    })

    act(() => {
      result.current.handleRemoveFilter("dateRange")
    })

    expect(result.current.dateRange).toBeNull()
  })

  it("resets status filters when the active tab changes", async () => {
    const { result, rerender } = renderHook(
      ({ activeTab }) => useTransfersFilters({ activeTab }),
      {
        initialProps: { activeTab: "noi_bo" as const },
      },
    )

    act(() => {
      result.current.setStatusFilter(["cho_duyet"])
    })

    expect(result.current.statusFilter).toEqual(["cho_duyet"])

    rerender({ activeTab: "ben_ngoai" as const })

    await waitFor(() => {
      expect(result.current.statusFilter).toEqual([])
    })
  })
})
